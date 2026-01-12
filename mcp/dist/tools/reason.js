/**
 * grok_reason Tool
 *
 * Extended reasoning tool that leverages Grok's reasoning models for
 * complex problem-solving with optional thinking trace output.
 *
 * @module tools/reason
 */
import { CostTracker } from '../services/cost-tracker.js';
/**
 * JSON Schema for grok_reason tool (JSON Schema 2020-12)
 */
export const reasonSchema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: {
        query: {
            type: 'string',
            description: 'The question or problem to reason through',
        },
        effort: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            default: 'medium',
            description: 'Reasoning effort level: low (quick analysis), medium (balanced), high (thorough deep thinking)',
        },
        show_thinking: {
            type: 'boolean',
            default: true,
            description: 'Whether to include the thinking/reasoning process in the output',
        },
        model: {
            type: 'string',
            description: 'Model to use for reasoning. Default: grok-4-1-fast-reasoning (2M context)',
        },
        context: {
            type: 'string',
            description: 'Additional context or background information relevant to the problem',
        },
    },
    required: ['query'],
    additionalProperties: false,
};
/**
 * Effort to temperature mapping
 * Lower temperature = more focused/deterministic
 * Higher temperature = more creative/exploratory
 */
const EFFORT_CONFIG = {
    low: {
        temperature: 0.3,
        maxTokens: 2000,
        systemPrompt: `You are a reasoning assistant. Provide a concise analysis with clear logical steps.
Be direct and focus on the most likely correct answer.
Format: Brief thinking → Answer`,
    },
    medium: {
        temperature: 0.5,
        maxTokens: 4000,
        systemPrompt: `You are a reasoning assistant specializing in careful analysis.
Work through the problem step by step, considering multiple angles.
Format:
<thinking>
[Your step-by-step reasoning process]
</thinking>

<answer>
[Your final conclusion]
</answer>`,
    },
    high: {
        temperature: 0.7,
        maxTokens: 8000,
        systemPrompt: `You are an expert reasoning assistant for complex problems.
Engage in deep, thorough analysis:
1. Break down the problem into components
2. Consider multiple perspectives and approaches
3. Evaluate evidence and assumptions
4. Identify potential edge cases or counterarguments
5. Synthesize insights into a well-reasoned conclusion

Format:
<thinking>
## Understanding the Problem
[Initial analysis]

## Key Considerations
[Important factors to consider]

## Reasoning Steps
[Detailed step-by-step reasoning]

## Potential Issues
[Edge cases, counterarguments]

## Synthesis
[Bringing it all together]
</thinking>

<answer>
[Your final, well-supported conclusion]
</answer>`,
    },
};
// Note: Cost calculation now uses client.calculateCost() for consistency
// See P2-020: Consolidated cost calculation
/**
 * Parse thinking and answer from response
 */
function parseReasoningResponse(response) {
    // Try to extract structured thinking and answer
    const thinkingMatch = response.match(/<thinking>([\s\S]*?)<\/thinking>/i);
    const answerMatch = response.match(/<answer>([\s\S]*?)<\/answer>/i);
    if (thinkingMatch && answerMatch) {
        return {
            thinking: thinkingMatch[1].trim(),
            answer: answerMatch[1].trim(),
        };
    }
    // If no structured format, try to split on common patterns
    const splitPatterns = [
        /(?:^|\n)(?:Final (?:Answer|Conclusion)|Therefore|In conclusion|To summarize)[:\s]*(.*)$/is,
        /(?:^|\n)(?:Answer|Conclusion)[:\s]*(.*)$/is,
    ];
    for (const pattern of splitPatterns) {
        const match = response.match(pattern);
        if (match) {
            const answerPart = match[1].trim();
            const thinkingPart = response.slice(0, match.index).trim();
            return {
                thinking: thinkingPart,
                answer: answerPart,
            };
        }
    }
    // No clear structure, return whole response as answer
    return {
        thinking: '',
        answer: response,
    };
}
/**
 * Execute reasoning query
 */
export async function executeReason(client, input) {
    const startTime = Date.now();
    // Validate input
    if (!input.query || input.query.trim().length === 0) {
        throw new Error('Query is required for reasoning');
    }
    // Apply defaults
    const effort = input.effort || 'medium';
    const showThinking = input.show_thinking !== false; // Default true
    const model = input.model || 'grok-4-1-fast-reasoning';
    // Get effort configuration
    const config = EFFORT_CONFIG[effort];
    // Build messages
    const messages = [
        {
            role: 'system',
            content: config.systemPrompt,
        },
    ];
    // Add context if provided
    if (input.context) {
        messages.push({
            role: 'user',
            content: `Context:\n${input.context}`,
        });
        messages.push({
            role: 'assistant',
            content: 'I understand the context. Please provide your question.',
        });
    }
    // Add the main query
    messages.push({
        role: 'user',
        content: input.query,
    });
    // Make the API call
    const apiResponse = await client.chatCompletion({
        model,
        messages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
    });
    const responseTime = Date.now() - startTime;
    // API response content is always a string
    const responseContent = apiResponse.choices[0]?.message?.content;
    const rawResponse = typeof responseContent === 'string' ? responseContent : '';
    // Parse the response
    const { thinking, answer } = parseReasoningResponse(rawResponse);
    // Build the result
    const result = {
        response: answer,
        model: apiResponse.model,
        effort,
        usage: apiResponse.usage,
        cost: client.calculateCost(apiResponse.model, apiResponse.usage.prompt_tokens, apiResponse.usage.completion_tokens),
        response_time_ms: responseTime,
    };
    // Include thinking if requested and available
    if (showThinking && thinking) {
        result.thinking = thinking;
    }
    return result;
}
/**
 * Format reasoning result for MCP response
 */
function formatReasonOutput(result) {
    const lines = [];
    // Header
    lines.push(`🤖 **Grok Reasoning:**`);
    lines.push('');
    lines.push(`**Model:** ${result.model} | **Effort:** ${result.effort}`);
    lines.push('');
    // Thinking trace (if included)
    if (result.thinking) {
        lines.push(`### Thinking Process`);
        lines.push('');
        lines.push('<details>');
        lines.push('<summary>Click to expand reasoning trace</summary>');
        lines.push('');
        lines.push(result.thinking);
        lines.push('');
        lines.push('</details>');
        lines.push('');
    }
    // Answer
    lines.push(`### Answer`);
    lines.push('');
    lines.push(result.response);
    lines.push('');
    // Metadata
    lines.push('---');
    lines.push(`⚡ *${result.model} • ${result.usage.total_tokens} tokens • $${result.cost.estimated_usd.toFixed(4)} • ${result.response_time_ms}ms*`);
    return lines.join('\n');
}
/**
 * Handle grok_reason tool call
 *
 * @param client - XAI client instance
 * @param input - Tool input parameters
 * @param services - Optional services for cost tracking and rate limiting
 * @returns MCP CallToolResult
 */
export async function handleReason(client, input, services) {
    try {
        // Validate input
        if (!input || typeof input !== 'object') {
            throw new Error('Invalid input: expected object with query property');
        }
        const params = input;
        if (!params.query || typeof params.query !== 'string') {
            throw new Error('Invalid input: query property is required and must be a string');
        }
        const reasonInput = {
            query: params.query,
            effort: typeof params.effort === 'string' ? params.effort : undefined,
            show_thinking: typeof params.show_thinking === 'boolean' ? params.show_thinking : undefined,
            model: typeof params.model === 'string' ? params.model : undefined,
            context: typeof params.context === 'string' ? params.context : undefined,
        };
        // Resolve model and effort for budget/rate estimation
        const resolvedModel = client.resolveModel(reasonInput.model || 'grok-4-1-fast-reasoning');
        const effort = reasonInput.effort || 'medium';
        const config = EFFORT_CONFIG[effort];
        // Estimate tokens for budget and rate limiting
        const estimatedInputTokens = Math.ceil((reasonInput.query.length + (reasonInput.context?.length || 0)) / 4);
        const estimatedOutputTokens = config.maxTokens;
        // CHECK BUDGET (estimate cost before call)
        if (services?.costTracker) {
            const estimatedCost = CostTracker.estimateCost(resolvedModel, estimatedInputTokens, estimatedOutputTokens);
            services.costTracker.checkBudget(estimatedCost); // throws if over budget
        }
        // ACQUIRE RATE LIMIT
        if (services?.rateLimiter) {
            await services.rateLimiter.acquire(estimatedInputTokens);
        }
        try {
            const result = await executeReason(client, reasonInput);
            // RECORD ACTUAL USAGE
            if (services?.rateLimiter) {
                services.rateLimiter.recordUsage(result.usage.total_tokens, estimatedInputTokens);
                services.rateLimiter.clearBackoff();
            }
            // TRACK COST
            if (services?.costTracker) {
                services.costTracker.addFromEstimate(result.cost);
            }
            const content = {
                type: 'text',
                text: formatReasonOutput(result),
            };
            return {
                content: [content],
                isError: false,
            };
        }
        catch (error) {
            // Release rate limiter slot on failure
            if (services?.rateLimiter) {
                services.rateLimiter.release(estimatedInputTokens);
            }
            throw error;
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return {
            content: [{ type: 'text', text: `Error during reasoning: ${errorMessage}` }],
            isError: true,
        };
    }
}
//# sourceMappingURL=reason.js.map
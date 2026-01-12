import { XAIError, } from '../types/index.js';
const DEFAULT_MODEL = 'grok-4-1-fast';
const DEFAULT_MAX_TURNS = 3;
const MAX_CODE_LENGTH = 50000;
export const grokExecuteCodeSchema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: {
        code: {
            type: 'string',
            minLength: 1,
            maxLength: MAX_CODE_LENGTH,
            description: 'Python code to execute',
        },
        description: {
            type: 'string',
            maxLength: 1000,
            description: 'What the code should accomplish (used as context)',
        },
        include_output: {
            type: 'boolean',
            default: true,
            description: 'Include raw stdout/stderr in response',
        },
        max_turns: {
            type: 'integer',
            minimum: 1,
            maximum: 10,
            default: DEFAULT_MAX_TURNS,
            description: 'Maximum execution iterations',
        },
        model: {
            type: 'string',
            description: 'Model to use (default: grok-4-1-fast)',
        },
    },
    required: ['code'],
    additionalProperties: false,
};
export const grokExecuteCodeToolDefinition = {
    name: 'grok_execute_code',
    description: 'Execute Python code server-side for calculations, data analysis, and algorithm testing.',
    inputSchema: grokExecuteCodeSchema,
};
/**
 * Validate and normalize input parameters
 */
export function validateGrokExecuteCodeInput(input) {
    if (!input || typeof input !== 'object') {
        throw new Error('Input must be an object');
    }
    const params = input;
    // Validate required 'code' parameter
    if (params.code === undefined || params.code === null) {
        throw new Error('code parameter is required');
    }
    if (typeof params.code !== 'string') {
        throw new Error('code parameter must be a string');
    }
    if (params.code.length === 0) {
        throw new Error('code parameter cannot be empty');
    }
    if (params.code.length > MAX_CODE_LENGTH) {
        throw new Error(`code parameter exceeds maximum length of ${MAX_CODE_LENGTH} characters`);
    }
    // Validate optional 'description' parameter
    if (params.description !== undefined && typeof params.description !== 'string') {
        throw new Error('description parameter must be a string');
    }
    // Validate optional 'include_output' parameter
    if (params.include_output !== undefined && typeof params.include_output !== 'boolean') {
        throw new Error('include_output parameter must be a boolean');
    }
    // Validate optional 'max_turns' parameter
    if (params.max_turns !== undefined) {
        if (typeof params.max_turns !== 'number' || !Number.isInteger(params.max_turns)) {
            throw new Error('max_turns parameter must be an integer');
        }
        if (params.max_turns < 1 || params.max_turns > 10) {
            throw new Error('max_turns parameter must be between 1 and 10');
        }
    }
    // Validate optional 'model' parameter
    if (params.model !== undefined && typeof params.model !== 'string') {
        throw new Error('model parameter must be a string');
    }
    return {
        code: params.code,
        description: params.description,
        include_output: params.include_output ?? true,
        max_turns: params.max_turns ?? DEFAULT_MAX_TURNS,
        model: params.model ?? DEFAULT_MODEL,
    };
}
/**
 * Build system prompt for code execution
 */
function buildSystemPrompt() {
    return `You are a Python code execution assistant. Your task is to:

1. Execute the provided Python code
2. Explain what the code does and what results it produced
3. If there are errors, explain what went wrong and suggest fixes
4. Present results clearly with proper formatting

Always be concise and focus on the execution results.`;
}
/**
 * Build user message with code and optional description
 */
function buildUserMessage(code, description) {
    let message = '';
    if (description) {
        message += `Task: ${description}\n\n`;
    }
    message += `Execute this Python code:\n\`\`\`python\n${code}\n\`\`\``;
    return message;
}
/**
 * Detect if response indicates an execution error
 */
function detectError(response) {
    const errorPatterns = [
        /error/i,
        /exception/i,
        /traceback/i,
        /failed/i,
        /syntax error/i,
        /name.*not defined/i,
        /type.*error/i,
        /value.*error/i,
        /index.*error/i,
        /key.*error/i,
        /attribute.*error/i,
        /import.*error/i,
        /runtime.*error/i,
    ];
    return errorPatterns.some((pattern) => pattern.test(response));
}
/**
 * Format the response for display
 */
function formatResponse(result) {
    let output = '**Code Execution Results**\n\n';
    output += result.response;
    if (result.execution_output) {
        output += '\n\n**Raw Output:**\n```\n' + result.execution_output + '\n```';
    }
    if (result.has_error) {
        output += '\n\n*Note: Execution encountered errors. See details above.*';
    }
    output += '\n\n---\n';
    output += `*${result.model} | `;
    output += `${result.usage.total_tokens} tokens | `;
    output += `$${result.cost.estimated_usd.toFixed(4)} | `;
    output += `${result.response_time_ms}ms*`;
    return output;
}
/**
 * Handle grok_execute_code tool execution
 */
export async function handleGrokExecuteCode(client, args, services) {
    const startTime = Date.now();
    try {
        // Validate input
        const input = validateGrokExecuteCodeInput(args);
        // Resolve model (support aliases)
        const model = client.resolveModel(input.model || DEFAULT_MODEL);
        // Check budget before execution
        if (services?.costTracker) {
            services.costTracker.checkBudget(0);
        }
        // Acquire rate limit slot
        const estimatedTokens = Math.ceil(input.code.length / 4) + 500;
        if (services?.rateLimiter) {
            await services.rateLimiter.acquire(estimatedTokens);
        }
        // Build code execution tool config
        const codeExecutionTool = {
            type: 'code_interpreter',
        };
        // Build Agent Tools API request
        const agentParams = {
            model,
            input: [
                { role: 'system', content: buildSystemPrompt() },
                { role: 'user', content: buildUserMessage(input.code, input.description) },
            ],
            tools: [codeExecutionTool],
            max_turns: input.max_turns,
            include: ['code_interpreter_call.outputs'],
        };
        // Execute the request
        const response = await client.responsesCreate(agentParams);
        const responseTime = Date.now() - startTime;
        // Calculate cost
        // Agent Tools API may return input_tokens/output_tokens OR prompt_tokens/completion_tokens
        const inputTokens = response.usage.input_tokens ?? response.usage.prompt_tokens ?? 0;
        const outputTokens = response.usage.output_tokens ?? response.usage.completion_tokens ?? 0;
        const cost = client.calculateCost(response.model, inputTokens, outputTokens);
        // Record usage with services
        if (services?.costTracker) {
            services.costTracker.addFromEstimate(cost);
        }
        if (services?.rateLimiter) {
            services.rateLimiter.recordUsage(response.usage.total_tokens, estimatedTokens);
            services.rateLimiter.clearBackoff();
        }
        // Detect if there were execution errors
        const responseContent = response.content || '';
        const hasError = detectError(responseContent);
        // Build result object
        const result = {
            response: responseContent,
            execution_output: input.include_output
                ? extractExecutionOutput({ ...response, content: responseContent })
                : undefined,
            has_error: hasError,
            model: response.model,
            usage: response.usage,
            cost,
            tool_usage: response.server_side_tool_usage || {},
            response_time_ms: responseTime,
        };
        // Format and return response
        const formattedResponse = formatResponse(result);
        return {
            content: [{ type: 'text', text: formattedResponse }],
        };
    }
    catch (error) {
        const responseTime = Date.now() - startTime;
        // Release rate limit slot on error
        if (services?.rateLimiter) {
            const estimatedTokens = 500;
            services.rateLimiter.release(estimatedTokens);
        }
        const errorMessage = error instanceof XAIError
            ? error.getSanitizedMessage()
            : error instanceof Error
                ? error.message
                : 'Unknown error occurred';
        return {
            content: [
                {
                    type: 'text',
                    text: `**Code Execution Failed**\n\n${errorMessage}\n\n---\n*${responseTime}ms*`,
                },
            ],
        };
    }
}
/**
 * Extract execution output from agent response
 * This parses any code execution results embedded in the response
 */
function extractExecutionOutput(response) {
    // Look for code blocks in the response that might contain output
    const outputMatch = response.content.match(/```(?:output|stdout|result)?\n([\s\S]*?)```/);
    if (outputMatch) {
        return outputMatch[1].trim();
    }
    // Check for output sections
    const sectionMatch = response.content.match(/(?:Output|Result|Returns?):\s*\n?([\s\S]*?)(?:\n\n|$)/i);
    if (sectionMatch) {
        return sectionMatch[1].trim();
    }
    return undefined;
}
//# sourceMappingURL=execute-code.js.map
/**
 * grok_query Tool Implementation
 *
 * MCP tool for querying Grok models with full parameter support.
 * Supports model aliases, cost calculation, and response caching.
 *
 * @module tools/query
 */
import { XAIError, VISION_CAPABLE_MODELS, } from '../types/index.js';
import { CostTracker } from '../services/cost-tracker.js';
/**
 * UX enhancement thresholds and constants
 */
const UX_THRESHOLDS = {
    /** Cost threshold (USD) for showing expensive query warning */
    EXPENSIVE_QUERY_COST: 0.05,
    /** Budget usage percentage for first warning */
    BUDGET_WARNING_LEVEL_1: 75,
    /** Budget usage percentage for critical warning */
    BUDGET_WARNING_LEVEL_2: 90,
};
/**
 * Model pricing for cost comparison suggestions
 * (relative cost multipliers based on output token pricing)
 */
const MODEL_COST_TIERS = {
    'grok-4-fast': { tier: 'cheap', outputRate: 0.5 },
    'grok-4-fast-non-reasoning': { tier: 'cheap', outputRate: 0.5 },
    'grok-code-fast-1': { tier: 'moderate', outputRate: 1.5 },
    'grok-4-1-fast-reasoning': { tier: 'moderate', outputRate: 3.0 },
    'grok-4': { tier: 'expensive', outputRate: 15.0 },
    'grok-4-0709': { tier: 'expensive', outputRate: 15.0 },
};
/**
 * Get cheaper model alternatives for cost savings suggestions
 */
function getCheaperAlternatives(currentModel) {
    const currentTier = MODEL_COST_TIERS[currentModel];
    if (!currentTier || currentTier.tier === 'cheap') {
        return [];
    }
    const alternatives = [];
    const currentRate = currentTier.outputRate;
    for (const [model, info] of Object.entries(MODEL_COST_TIERS)) {
        if (info.outputRate < currentRate) {
            const savingsPercent = Math.round((1 - info.outputRate / currentRate) * 100);
            if (savingsPercent >= 50) {
                alternatives.push({
                    model,
                    savings: `${savingsPercent}% cheaper`,
                });
            }
        }
    }
    return alternatives.slice(0, 2); // Max 2 suggestions
}
/**
 * System prompt instruction for JSON mode (P4-016)
 * Forces model to return valid JSON and handles edge cases
 */
const JSON_MODE_SYSTEM_PROMPT = `You MUST respond with valid JSON only. Follow these rules strictly:
1. Output ONLY valid JSON - no markdown, no explanations, no code blocks
2. Do NOT wrap JSON in \`\`\`json\`\`\` or any code blocks
3. Ensure all strings are properly escaped
4. Use double quotes for all keys and string values
5. If you cannot provide JSON, return: {"error": "reason"}`;
/**
 * Parse JSON from model response (P4-016)
 *
 * Handles edge cases:
 * 1. Raw JSON response
 * 2. JSON wrapped in markdown code blocks
 * 3. JSON with leading/trailing whitespace
 *
 * @param response - Raw response from model
 * @returns JsonParseResult with parsed data or error info
 */
function parseJsonResponse(response) {
    let jsonStr = response.trim();
    // Try to extract JSON from markdown code blocks
    // Pattern: ```json ... ``` or ``` ... ```
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
    }
    // Try parsing
    try {
        const parsed = JSON.parse(jsonStr);
        return {
            json_valid: true,
            parsed,
        };
    }
    catch (error) {
        return {
            json_valid: false,
            parse_error: error instanceof Error ? error.message : 'Unknown JSON parse error',
        };
    }
}
/**
 * JSON Schema 2020-12 definition for grok_query tool
 */
export const grokQuerySchema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: {
        query: {
            type: 'string',
            description: 'The question or prompt to send to Grok',
            minLength: 1,
            maxLength: 100000,
        },
        model: {
            type: 'string',
            description: 'Model to use. Aliases: auto, default, fast, smartest, code, reasoning, cheap, vision. Or use model ID directly (e.g., grok-4, grok-4-fast)',
            default: 'auto',
        },
        context: {
            type: 'string',
            description: 'Optional system context to guide the response',
            maxLength: 50000,
        },
        max_tokens: {
            type: 'integer',
            description: 'Maximum tokens in the response (default: 4096)',
            minimum: 1,
            maximum: 131072,
            default: 4096,
        },
        temperature: {
            type: 'number',
            description: 'Sampling temperature (0.0-2.0, default: 0.7)',
            minimum: 0,
            maximum: 2,
            default: 0.7,
        },
        top_p: {
            type: 'number',
            description: 'Nucleus sampling: only consider tokens with top_p cumulative probability (0-1). Alternative to temperature. Recommend altering top_p OR temperature, not both.',
            minimum: 0,
            maximum: 1,
        },
        stream: {
            type: 'boolean',
            description: 'Enable streaming response (default: false)',
            default: false,
        },
        timeout: {
            type: 'integer',
            description: 'Request timeout in milliseconds (default: 30000). Increase for complex queries to slower models like grok-4.',
            minimum: 1000,
            maximum: 120000,
            default: 30000,
        },
        image_url: {
            type: 'string',
            description: 'Image URL for vision queries. Supports HTTPS URLs or base64 data URIs (data:image/png;base64,...). When provided, auto-selects vision-capable model if model is "auto".',
            maxLength: 10000000,
        },
        image_detail: {
            type: 'string',
            enum: ['auto', 'low', 'high'],
            description: 'Detail level for image analysis. "low" uses fewer tokens, "high" provides more detail. Default: "auto".',
            default: 'auto',
        },
        response_format: {
            type: 'object',
            description: 'Request structured JSON output. When set, Grok will return valid JSON. Use { type: "json_object" }.',
            properties: {
                type: {
                    type: 'string',
                    enum: ['json_object'],
                    description: 'Output format type. Currently only "json_object" is supported.',
                },
            },
            required: ['type'],
            additionalProperties: false,
        },
    },
    required: ['query'],
    additionalProperties: false,
};
/**
 * Tool definition for MCP registration
 */
export const grokQueryToolDefinition = {
    name: 'grok_query',
    description: "Query xAI's Grok models. Use for getting Grok's perspective on questions, code analysis, explanations, and creative tasks. Returns response with token usage and cost estimate.",
    inputSchema: grokQuerySchema,
};
/**
 * Extract text content from a message content field (P4-015)
 * Handles both string content (text-only) and array content (multimodal)
 * For API responses, content is always a string
 */
function extractTextContent(content) {
    if (!content)
        return '';
    if (typeof content === 'string')
        return content;
    // For array content, extract text from text parts
    return content
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('');
}
/**
 * Validate image URL format (P4-015)
 * Allows HTTPS URLs and base64 data URIs for common image formats
 */
function isValidImageUrl(url) {
    // Allow HTTPS URLs
    if (url.startsWith('https://')) {
        try {
            new URL(url);
            return true;
        }
        catch {
            return false;
        }
    }
    // Allow base64 data URIs for common image formats
    return url.startsWith('data:image/') && url.includes(';base64,');
}
/**
 * Validate input parameters for grok_query
 *
 * @param input - Raw input from MCP tool call
 * @returns Validated GrokQueryInput
 * @throws Error with descriptive message for validation failures
 */
export function validateGrokQueryInput(input) {
    if (!input || typeof input !== 'object') {
        throw new Error('Input must be an object');
    }
    const params = input;
    // Required: query
    if (!params.query || typeof params.query !== 'string') {
        throw new Error('query is required and must be a string');
    }
    if (params.query.length === 0) {
        throw new Error('query cannot be empty');
    }
    if (params.query.length > 100000) {
        throw new Error('query exceeds maximum length of 100,000 characters');
    }
    // Optional: model
    if (params.model !== undefined && typeof params.model !== 'string') {
        throw new Error('model must be a string');
    }
    // Optional: context
    if (params.context !== undefined) {
        if (typeof params.context !== 'string') {
            throw new Error('context must be a string');
        }
        if (params.context.length > 50000) {
            throw new Error('context exceeds maximum length of 50,000 characters');
        }
    }
    // Optional: max_tokens
    if (params.max_tokens !== undefined) {
        if (typeof params.max_tokens !== 'number' || !Number.isInteger(params.max_tokens)) {
            throw new Error('max_tokens must be an integer');
        }
        if (params.max_tokens < 1 || params.max_tokens > 131072) {
            throw new Error('max_tokens must be between 1 and 131,072');
        }
    }
    // Optional: temperature
    if (params.temperature !== undefined) {
        if (typeof params.temperature !== 'number') {
            throw new Error('temperature must be a number');
        }
        if (params.temperature < 0 || params.temperature > 2) {
            throw new Error('temperature must be between 0 and 2');
        }
    }
    // Optional: top_p
    if (params.top_p !== undefined) {
        if (typeof params.top_p !== 'number') {
            throw new Error('top_p must be a number');
        }
        if (params.top_p < 0 || params.top_p > 1) {
            throw new Error('top_p must be between 0 and 1');
        }
    }
    // Optional: stream
    if (params.stream !== undefined && typeof params.stream !== 'boolean') {
        throw new Error('stream must be a boolean');
    }
    // Optional: timeout
    if (params.timeout !== undefined) {
        if (typeof params.timeout !== 'number' || !Number.isInteger(params.timeout)) {
            throw new Error('timeout must be an integer');
        }
        if (params.timeout < 1000 || params.timeout > 120000) {
            throw new Error('timeout must be between 1,000 and 120,000 milliseconds');
        }
    }
    // Optional: image_url (P4-015 Vision Support)
    if (params.image_url !== undefined) {
        if (typeof params.image_url !== 'string') {
            throw new Error('image_url must be a string');
        }
        if (params.image_url.length === 0) {
            throw new Error('image_url cannot be empty');
        }
        if (params.image_url.length > 10000000) {
            throw new Error('image_url exceeds maximum length of 10,000,000 characters');
        }
        if (!isValidImageUrl(params.image_url)) {
            throw new Error('image_url must be a valid HTTPS URL or base64 data URI (data:image/...;base64,...)');
        }
    }
    // Optional: image_detail (P4-015 Vision Support)
    if (params.image_detail !== undefined) {
        if (!['auto', 'low', 'high'].includes(params.image_detail)) {
            throw new Error('image_detail must be one of: auto, low, high');
        }
    }
    // Optional: response_format (P4-016)
    if (params.response_format !== undefined) {
        if (typeof params.response_format !== 'object' || params.response_format === null) {
            throw new Error('response_format must be an object');
        }
        const format = params.response_format;
        if (format.type !== 'json_object') {
            throw new Error('response_format.type must be "json_object"');
        }
    }
    return {
        query: params.query,
        model: params.model || 'auto',
        context: params.context,
        max_tokens: params.max_tokens || 4096,
        temperature: params.temperature ?? 0.7,
        top_p: params.top_p,
        stream: params.stream || false,
        timeout: params.timeout || 30000,
        image_url: params.image_url,
        image_detail: params.image_detail || 'auto',
        response_format: params.response_format,
    };
}
/**
 * Execute a Grok query
 *
 * @param client - XAI client instance
 * @param input - Validated query input
 * @returns Query response with content, usage, and cost
 *
 * @example
 * ```typescript
 * const client = createClient();
 * const result = await executeGrokQuery(client, {
 *   query: "Explain recursion",
 *   model: "fast"
 * });
 * console.log(result.response);
 * console.log(`Cost: $${result.cost.estimated_usd.toFixed(4)}`);
 * ```
 */
export async function executeGrokQuery(client, input) {
    const startTime = Date.now();
    const isJsonMode = input.response_format?.type === 'json_object';
    // Determine if this is a vision query (P4-015)
    const isVisionQuery = !!input.image_url;
    // Resolve model alias to actual model ID (with intelligent auto-selection)
    // For vision queries with model 'auto', auto-select vision-capable model
    let resolvedModel;
    if (isVisionQuery && (input.model === 'auto' || !input.model)) {
        // Auto-select vision-capable model for vision queries
        resolvedModel = 'grok-4';
    }
    else {
        resolvedModel = client.resolveModel(input.model || 'auto', input.query, input.context);
    }
    // Validate vision model compatibility (P4-015)
    if (isVisionQuery && !VISION_CAPABLE_MODELS.includes(resolvedModel)) {
        throw new Error(`Model ${resolvedModel} does not support vision. Use 'auto', 'vision', or a vision-capable model like grok-4.`);
    }
    // Build messages array
    const messages = [];
    // Add JSON mode system prompt if enabled (P4-016)
    if (isJsonMode) {
        messages.push({
            role: 'system',
            content: JSON_MODE_SYSTEM_PROMPT,
        });
    }
    // Add system context if provided
    if (input.context) {
        messages.push({
            role: 'system',
            content: input.context,
        });
    }
    // Build user message content (P4-015: multimodal for vision queries)
    let userContent;
    if (isVisionQuery) {
        // Multimodal content array for vision queries (OpenAI-compatible format)
        const contentParts = [
            {
                type: 'image_url',
                image_url: {
                    url: input.image_url,
                    detail: input.image_detail || 'auto',
                },
            },
            { type: 'text', text: input.query },
        ];
        userContent = contentParts;
    }
    else {
        // Simple text content for non-vision queries
        userContent = input.query;
    }
    // Add user message
    messages.push({
        role: 'user',
        content: userContent,
    });
    try {
        // Make API request
        const response = await client.chatCompletion({
            model: resolvedModel,
            messages,
            max_tokens: input.max_tokens,
            temperature: input.temperature,
            top_p: input.top_p,
            stream: input.stream,
            timeout: input.timeout,
        });
        const responseTime = Date.now() - startTime;
        // Extract response content (P4-015: handle multimodal content type)
        const assistantMessage = extractTextContent(response.choices[0]?.message?.content);
        // Parse JSON if JSON mode was requested (P4-016)
        const jsonResult = isJsonMode ? parseJsonResponse(assistantMessage) : undefined;
        // Calculate cost
        const cost = client.calculateCost(response.model, response.usage.prompt_tokens, response.usage.completion_tokens);
        return {
            response: assistantMessage,
            model: response.model,
            usage: {
                prompt_tokens: response.usage.prompt_tokens,
                completion_tokens: response.usage.completion_tokens,
                reasoning_tokens: response.usage.reasoning_tokens,
                total_tokens: response.usage.total_tokens,
            },
            cost,
            thinking: undefined, // Reasoning models may populate this in future
            cached: false, // Cache integration in Phase 2
            response_time_ms: responseTime,
            json_result: jsonResult,
        };
    }
    catch (error) {
        if (error instanceof XAIError) {
            // Re-throw XAI errors with additional context
            throw new Error(`Grok API error (${error.statusCode}): ${error.message}` +
                (error.statusCode === 401
                    ? '. Check your XAI_API_KEY environment variable.'
                    : error.statusCode === 429
                        ? '. Rate limit exceeded. Try again later.'
                        : ''));
        }
        throw error;
    }
}
/**
 * Execute a streaming Grok query with partial response support
 *
 * Consumes SSE stream and accumulates response.
 * If timeout occurs, returns partial response with available content.
 *
 * @param client - XAI client instance
 * @param input - Validated query input
 * @returns Streaming query response with partial flag
 */
export async function executeGrokQueryStreaming(client, input) {
    const startTime = Date.now();
    const isJsonMode = input.response_format?.type === 'json_object';
    // Determine if this is a vision query (P4-015)
    const isVisionQuery = !!input.image_url;
    // Resolve model alias to actual model ID (with intelligent auto-selection)
    // For vision queries with model 'auto', auto-select vision-capable model
    let resolvedModel;
    if (isVisionQuery && (input.model === 'auto' || !input.model)) {
        resolvedModel = 'grok-4';
    }
    else {
        resolvedModel = client.resolveModel(input.model || 'auto', input.query, input.context);
    }
    // Validate vision model compatibility (P4-015)
    if (isVisionQuery && !VISION_CAPABLE_MODELS.includes(resolvedModel)) {
        throw new Error(`Model ${resolvedModel} does not support vision. Use 'auto', 'vision', or a vision-capable model like grok-4.`);
    }
    // Build messages array
    const messages = [];
    // Add JSON mode system prompt if enabled (P4-016)
    if (isJsonMode) {
        messages.push({
            role: 'system',
            content: JSON_MODE_SYSTEM_PROMPT,
        });
    }
    if (input.context) {
        messages.push({
            role: 'system',
            content: input.context,
        });
    }
    // Build user message content (P4-015: multimodal for vision queries)
    let userContent;
    if (isVisionQuery) {
        // Multimodal content array for vision queries (OpenAI-compatible format)
        const contentParts = [
            {
                type: 'image_url',
                image_url: {
                    url: input.image_url,
                    detail: input.image_detail || 'auto',
                },
            },
            { type: 'text', text: input.query },
        ];
        userContent = contentParts;
    }
    else {
        userContent = input.query;
    }
    messages.push({
        role: 'user',
        content: userContent,
    });
    let accumulatedContent = '';
    let chunksReceived = 0;
    let lastUsage;
    let partial = false;
    try {
        const stream = client.chatCompletionStream({
            model: resolvedModel,
            messages,
            max_tokens: input.max_tokens,
            temperature: input.temperature,
            top_p: input.top_p,
            timeout: input.timeout,
        });
        for await (const chunk of stream) {
            chunksReceived++;
            const delta = chunk.choices[0]?.delta;
            if (delta?.content) {
                accumulatedContent += delta.content;
            }
            if (chunk.usage) {
                lastUsage = chunk.usage;
            }
        }
    }
    catch (error) {
        if (error instanceof XAIError && error.statusCode === 408) {
            // Timeout - return partial response
            partial = true;
            console.error(`[grok_query] Stream timeout after ${chunksReceived} chunks`);
        }
        else {
            throw error;
        }
    }
    const responseTime = Date.now() - startTime;
    // Estimate tokens if not provided (for partial responses)
    const estimatedPromptTokens = Math.ceil((input.query.length + (input.context?.length || 0)) / 4);
    const estimatedCompletionTokens = Math.ceil(accumulatedContent.length / 4);
    const usage = lastUsage || {
        prompt_tokens: estimatedPromptTokens,
        completion_tokens: estimatedCompletionTokens,
        total_tokens: estimatedPromptTokens + estimatedCompletionTokens,
    };
    const cost = client.calculateCost(resolvedModel, usage.prompt_tokens, usage.completion_tokens);
    // Parse JSON if JSON mode was requested and response is complete (P4-016)
    const jsonResult = isJsonMode && !partial ? parseJsonResponse(accumulatedContent) : undefined;
    return {
        response: accumulatedContent + (partial ? '\n\n[Response truncated due to timeout]' : ''),
        model: resolvedModel,
        usage,
        cost,
        thinking: undefined,
        cached: false,
        response_time_ms: responseTime,
        partial,
        chunks_received: chunksReceived,
        json_result: jsonResult,
    };
}
/**
 * Format a GrokQueryResponse for MCP output with UX enhancements
 */
function formatResponse(result, options = {}) {
    const lines = [];
    // Main response header
    lines.push('🤖 **Grok:**');
    lines.push('');
    lines.push(result.response);
    lines.push('');
    lines.push('---');
    // Build status line with enhanced visibility
    const statusParts = [];
    // Cache badge (enhanced visibility)
    if (options.cacheInfo?.isCached) {
        if (options.cacheInfo.expiresIn !== undefined && options.cacheInfo.expiresIn > 0) {
            const mins = Math.ceil(options.cacheInfo.expiresIn / 60);
            statusParts.push(`📦 **CACHED** (${mins}m remaining)`);
        }
        else {
            statusParts.push('📦 **CACHED**');
        }
    }
    // Partial response indicator for streaming timeouts
    if (options.streamingInfo?.partial) {
        statusParts.push(`⚠️ **PARTIAL** (${options.streamingInfo.chunksReceived} chunks)`);
    }
    // Vision query badge (P4-015)
    if (options.isVisionQuery) {
        statusParts.push('🖼️ **VISION**');
    }
    // Model info with auto-selection explanation (P4-011 complexity scoring)
    if (options.originalModelInput === 'auto' && options.autoSelection) {
        const score = options.autoSelection.complexityScore;
        if (score) {
            // Compact format with complexity and confidence
            statusParts.push(`${result.model} (complexity: ${score.adjusted}%, confidence: ${score.confidence}%)`);
        }
        else {
            // Fallback if no complexity score (shouldn't happen with P4-011)
            const reasonMap = {
                code: 'code detected',
                reasoning: 'reasoning needed',
                complex: 'complex task',
                simple: 'simple query',
            };
            const reasonText = reasonMap[options.autoSelection.reason] || options.autoSelection.reason;
            statusParts.push(`${result.model} (auto: ${reasonText})`);
        }
    }
    else {
        statusParts.push(result.model);
    }
    // Token and cost info
    statusParts.push(`${result.usage.total_tokens} tokens`);
    statusParts.push(`$${result.cost.estimated_usd.toFixed(4)}`);
    statusParts.push(`${result.response_time_ms}ms`);
    lines.push(`⚡ *${statusParts.join(' • ')}*`);
    // JSON mode result indicator (P4-016)
    if (result.json_result) {
        lines.push('');
        if (result.json_result.json_valid) {
            lines.push('✅ **JSON Valid**');
        }
        else {
            lines.push(`⚠️ **JSON Parse Error**: ${result.json_result.parse_error}`);
        }
    }
    // UX Warnings Section (if any)
    const warnings = [];
    // Low confidence warning (P4-011) - when model selection is uncertain
    if (options.originalModelInput === 'auto' &&
        options.autoSelection?.complexityScore &&
        options.autoSelection.complexityScore.confidence < 50) {
        warnings.push(`⚠️ Low confidence (${options.autoSelection.complexityScore.confidence}%) - consider specifying model manually with \`--model\``);
    }
    // Budget warnings
    if (options.budgetInfo) {
        if (options.budgetInfo.usedPercent >= UX_THRESHOLDS.BUDGET_WARNING_LEVEL_2) {
            warnings.push(`⚠️ **Budget Alert**: ${options.budgetInfo.usedPercent.toFixed(0)}% used ($${options.budgetInfo.remainingUsd.toFixed(2)} of $${options.budgetInfo.limitUsd.toFixed(2)} remaining)`);
        }
        else if (options.budgetInfo.usedPercent >= UX_THRESHOLDS.BUDGET_WARNING_LEVEL_1) {
            warnings.push(`💰 Budget: ${options.budgetInfo.usedPercent.toFixed(0)}% used ($${options.budgetInfo.remainingUsd.toFixed(2)} remaining)`);
        }
    }
    // Cost savings tip (only for non-cached, expensive models)
    if (!options.cacheInfo?.isCached) {
        const alternatives = getCheaperAlternatives(result.model);
        if (alternatives.length > 0 && result.cost.estimated_usd > 0.01) {
            const altText = alternatives.map((a) => `\`${a.model}\` (${a.savings})`).join(' or ');
            warnings.push(`💡 **Tip**: For similar queries, try ${altText}`);
        }
    }
    if (warnings.length > 0) {
        lines.push('');
        lines.push(warnings.join('\n'));
    }
    return {
        content: [
            {
                type: 'text',
                text: lines.join('\n'),
            },
        ],
    };
}
/**
 * MCP tool handler for grok_query
 *
 * This is the main entry point called by the MCP server when
 * the grok_query tool is invoked.
 *
 * @param client - XAI client instance
 * @param args - Raw arguments from MCP tool call
 * @param services - Optional services for caching, cost tracking, and rate limiting
 * @returns MCP-formatted tool response
 */
export async function handleGrokQuery(client, args, services) {
    try {
        // Validate input (throws Tool Execution Error on failure)
        const input = validateGrokQueryInput(args);
        const originalModelInput = input.model || 'auto';
        // Capture auto-selection info for UX display
        let autoSelection;
        if (originalModelInput === 'auto') {
            autoSelection = client.selectAutoModel(input.query, input.context);
        }
        // Resolve model alias to actual model ID (with intelligent auto-selection)
        const resolvedModel = client.resolveModel(originalModelInput, input.query, input.context);
        // Check if streaming is enabled (skip cache for streaming)
        const streamingMode = input.stream === true;
        // 1. CHECK CACHE (before any API call) - skip for streaming
        let cacheKey;
        let cacheExpiresIn;
        const isJsonMode = input.response_format?.type === 'json_object';
        if (!streamingMode && services?.cache.isEnabled()) {
            // Include JSON mode in cache key to prevent mixing JSON/non-JSON responses (P4-016)
            const baseKey = services.cache.generateKey(input.query, resolvedModel, input.context);
            cacheKey = isJsonMode ? `${baseKey}:json` : baseKey;
            const cached = services.cache.get(cacheKey);
            if (cached) {
                console.error('[grok_query] Cache hit - returning cached response');
                // Calculate cache TTL remaining
                const expiresAt = services.cache.getExpiresAt(cacheKey);
                if (expiresAt) {
                    cacheExpiresIn = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
                }
                return formatResponse({ ...cached, cached: true }, {
                    autoSelection,
                    originalModelInput,
                    cacheInfo: { isCached: true, expiresIn: cacheExpiresIn },
                    isVisionQuery: !!input.image_url,
                });
            }
        }
        // Estimate tokens for budget and rate limiting
        const estimatedInputTokens = Math.ceil((input.query.length + (input.context?.length || 0)) / 4);
        const estimatedOutputTokens = input.max_tokens || 4096;
        // 2. CHECK BUDGET (estimate cost before call)
        if (services?.costTracker) {
            const estimatedCost = CostTracker.estimateCost(resolvedModel, estimatedInputTokens, estimatedOutputTokens);
            services.costTracker.checkBudget(estimatedCost); // throws if over budget
        }
        // 3. ACQUIRE RATE LIMIT
        if (services?.rateLimiter) {
            await services.rateLimiter.acquire(estimatedInputTokens);
        }
        try {
            // 4. EXECUTE QUERY (streaming or non-streaming)
            let result;
            let streamingInfo;
            if (streamingMode) {
                const streamResult = await executeGrokQueryStreaming(client, input);
                result = streamResult;
                streamingInfo = {
                    partial: streamResult.partial,
                    chunksReceived: streamResult.chunks_received,
                };
            }
            else {
                result = await executeGrokQuery(client, input);
            }
            // 5. RECORD ACTUAL USAGE
            if (services?.rateLimiter) {
                services.rateLimiter.recordUsage(result.usage.total_tokens, estimatedInputTokens);
                services.rateLimiter.clearBackoff();
            }
            // 6. TRACK COST
            if (services?.costTracker) {
                services.costTracker.addFromEstimate(result.cost);
            }
            // 7. CACHE RESPONSE (skip for streaming - partial responses shouldn't be cached)
            if (!streamingMode && services?.cache.isEnabled() && cacheKey) {
                services.cache.set(cacheKey, result);
            }
            // 8. GATHER UX INFO FOR RESPONSE
            let budgetInfo;
            if (services?.costTracker) {
                const opts = services.costTracker.getOptions();
                const totalCost = services.costTracker.getTotalCost();
                const remaining = services.costTracker.getRemainingBudget();
                const usedPercent = opts.limitUsd > 0 ? (totalCost / opts.limitUsd) * 100 : 0;
                budgetInfo = {
                    usedPercent,
                    remainingUsd: remaining,
                    limitUsd: opts.limitUsd,
                };
            }
            return formatResponse(result, {
                autoSelection,
                originalModelInput,
                cacheInfo: { isCached: false },
                budgetInfo,
                expensiveQueryWarning: result.cost.estimated_usd > UX_THRESHOLDS.EXPENSIVE_QUERY_COST,
                streamingInfo,
                isVisionQuery: !!input.image_url,
            });
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
        // Return Tool Execution Error per MCP spec
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return {
            content: [
                {
                    type: 'text',
                    text: `Error: ${errorMessage}`,
                },
            ],
        };
    }
}
//# sourceMappingURL=query.js.map
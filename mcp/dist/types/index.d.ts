/**
 * Grok MCP Plugin - Type Definitions
 *
 * Types for xAI API integration and MCP tool responses.
 * Based on xAI API documentation as of January 2026.
 */
/**
 * Text content part for multimodal messages (Vision Support - P4-015)
 */
export interface TextContentPart {
    type: 'text';
    text: string;
}
/**
 * Image URL details for vision queries (Vision Support - P4-015)
 */
export interface ImageUrlDetails {
    /** URL to the image (HTTPS or data: URI for base64) */
    url: string;
    /** Detail level for image analysis (optional) */
    detail?: 'auto' | 'low' | 'high';
}
/**
 * Image URL content part for multimodal messages (Vision Support - P4-015)
 */
export interface ImageUrlContentPart {
    type: 'image_url';
    image_url: ImageUrlDetails;
}
/**
 * Union type for all content parts in multimodal messages
 */
export type MessageContentPart = TextContentPart | ImageUrlContentPart;
/**
 * Message content can be either a string (text-only) or an array of content parts (multimodal)
 */
export type MessageContent = string | MessageContentPart[];
/**
 * Chat message format for xAI API
 * Supports both text-only (string content) and multimodal (content array) formats
 */
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: MessageContent;
}
/**
 * Parameters for chat completion requests
 */
export interface ChatCompletionParams {
    model: string;
    messages: ChatMessage[];
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    stream?: boolean;
    stop?: string | string[];
    /** Per-request timeout override in milliseconds */
    timeout?: number;
}
/**
 * Token usage information from API response
 */
export interface TokenUsage {
    prompt_tokens: number;
    completion_tokens: number;
    reasoning_tokens?: number;
    total_tokens: number;
}
/**
 * Chat completion choice from API response
 */
export interface ChatCompletionChoice {
    index: number;
    message: ChatMessage;
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
}
/**
 * Full chat completion response from xAI API
 */
export interface ChatCompletionResponse {
    id: string;
    object: 'chat.completion';
    created: number;
    model: string;
    choices: ChatCompletionChoice[];
    usage: TokenUsage;
}
/**
 * Single chunk from streaming chat completion
 * Per xAI SSE format: data: {"id":"...","choices":[{"delta":{"content":"..."}}]}
 */
export interface ChatCompletionStreamChunk {
    id: string;
    object: 'chat.completion.chunk';
    created: number;
    model: string;
    choices: Array<{
        index: number;
        delta: {
            role?: 'assistant';
            content?: string;
        };
        finish_reason: 'stop' | 'length' | null;
    }>;
    /** Only present on final chunk */
    usage?: TokenUsage;
}
/**
 * Single model information from /v1/language-models
 */
export interface ModelInfo {
    id: string;
    object: 'model';
    created: number;
    owned_by: string;
    context_window?: number;
    capabilities?: string[];
}
/**
 * Response from /v1/language-models endpoint
 */
export interface ModelsResponse {
    object: 'list';
    data: ModelInfo[];
}
/**
 * Configuration options for XAIClient
 */
export interface XAIClientOptions {
    apiKey: string;
    baseUrl?: string;
    timeout?: number;
    maxRetries?: number;
}
/**
 * Custom error class for xAI API errors
 *
 * SECURITY: responseBody is private to prevent leaking sensitive API details
 * when errors are logged or returned to users.
 */
export declare class XAIError extends Error {
    readonly statusCode: number;
    readonly statusText: string;
    private readonly _responseBody?;
    constructor(message: string, statusCode: number, statusText: string, responseBody?: string);
    /**
     * Safe error details for user-facing messages
     * Does NOT include response body to prevent leaking sensitive API details
     */
    getSanitizedMessage(): string;
    /**
     * Full details for internal logging only
     * SECURITY: Only use for internal debugging, never expose to users
     */
    getDebugInfo(): string;
    /**
     * Check if the response body contains specific text (for error handling)
     * Does not expose the actual body content
     */
    hasResponseBodyContaining(text: string): boolean;
}
/**
 * User-friendly model aliases mapped to actual model IDs
 * Updated: January 9, 2026
 */
export type ModelAlias = 'auto' | 'default' | 'fast' | 'smartest' | 'code' | 'reasoning' | 'cheap' | 'vision' | 'image';
/**
 * Model alias resolution map
 * Updated: January 9, 2026 - Verified against live xAI API
 */
export declare const MODEL_ALIASES: Record<ModelAlias, string>;
/**
 * Fallback chain for deprecated/unavailable models
 * Maps old model names to current equivalents
 */
export declare const MODEL_FALLBACKS: Record<string, string>;
/**
 * Models that support vision/image input (P4-015)
 */
export declare const VISION_CAPABLE_MODELS: readonly string[];
/**
 * Model pricing per 1M tokens (USD)
 * Updated: January 9, 2026 - Verified against xAI API
 */
export declare const MODEL_PRICING: Record<string, {
    input: number;
    output: number;
}>;
/**
 * Weight tiers for indicator scoring (P4-011)
 * Higher weight = more decisive signal for model selection
 */
export declare const WEIGHT_TIERS: {
    readonly DEFINITIVE: 15;
    readonly STRONG: 10;
    readonly MODERATE: 5;
    readonly WEAK: 2;
};
/**
 * Weighted indicator with score for complexity calculation
 */
export interface WeightedIndicator {
    pattern: string;
    weight: number;
}
/**
 * Complexity score breakdown for model selection (P4-011)
 */
export interface ComplexityScore {
    /** Raw score before multipliers (0-100) */
    raw: number;
    /** Adjusted score after length/context multipliers (0-100) */
    adjusted: number;
    /** Confidence in the classification (0-100%) */
    confidence: number;
    /** Primary category detected */
    category: 'code' | 'reasoning' | 'complex' | 'simple';
    /** Detailed breakdown for debugging/display */
    breakdown: {
        codeScore: number;
        reasoningScore: number;
        complexityScore: number;
        simplicityPenalty: number;
        lengthMultiplier: number;
        contextMultiplier: number;
    };
    /** Matched indicators for logging */
    matchedIndicators: string[];
}
/**
 * Simplicity indicators that reduce complexity score (P4-011)
 * When users explicitly want brief/simple output
 */
export declare const SIMPLICITY_INDICATORS: readonly string[];
/**
 * Code-related indicators that suggest using grok-code-fast-1
 * Includes programming keywords, language names, and code analysis terms
 */
export declare const CODE_INDICATORS: readonly string[];
/**
 * Reasoning-related indicators that suggest using grok-4-1-fast-reasoning
 * Includes step-by-step thinking, proofs, and logical analysis
 */
export declare const REASONING_INDICATORS: readonly string[];
/**
 * Complexity indicators that suggest using grok-4-0709 (flagship)
 * Includes architectural decisions, deep analysis, and creative tasks
 */
export declare const COMPLEXITY_INDICATORS: readonly string[];
/**
 * Result of intelligent model selection
 */
export interface AutoModelSelection {
    /** The selected model ID */
    model: string;
    /** Why this model was selected */
    reason: 'code' | 'reasoning' | 'complex' | 'simple';
    /** Matched indicators (for logging/debugging) */
    matchedIndicators: string[];
    /** Complexity score (P4-011) - available when using auto selection */
    complexityScore?: ComplexityScore;
}
/**
 * Code indicators with weights based on specificity
 * Higher weight = more decisive signal for code model selection
 */
export declare const CODE_WEIGHTS: readonly WeightedIndicator[];
/**
 * Reasoning indicators with weights based on specificity
 * Higher weight = more decisive signal for reasoning model selection
 */
export declare const REASONING_WEIGHTS: readonly WeightedIndicator[];
/**
 * Complexity indicators with weights based on specificity
 * Higher weight = more decisive signal for flagship model selection
 */
export declare const COMPLEXITY_WEIGHTS: readonly WeightedIndicator[];
/**
 * Cost breakdown for a query
 */
export interface CostEstimate {
    estimated_usd: number;
    input_tokens: number;
    output_tokens: number;
    model: string;
    pricing: {
        input_per_1m: number;
        output_per_1m: number;
    };
}
/**
 * Response from grok_query tool
 */
export interface GrokQueryResponse {
    response: string;
    model: string;
    usage: TokenUsage;
    cost: CostEstimate;
    thinking?: string;
    cached: boolean;
    response_time_ms: number;
    /** JSON parsing metadata (only present when response_format was used) */
    json_result?: JsonParseResult;
}
/**
 * Response from streaming grok_query (extends standard response)
 */
export interface StreamingGrokQueryResponse extends GrokQueryResponse {
    /** True if response was cut off due to timeout */
    partial: boolean;
    /** Number of chunks received before completion/timeout */
    chunks_received: number;
}
/**
 * Enhanced model info for grok_models tool response
 */
export interface GrokModelInfo {
    id: string;
    alias?: ModelAlias;
    context_window: number;
    capabilities: string[];
    pricing: {
        input_per_1m: number;
        output_per_1m: number;
    };
    status: 'available' | 'deprecated' | 'unknown';
    recommended_for?: string[];
}
/**
 * Response from grok_models tool
 */
export interface GrokModelsResponse {
    models: GrokModelInfo[];
    recommended: {
        general: string;
        fast: string;
        code: string;
        reasoning: string;
    };
    cached: boolean;
    cache_expires_at?: string;
}
/**
 * Input parameters for grok_query tool
 */
/**
 * Response format for grok_query JSON mode (P4-016)
 * Compatible with OpenAI's response_format parameter
 */
export interface ResponseFormat {
    /** Output format type. Currently only "json_object" is supported */
    type: 'json_object';
}
/**
 * JSON parsing result metadata (P4-016)
 */
export interface JsonParseResult {
    /** Whether the response was valid JSON */
    json_valid: boolean;
    /** Parsed JSON object (if valid) */
    parsed?: unknown;
    /** Error message (if parsing failed) */
    parse_error?: string;
}
export interface GrokQueryInput {
    query: string;
    model?: string;
    context?: string;
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    stream?: boolean;
    timeout?: number;
    /** Image URL for vision queries (HTTPS or base64 data URI) - P4-015 */
    image_url?: string;
    /** Image detail level for vision queries - P4-015 */
    image_detail?: 'auto' | 'low' | 'high';
    /** Response format - when set to json_object, instructs Grok to return valid JSON */
    response_format?: ResponseFormat;
}
/**
 * Input parameters for grok_models tool
 */
export interface GrokModelsInput {
    refresh?: boolean;
}
import type { ResponseCache } from '../services/cache.js';
import type { CostTracker } from '../services/cost-tracker.js';
import type { RateLimiter } from '../services/rate-limiter.js';
/**
 * Service instances passed to tool handlers
 */
export interface Services {
    cache: ResponseCache;
    costTracker: CostTracker;
    rateLimiter: RateLimiter;
}
/**
 * API tier configuration
 */
export type APITier = 'standard' | 'enterprise';
/**
 * Rate limit configuration by tier
 */
export declare const RATE_LIMITS: Record<APITier, {
    tokensPerMinute: number;
    requestsPerMinute: number;
}>;
/**
 * Web search tool configuration
 */
export interface WebSearchConfig {
    type: 'web_search';
    /** Restrict searches to specific domains (max 5) */
    allowed_domains?: string[];
    /** Exclude specific domains from search (max 5) */
    excluded_domains?: string[];
    /** Enable image understanding in web pages */
    enable_image_understanding?: boolean;
}
/**
 * X (Twitter) search tool configuration
 */
export interface XSearchConfig {
    type: 'x_search';
    /** Limit results to specific X accounts (max 10) */
    allowed_x_handles?: string[];
    /** Exclude specific X accounts (max 10) */
    excluded_x_handles?: string[];
    /** Filter results from this date (ISO8601) */
    from_date?: string;
    /** Filter results to this date (ISO8601) */
    to_date?: string;
    /** Enable image understanding in posts */
    enable_image_understanding?: boolean;
    /** Enable video understanding in posts */
    enable_video_understanding?: boolean;
}
/**
 * Agent tool definition for API requests
 */
export type AgentToolDefinition = WebSearchConfig | XSearchConfig | CodeExecutionConfig;
/**
 * Input message format for Agent Tools API
 */
export interface AgentInputMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}
/**
 * Parameters for Agent Tools API requests (POST /v1/responses)
 */
export interface AgentToolsParams {
    model: string;
    input: AgentInputMessage[];
    tools?: AgentToolDefinition[];
    /** Maximum number of assistant turns (1-2 quick, 3-5 balanced, 10+ deep) */
    max_turns?: number;
    /** Sampling temperature (0-2) */
    temperature?: number;
    /** Top-p sampling */
    top_p?: number;
    /** Include options for response */
    include?: Array<'inline_citations' | 'verbose_streaming' | 'web_search_call_output' | 'x_search_call_output' | 'code_interpreter_call.outputs'>;
}
/**
 * Citation in agent response
 */
export interface AgentCitation {
    /** Source URL */
    url: string;
    /** Source title */
    title?: string;
    /** Type of source */
    type?: 'web' | 'x_post' | 'x_thread';
}
/**
 * Inline citation reference
 */
export interface AgentInlineCitation {
    id: number;
    start_index: number;
    end_index: number;
    web_citation?: {
        url: string;
        title?: string;
    };
    x_citation?: {
        post_id: string;
        handle?: string;
    };
}
/**
 * Server-side tool usage metrics
 */
export interface ServerSideToolUsage {
    SERVER_SIDE_TOOL_WEB_SEARCH?: number;
    SERVER_SIDE_TOOL_X_SEARCH?: number;
    SERVER_SIDE_TOOL_CODE_EXECUTION?: number;
}
/**
 * Tool call information from agent response
 */
export interface AgentToolCall {
    id: string;
    type: 'function_call' | 'web_search_call' | 'x_search_call' | 'code_interpreter_call';
    function?: {
        name: string;
        arguments: string;
    };
}
/**
 * Token usage for agent responses
 * Note: xAI API may return either prompt_tokens/completion_tokens OR input_tokens/output_tokens
 * depending on the API version and endpoint. Both should be handled.
 */
export interface AgentTokenUsage {
    prompt_tokens?: number;
    completion_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
    reasoning_tokens?: number;
    total_tokens: number;
    cached_prompt_text_tokens?: number;
    prompt_image_tokens?: number;
    prompt_text_tokens?: number;
}
/**
 * Response from Agent Tools API (POST /v1/responses)
 */
export interface AgentToolsResponse {
    id: string;
    object: 'response';
    created: number;
    model: string;
    /** The response content (may be null/undefined in some cases) */
    content?: string | null;
    /** Token usage breakdown */
    usage: AgentTokenUsage;
    /** All citations encountered */
    citations: AgentCitation[];
    /** Inline citations (if include: ['inline_citations']) */
    inline_citations?: AgentInlineCitation[];
    /** Server-side tool execution counts (billable) */
    server_side_tool_usage: ServerSideToolUsage;
    /** All tool calls attempted (including failures) */
    tool_calls?: AgentToolCall[];
    /** Stop reason */
    stop_reason?: 'end_turn' | 'max_turns' | 'tool_use';
}
/**
 * Input parameters for grok_search_x tool
 */
export interface GrokSearchXInput {
    /** The search query */
    query: string;
    /** Enable web search (default: false) */
    enable_web_search?: boolean;
    /** Enable X/Twitter search (default: true) */
    enable_x_search?: boolean;
    /** Maximum assistant turns (default: 3, range: 1-10) */
    max_turns?: number;
    /** X search: limit to specific handles */
    x_handles?: string[];
    /** X search: exclude specific handles */
    exclude_x_handles?: string[];
    /** X search: filter from date (ISO8601) */
    from_date?: string;
    /** X search: filter to date (ISO8601) */
    to_date?: string;
    /** Web search: limit to specific domains */
    domains?: string[];
    /** Web search: exclude specific domains */
    exclude_domains?: string[];
    /** Return raw citations instead of summary (default: false) */
    include_citations?: boolean;
}
/**
 * Response from grok_search_x tool
 */
export interface GrokSearchXResponse {
    /** Summarized response (privacy: no verbatim reproduction, may be null if API returns no content) */
    response?: string | null;
    /** Model used */
    model: string;
    /** Token usage */
    usage: AgentTokenUsage;
    /** Cost estimate */
    cost: CostEstimate;
    /** Citations from search */
    citations: AgentCitation[];
    /** Tool usage counts */
    tool_usage: ServerSideToolUsage;
    /** Response time in milliseconds */
    response_time_ms: number;
}
/**
 * Code execution tool configuration for Agent Tools API
 */
export interface CodeExecutionConfig {
    type: 'code_interpreter';
}
/**
 * Input parameters for grok_execute_code tool
 */
export interface GrokExecuteCodeInput {
    /** Python code to execute (1-50,000 chars) */
    code: string;
    /** Description of what the code should accomplish */
    description?: string;
    /** Include raw stdout/stderr in response (default: true) */
    include_output?: boolean;
    /** Maximum execution iterations (1-10, default: 3) */
    max_turns?: number;
    /** Model to use (default: grok-4-1-fast) */
    model?: string;
}
/**
 * Response from grok_execute_code tool
 */
export interface GrokExecuteCodeResponse {
    /** Grok's explanation of the results */
    response: string;
    /** Raw execution output (stdout/stderr) */
    execution_output?: string;
    /** Whether execution encountered errors */
    has_error: boolean;
    /** Model used */
    model: string;
    /** Token usage */
    usage: AgentTokenUsage;
    /** Cost estimate */
    cost: CostEstimate;
    /** Tool usage counts */
    tool_usage: ServerSideToolUsage;
    /** Response time in milliseconds */
    response_time_ms: number;
}
/**
 * Response format for image generation
 */
export type ImageResponseFormat = 'url' | 'b64_json';
/**
 * Parameters for image generation API requests
 */
export interface ImageGenerationParams {
    /** Model to use for image generation */
    model: string;
    /** Text description of the image to generate */
    prompt: string;
    /** Number of images to generate (1-10, default: 1) */
    n?: number;
    /** Response format: 'url' returns URLs, 'b64_json' returns base64 data */
    response_format?: ImageResponseFormat;
}
/**
 * Input parameters for grok_generate_image tool
 */
export interface GrokGenerateImageInput {
    /** Text description of the image to generate (required) */
    prompt: string;
    /** Number of images to generate (1-10, default: 1) */
    n?: number;
    /** Response format: 'url' (default, temporary URLs) or 'b64_json' (base64 data) */
    response_format?: ImageResponseFormat;
    /** Model to use (default: grok-2-image-1212) */
    model?: string;
}
/**
 * Single generated image from xAI API
 */
export interface GeneratedImage {
    /** Image URL (when response_format is 'url') */
    url?: string;
    /** Base64 encoded image data (when response_format is 'b64_json') */
    b64_json?: string;
    /** Revised prompt if the model modified the input prompt for safety/clarity */
    revised_prompt?: string;
}
/**
 * Raw response from xAI Image Generation API
 */
export interface ImageGenerationAPIResponse {
    /** Unix timestamp of creation */
    created: number;
    /** Array of generated images */
    data: GeneratedImage[];
}
/**
 * Response from grok_generate_image tool
 */
export interface GrokGenerateImageResponse {
    /** Array of generated images */
    images: GeneratedImage[];
    /** Number of images generated */
    count: number;
    /** Model used */
    model: string;
    /** Cost estimate */
    cost: CostEstimate;
    /** Response time in milliseconds */
    response_time_ms: number;
    /** Warning about URL expiration (if response_format is 'url') */
    url_expiration_notice?: string;
}
//# sourceMappingURL=index.d.ts.map
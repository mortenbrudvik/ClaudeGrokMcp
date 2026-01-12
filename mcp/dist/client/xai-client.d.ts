/**
 * xAI API Client
 *
 * Handles communication with xAI's REST API for Grok models.
 * Base URL: https://api.x.ai/v1
 *
 * SECURITY: API keys are never logged, even in debug mode.
 */
import { ChatCompletionParams, ChatCompletionResponse, ChatCompletionStreamChunk, ModelsResponse, XAIClientOptions, type CostEstimate, type AutoModelSelection, type ComplexityScore, AgentToolsParams, AgentToolsResponse, ImageGenerationParams, ImageGenerationAPIResponse } from '../types/index.js';
export declare const DEFAULT_TIMEOUT = 30000;
export declare const SLOW_MODEL_TIMEOUT = 90000;
/**
 * Get appropriate timeout for a model based on its speed characteristics.
 * Flagship grok-4 models are significantly slower than fast variants.
 *
 * @param model - Resolved model ID (not alias)
 * @param requestTimeout - User-specified timeout (takes precedence)
 * @param instanceTimeout - Client instance default timeout
 * @returns Effective timeout in milliseconds
 */
export declare function getModelTimeout(model: string, requestTimeout?: number, instanceTimeout?: number): number;
/**
 * Client for interacting with xAI's Grok API
 */
export declare class XAIClient {
    private readonly apiKey;
    private readonly baseUrl;
    private readonly timeout;
    private readonly maxRetries;
    private modelsCache;
    private modelsCacheExpiry;
    private readonly MODELS_CACHE_TTL;
    constructor(options: XAIClientOptions);
    /**
     * Validate API key format
     *
     * @param apiKey - The API key to validate
     * @throws Error if the API key is missing or has invalid format
     *
     * xAI API keys should start with 'xai-' prefix.
     */
    private static validateApiKeyFormat;
    /**
     * Resolve a model alias or ID to an actual model ID
     *
     * For 'auto' alias, uses intelligent selection based on query/context
     * when provided via selectAutoModel().
     *
     * @param modelInput - Model alias or ID
     * @param query - Optional query for intelligent auto selection
     * @param context - Optional context for intelligent auto selection
     */
    resolveModel(modelInput: string, query?: string, context?: string): string;
    /**
     * Intelligently select a model based on query content and context
     *
     * Uses weighted complexity scoring (P4-011) for nuanced model selection:
     * - Code tasks → grok-code-fast-1 (specialized, 10x cheaper)
     * - Reasoning tasks → grok-4-1-fast-reasoning (with thinking traces)
     * - Complex tasks → grok-4-0709 (flagship for complex tasks)
     * - Simple tasks → grok-4-fast-non-reasoning (fast, 15x cheaper)
     *
     * @param query - The user's query text
     * @param context - Optional system context
     * @returns AutoModelSelection with model ID, reason, matched indicators, and complexity score
     */
    selectAutoModel(query: string, context?: string): AutoModelSelection;
    /**
     * Calculate query complexity score for intelligent model selection
     *
     * Uses weighted indicator matching, query length, and context size
     * to produce a 0-100 complexity score with confidence metrics.
     *
     * @param query - The user's query text
     * @param context - Optional system context
     * @returns ComplexityScore with raw/adjusted scores, confidence, and breakdown
     */
    calculateComplexityScore(query: string, context?: string): ComplexityScore;
    /**
     * Sum weighted matches for a category
     */
    private sumWeightedMatches;
    /**
     * Check if text matches an indicator using word boundary matching
     */
    private matchesIndicator;
    /**
     * Count simplicity indicators in query
     */
    private countSimplicityMatches;
    /**
     * Determine the primary category based on scores
     */
    private determineCategory;
    /**
     * Calculate confidence in the classification (0-100%)
     *
     * Higher confidence when there's a clear winner among categories.
     * Lower confidence when multiple categories have similar scores.
     */
    private calculateConfidence;
    /**
     * Get query length multiplier for complexity scoring
     *
     * Short queries are typically simpler; long queries are more complex.
     */
    private getQueryLengthMultiplier;
    /**
     * Get context size multiplier for complexity scoring
     *
     * Large contexts demand more sophisticated processing.
     */
    private getContextSizeMultiplier;
    /**
     * Select model based on complexity score
     *
     * Uses category-specific routing for code/reasoning,
     * score-based routing for complex category.
     */
    selectModelFromScore(score: ComplexityScore): string;
    /**
     * Calculate cost estimate for a completion
     */
    calculateCost(model: string, inputTokens: number, outputTokens: number): CostEstimate;
    /**
     * Make an HTTP request to the xAI API
     *
     * @param method - HTTP method
     * @param endpoint - API endpoint
     * @param body - Request body
     * @param retryCount - Current retry count (for exponential backoff)
     * @param requestTimeout - Per-request timeout override
     */
    private request;
    /**
     * Sleep utility for retry backoff
     */
    private sleep;
    /**
     * Send a chat completion request
     * Endpoint: POST /v1/chat/completions
     *
     * @param params - Chat completion parameters including optional timeout override
     */
    chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResponse>;
    /**
     * Send a streaming chat completion request
     * Endpoint: POST /v1/chat/completions with stream: true
     *
     * Yields ChatCompletionStreamChunk for each SSE event.
     * Use this for real-time response streaming with partial response support on timeout.
     *
     * @param params - Chat completion parameters (stream is forced to true)
     * @yields ChatCompletionStreamChunk for each SSE delta
     */
    chatCompletionStream(params: Omit<ChatCompletionParams, 'stream'>): AsyncGenerator<ChatCompletionStreamChunk, void, unknown>;
    /**
     * List available language models
     * Endpoint: GET /v1/models
     *
     * Results are cached for 1 hour to reduce API calls
     */
    listModels(forceRefresh?: boolean): Promise<ModelsResponse>;
    /**
     * Validate API key by making a simple request
     * Used for the P1-005a spike task
     */
    validateApiKey(): Promise<boolean>;
    /**
     * Get cache expiry time for models list
     */
    getModelsCacheExpiry(): Date | null;
    /**
     * Check if models are currently cached
     */
    isModelsCached(): boolean;
    /**
     * Create an Agent Tools response (for grok_search_x)
     * Endpoint: POST /v1/responses
     *
     * Uses server-side agentic tool calling where Grok autonomously
     * manages the tool execution loop for web and X searches.
     *
     * @param params - Agent tools parameters
     * @returns Agent tools response with citations and tool usage
     */
    responsesCreate(params: AgentToolsParams): Promise<AgentToolsResponse>;
    /**
     * Generate images using xAI's Image Generation API
     * Endpoint: POST /v1/images/generations
     *
     * Uses grok-2-image-1212 model to generate JPEG images from text prompts.
     * Rate limit: 5 requests per second.
     *
     * @param params - Image generation parameters
     * @returns Image generation response with URLs or base64 data
     */
    generateImage(params: ImageGenerationParams): Promise<ImageGenerationAPIResponse>;
    /**
     * Calculate cost estimate for image generation
     *
     * Image generation pricing is based on output tokens equivalent.
     * Approximate: ~$0.003 per image for grok-2-image-1212.
     *
     * @param model - Model ID (e.g., 'grok-2-image-1212')
     * @param imageCount - Number of images generated
     * @returns Cost estimate
     */
    calculateImageCost(model: string, imageCount: number): CostEstimate;
}
/**
 * Create a new XAIClient instance from environment variables
 *
 * Validates API key format before creating client.
 */
export declare function createClient(): XAIClient;
//# sourceMappingURL=xai-client.d.ts.map
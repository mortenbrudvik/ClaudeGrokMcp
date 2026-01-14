/**
 * xAI API Client
 *
 * Handles communication with xAI's REST API for Grok models.
 * Base URL: https://api.x.ai/v1
 *
 * SECURITY: API keys are never logged, even in debug mode.
 */

import {
  ChatCompletionParams,
  ChatCompletionResponse,
  ChatCompletionStreamChunk,
  ModelsResponse,
  XAIClientOptions,
  XAIError,
  MODEL_PRICING,
  MODEL_FALLBACKS,
  MODEL_ALIASES,
  CODE_WEIGHTS,
  REASONING_WEIGHTS,
  COMPLEXITY_WEIGHTS,
  SIMPLICITY_INDICATORS,
  WEIGHT_TIERS,
  type ModelAlias,
  type CostEstimate,
  type AutoModelSelection,
  type ComplexityScore,
  type WeightedIndicator,
  AgentToolsParams,
  AgentToolsResponse,
  ImageGenerationParams,
  ImageGenerationAPIResponse,
} from '../types/index.js';

const DEFAULT_BASE_URL = 'https://api.x.ai/v1';
export const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_MAX_RETRIES = 2;
export const SLOW_MODEL_TIMEOUT = 90000; // 90 seconds for flagship grok-4

/**
 * Get appropriate timeout for a model based on its speed characteristics.
 * Flagship grok-4 models are significantly slower than fast variants.
 *
 * @param model - Resolved model ID (not alias)
 * @param requestTimeout - User-specified timeout (takes precedence)
 * @param instanceTimeout - Client instance default timeout
 * @returns Effective timeout in milliseconds
 */
export function getModelTimeout(
  model: string,
  requestTimeout?: number,
  instanceTimeout: number = DEFAULT_TIMEOUT
): number {
  // User-specified timeout always takes precedence
  if (requestTimeout !== undefined) return requestTimeout;

  // Fast models and vision get standard timeout
  if (model.includes('-fast') || model.includes('-vision')) {
    return instanceTimeout;
  }

  // Flagship grok-4 variants (without -fast suffix) are slow
  if (model.startsWith('grok-4') && !model.includes('-fast')) {
    return SLOW_MODEL_TIMEOUT;
  }

  return instanceTimeout;
}

/**
 * Client for interacting with xAI's Grok API
 */
export class XAIClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;

  // Models cache
  private modelsCache: ModelsResponse | null = null;
  private modelsCacheExpiry: number = 0;
  private readonly MODELS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

  constructor(options: XAIClientOptions) {
    XAIClient.validateApiKeyFormat(options.apiKey);

    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl || DEFAULT_BASE_URL;
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  /**
   * Validate API key format
   *
   * @param apiKey - The API key to validate
   * @throws Error if the API key is missing or has invalid format
   *
   * xAI API keys should start with 'xai-' prefix.
   */
  private static validateApiKeyFormat(apiKey: string | undefined): void {
    if (!apiKey) {
      throw new Error('XAI_API_KEY is required. ' + 'Get your API key from https://console.x.ai/');
    }

    if (!apiKey.startsWith('xai-')) {
      throw new Error(
        'XAI_API_KEY must start with "xai-" prefix. ' +
          'Get your API key from https://console.x.ai/'
      );
    }

    // xAI keys are typically longer than 20 characters
    if (apiKey.length < 20) {
      throw new Error('XAI_API_KEY appears to be invalid (too short)');
    }
  }

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
  resolveModel(modelInput: string, query?: string, context?: string): string {
    // For 'auto' alias with query provided, use intelligent selection
    if (modelInput === 'auto' && query) {
      const selection = this.selectAutoModel(query, context);
      console.error(`[XAI] Auto-selected model: ${selection.model} (reason: ${selection.reason})`);
      return selection.model;
    }

    // Check if it's an alias
    if (modelInput in MODEL_ALIASES) {
      return MODEL_ALIASES[modelInput as ModelAlias];
    }

    // Check if it needs fallback
    if (modelInput in MODEL_FALLBACKS) {
      return MODEL_FALLBACKS[modelInput];
    }

    // Return as-is (assume it's a valid model ID)
    return modelInput;
  }

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
  selectAutoModel(query: string, context?: string): AutoModelSelection {
    // Calculate complexity score using P4-011 weighted scoring
    const complexityScore = this.calculateComplexityScore(query, context);

    // Select model based on score and confidence
    const model = this.selectModelFromScore(complexityScore);

    return {
      model,
      reason: complexityScore.category,
      matchedIndicators: complexityScore.matchedIndicators,
      complexityScore,
    };
  }

  // ===========================================================================
  // Complexity Scoring (P4-011)
  // ===========================================================================

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
  calculateComplexityScore(query: string, context?: string): ComplexityScore {
    const combinedText = (query + ' ' + (context || '')).toLowerCase();

    // Calculate weighted scores for each category
    const codeResult = this.sumWeightedMatches(combinedText, CODE_WEIGHTS);
    const reasoningResult = this.sumWeightedMatches(combinedText, REASONING_WEIGHTS);
    const complexityResult = this.sumWeightedMatches(combinedText, COMPLEXITY_WEIGHTS);

    // Check for code blocks in context (adds DEFINITIVE weight)
    const hasCodeBlocks =
      context?.includes('```') ||
      context?.includes('function ') ||
      context?.includes('class ') ||
      /\b(const|let|var)\s+\w+\s*=/.test(context || '');

    let codeScore = codeResult.score;
    const codeMatches = [...codeResult.matches];

    if (hasCodeBlocks) {
      codeScore += WEIGHT_TIERS.DEFINITIVE;
      codeMatches.unshift('[code block detected]');
    }

    const reasoningScore = reasoningResult.score;
    const complexityScore = complexityResult.score;

    // Calculate simplicity penalty
    const simplicityPenalty = this.countSimplicityMatches(query) * -20;

    // Determine category based on highest score
    const scores = { code: codeScore, reasoning: reasoningScore, complex: complexityScore };
    const category = this.determineCategory(scores);

    // Get the max score for raw calculation
    const maxScore = Math.max(codeScore, reasoningScore, complexityScore);

    // Calculate raw score (0-100 scale, capped)
    const raw = Math.min(100, Math.max(0, maxScore + simplicityPenalty));

    // Apply multipliers
    const lengthMultiplier = this.getQueryLengthMultiplier(query);
    const contextMultiplier = this.getContextSizeMultiplier(context);
    const adjusted = Math.min(100, Math.round(raw * lengthMultiplier * contextMultiplier));

    // Calculate confidence (how decisive is the classification?)
    const confidence = this.calculateConfidence(scores, category);

    // Collect all matched indicators
    const allMatches = [...codeMatches, ...reasoningResult.matches, ...complexityResult.matches];

    return {
      raw,
      adjusted,
      confidence,
      category,
      breakdown: {
        codeScore,
        reasoningScore,
        complexityScore,
        simplicityPenalty,
        lengthMultiplier,
        contextMultiplier,
      },
      matchedIndicators: allMatches,
    };
  }

  /**
   * Sum weighted matches for a category
   */
  private sumWeightedMatches(
    text: string,
    weights: readonly WeightedIndicator[]
  ): { score: number; matches: string[] } {
    let score = 0;
    const matches: string[] = [];

    for (const { pattern, weight } of weights) {
      if (this.matchesIndicator(text, pattern)) {
        score += weight;
        matches.push(pattern);
      }
    }

    return { score, matches };
  }

  /**
   * Check if text matches an indicator using word boundary matching
   */
  private matchesIndicator(text: string, indicator: string): boolean {
    const indicatorLower = indicator.toLowerCase();

    // For multi-word indicators, use includes
    if (indicatorLower.includes(' ')) {
      return text.includes(indicatorLower);
    }

    // For single-word indicators, use word boundary regex
    const escapeRegex = (str: string): string => {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };
    const escapedIndicator = escapeRegex(indicatorLower);
    const wordRegex = new RegExp(`\\b${escapedIndicator}\\b`, 'i');
    return wordRegex.test(text);
  }

  /**
   * Count simplicity indicators in query
   */
  private countSimplicityMatches(query: string): number {
    const queryLower = query.toLowerCase();
    let count = 0;

    for (const indicator of SIMPLICITY_INDICATORS) {
      if (this.matchesIndicator(queryLower, indicator)) {
        count++;
      }
    }

    // Cap at 2 to prevent excessive penalty
    return Math.min(count, 2);
  }

  /**
   * Determine the primary category based on scores
   */
  private determineCategory(scores: {
    code: number;
    reasoning: number;
    complex: number;
  }): 'code' | 'reasoning' | 'complex' | 'simple' {
    const { code, reasoning, complex } = scores;
    const maxScore = Math.max(code, reasoning, complex);

    if (maxScore === 0) return 'simple';

    // Priority order: code > reasoning > complex
    if (code === maxScore) return 'code';
    if (reasoning === maxScore) return 'reasoning';
    return 'complex';
  }

  /**
   * Calculate confidence in the classification (0-100%)
   *
   * Higher confidence when there's a clear winner among categories.
   * Lower confidence when multiple categories have similar scores.
   */
  private calculateConfidence(
    scores: { code: number; reasoning: number; complex: number },
    category: 'code' | 'reasoning' | 'complex' | 'simple'
  ): number {
    if (category === 'simple') {
      // For simple queries, confidence is based on absence of signals
      const totalScore = scores.code + scores.reasoning + scores.complex;
      if (totalScore === 0) return 100; // No signals = definitely simple
      return Math.max(0, 100 - totalScore * 5); // Reduce confidence as signals increase
    }

    const allScores = [scores.code, scores.reasoning, scores.complex];
    const sortedScores = [...allScores].sort((a, b) => b - a);
    const maxScore = sortedScores[0];
    const secondHighest = sortedScores[1];

    if (maxScore === 0) return 0;

    // Confidence based on margin between top score and runner-up
    // Base confidence of 50%, plus up to 50% based on margin
    const margin = (maxScore - secondHighest) / maxScore;
    const confidence = Math.min(100, Math.round(50 + margin * 50));

    return confidence;
  }

  /**
   * Get query length multiplier for complexity scoring
   *
   * Short queries are typically simpler; long queries are more complex.
   */
  private getQueryLengthMultiplier(query: string): number {
    const wordCount = query.split(/\s+/).filter((w) => w.length > 0).length;

    if (wordCount <= 5) return 0.7; // "What is X?" - reduce complexity
    if (wordCount <= 15) return 1.0; // Normal query
    if (wordCount <= 30) return 1.1; // Moderate detail
    if (wordCount <= 50) return 1.2; // Detailed requirements
    return 1.3; // Multi-part complex request
  }

  /**
   * Get context size multiplier for complexity scoring
   *
   * Large contexts demand more sophisticated processing.
   */
  private getContextSizeMultiplier(context?: string): number {
    if (!context) return 1.0;

    const charCount = context.length;

    if (charCount < 1000) return 1.0; // Small context
    if (charCount < 5000) return 1.1; // Medium context
    if (charCount < 20000) return 1.2; // Large context (code file)
    if (charCount < 100000) return 1.3; // Very large (multiple files)
    return 1.5; // Massive context (codebase)
  }

  /**
   * Select model based on complexity score
   *
   * Uses category-specific routing for code/reasoning,
   * score-based routing for complex category.
   */
  selectModelFromScore(score: ComplexityScore): string {
    const { adjusted, category } = score;

    // Category-specific routing for code and reasoning
    // These specialized models often outperform flagship on their domains
    if (category === 'code') return 'grok-code-fast-1';
    if (category === 'reasoning') return 'grok-4-1-fast-reasoning';

    // Score-based routing for complex category
    // Complex queries with meaningful indicators get flagship model
    // Threshold of 25 = DEFINITIVE(15) + STRONG(10) or similar combinations
    if (category === 'complex') {
      if (adjusted >= 25) return 'grok-4-0709'; // Complex → flagship
      // Low complexity still uses fast for cost efficiency
    }

    // Simple queries and lower complexity → fast (cheapest)
    return 'grok-4-fast-non-reasoning';
  }

  /**
   * Calculate cost estimate for a completion
   */
  calculateCost(model: string, inputTokens: number, outputTokens: number): CostEstimate {
    const pricing = MODEL_PRICING[model] || { input: 0, output: 0 };
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;

    return {
      estimated_usd: inputCost + outputCost,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      model,
      pricing: {
        input_per_1m: pricing.input,
        output_per_1m: pricing.output,
      },
    };
  }

  /**
   * Make an HTTP request to the xAI API
   *
   * @param method - HTTP method
   * @param endpoint - API endpoint
   * @param body - Request body
   * @param retryCount - Current retry count (for exponential backoff)
   * @param requestTimeout - Per-request timeout override
   */
  private async request<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    body?: unknown,
    retryCount = 0,
    requestTimeout?: number
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const effectiveTimeout = requestTimeout ?? this.timeout;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);

    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');

        // Handle rate limiting with retry
        if (response.status === 429 && retryCount < this.maxRetries) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
          const waitTime = Math.min(retryAfter * 1000, 30000) * Math.pow(2, retryCount);
          await this.sleep(waitTime);
          return this.request<T>(method, endpoint, body, retryCount + 1, requestTimeout);
        }

        throw new XAIError(
          `xAI API request failed: ${response.statusText}`,
          response.status,
          response.statusText,
          errorBody
        );
      }

      let data: T;
      try {
        data = (await response.json()) as T;
      } catch {
        throw new XAIError('Invalid JSON response from xAI API', response.status, 'Parse Error');
      }

      // Log response time (without sensitive data)
      console.error(`[XAI] ${method} ${endpoint} completed in ${responseTime}ms`);

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof XAIError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          // Retry on timeout with exponential backoff
          if (retryCount < this.maxRetries) {
            const waitTime = Math.min(1000 * Math.pow(2, retryCount), 30000);
            console.error(
              `[XAI] Request timeout after ${effectiveTimeout}ms, retrying (${retryCount + 1}/${this.maxRetries})...`
            );
            await this.sleep(waitTime);
            return this.request<T>(method, endpoint, body, retryCount + 1, requestTimeout);
          }
          throw new XAIError(
            `Request timeout after ${effectiveTimeout}ms (${this.maxRetries} retries exhausted)`,
            408,
            'Request Timeout'
          );
        }
        throw new XAIError(error.message, 500, 'Internal Error');
      }

      throw new XAIError('Unknown error occurred', 500, 'Internal Error');
    }
  }

  /**
   * Sleep utility for retry backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Send a chat completion request
   * Endpoint: POST /v1/chat/completions
   *
   * @param params - Chat completion parameters including optional timeout override
   */
  async chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResponse> {
    // Resolve model alias
    const resolvedModel = this.resolveModel(params.model);

    // Extract timeout from params (don't send to API)
    const { timeout: requestTimeout, ...apiParams } = params;

    // Use model-aware timeout (grok-4 flagship models get 90s default)
    const effectiveTimeout = getModelTimeout(resolvedModel, requestTimeout, this.timeout);

    const requestBody = {
      ...apiParams,
      model: resolvedModel,
    };

    // DEBUG: Log request body for vision queries (P4-015)
    const hasVisionContent = params.messages?.some((m) => Array.isArray(m.content));
    if (hasVisionContent) {
      console.error('[XAI DEBUG] Vision request:', JSON.stringify(requestBody, null, 2));
    }

    const response = await this.request<ChatCompletionResponse>(
      'POST',
      '/chat/completions',
      requestBody,
      0, // retryCount
      effectiveTimeout
    );

    return response;
  }

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
  async *chatCompletionStream(
    params: Omit<ChatCompletionParams, 'stream'>
  ): AsyncGenerator<ChatCompletionStreamChunk, void, unknown> {
    const resolvedModel = this.resolveModel(params.model);
    const { timeout: requestTimeout, ...apiParams } = params;

    // Use model-aware timeout (grok-4 flagship models get 90s default)
    const effectiveTimeout = getModelTimeout(resolvedModel, requestTimeout, this.timeout);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);

    const url = `${this.baseUrl}/chat/completions`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          ...apiParams,
          model: resolvedModel,
          stream: true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new XAIError(
          `xAI streaming request failed: ${response.statusText}`,
          response.status,
          response.statusText,
          errorBody
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new XAIError('No response body for streaming', 500, 'Internal Error');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') return;

              try {
                const chunk = JSON.parse(data) as ChatCompletionStreamChunk;
                yield chunk;
              } catch {
                // Skip malformed JSON - continue processing
                console.error('[XAI] Malformed SSE chunk, skipping');
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof XAIError) throw error;

      if (error instanceof Error && error.name === 'AbortError') {
        throw new XAIError(
          `Streaming request timeout after ${effectiveTimeout}ms`,
          408,
          'Request Timeout'
        );
      }

      throw new XAIError(
        error instanceof Error ? error.message : 'Unknown streaming error',
        500,
        'Internal Error'
      );
    }
  }

  /**
   * List available language models
   * Endpoint: GET /v1/models
   *
   * Results are cached for 1 hour to reduce API calls
   */
  async listModels(forceRefresh = false): Promise<ModelsResponse> {
    const now = Date.now();

    // Return cached results if valid
    if (!forceRefresh && this.modelsCache && now < this.modelsCacheExpiry) {
      console.error('[XAI] Returning cached models list');
      return this.modelsCache;
    }

    const response = await this.request<ModelsResponse>('GET', '/models');

    // Update cache
    this.modelsCache = response;
    this.modelsCacheExpiry = now + this.MODELS_CACHE_TTL;

    return response;
  }

  /**
   * Validate API key by making a simple request
   * Used for the P1-005a spike task
   */
  async validateApiKey(): Promise<boolean> {
    try {
      await this.listModels(true);
      return true;
    } catch (error) {
      if (error instanceof XAIError && error.statusCode === 401) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get cache expiry time for models list
   */
  getModelsCacheExpiry(): Date | null {
    if (this.modelsCacheExpiry === 0) {
      return null;
    }
    return new Date(this.modelsCacheExpiry);
  }

  /**
   * Check if models are currently cached
   */
  isModelsCached(): boolean {
    return this.modelsCache !== null && Date.now() < this.modelsCacheExpiry;
  }

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
  async responsesCreate(params: AgentToolsParams): Promise<AgentToolsResponse> {
    // Resolve model alias - grok-4-1-fast recommended for tool calling
    const resolvedModel = this.resolveModel(params.model);

    // Agent Tools API can take longer - use extended timeout
    // Minimum 60s for fast models, 90s for slow flagship models
    const isSlowModel = resolvedModel === 'grok-4' || resolvedModel === 'grok-4-non-reasoning';
    const effectiveTimeout = isSlowModel ? SLOW_MODEL_TIMEOUT : Math.max(this.timeout, 60000);

    const response = await this.request<AgentToolsResponse>(
      'POST',
      '/responses',
      {
        ...params,
        model: resolvedModel,
      },
      0, // retryCount
      effectiveTimeout
    );

    return response;
  }

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
  async generateImage(params: ImageGenerationParams): Promise<ImageGenerationAPIResponse> {
    // Resolve model alias (supports 'image' alias)
    const resolvedModel = this.resolveModel(params.model);

    const response = await this.request<ImageGenerationAPIResponse>('POST', '/images/generations', {
      model: resolvedModel,
      prompt: params.prompt,
      n: params.n,
      response_format: params.response_format,
    });

    return response;
  }

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
  calculateImageCost(model: string, imageCount: number): CostEstimate {
    // Image generation pricing: Based on output tokens equivalent
    // Estimated 300 tokens per image (approximate based on API behavior)
    const TOKENS_PER_IMAGE = 300;
    const pricing = MODEL_PRICING[model] || { input: 2.0, output: 10.0 };
    const outputCost = ((imageCount * TOKENS_PER_IMAGE) / 1_000_000) * pricing.output;

    return {
      estimated_usd: outputCost,
      input_tokens: 0, // Prompt tokens are minimal for image gen
      output_tokens: imageCount * TOKENS_PER_IMAGE,
      model,
      pricing: {
        input_per_1m: pricing.input,
        output_per_1m: pricing.output,
      },
    };
  }
}

/**
 * Create a new XAIClient instance from environment variables
 *
 * Validates API key format before creating client.
 */
export function createClient(): XAIClient {
  const apiKey = process.env.XAI_API_KEY;

  // Validation happens in XAIClient constructor
  return new XAIClient({
    apiKey: apiKey || '',
    baseUrl: process.env.XAI_BASE_URL || DEFAULT_BASE_URL,
    timeout: parseInt(process.env.XAI_TIMEOUT || String(DEFAULT_TIMEOUT), 10),
  });
}

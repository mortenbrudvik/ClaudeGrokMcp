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
  ModelsResponse,
  XAIClientOptions,
  XAIError,
  MODEL_PRICING,
  MODEL_FALLBACKS,
  MODEL_ALIASES,
  type ModelAlias,
  type CostEstimate,
} from '../types/index.js';

const DEFAULT_BASE_URL = 'https://api.x.ai/v1';
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_MAX_RETRIES = 2;

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
    if (!options.apiKey) {
      throw new Error('XAI_API_KEY is required');
    }

    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl || DEFAULT_BASE_URL;
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  /**
   * Resolve a model alias or ID to an actual model ID
   */
  resolveModel(modelInput: string): string {
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
   */
  private async request<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    body?: unknown,
    retryCount = 0
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

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
          return this.request<T>(method, endpoint, body, retryCount + 1);
        }

        throw new XAIError(
          `xAI API request failed: ${response.statusText}`,
          response.status,
          response.statusText,
          errorBody
        );
      }

      const data = (await response.json()) as T;

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
          throw new XAIError(`Request timeout after ${this.timeout}ms`, 408, 'Request Timeout');
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
   */
  async chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResponse> {
    // Resolve model alias
    const resolvedModel = this.resolveModel(params.model);

    const response = await this.request<ChatCompletionResponse>('POST', '/chat/completions', {
      ...params,
      model: resolvedModel,
    });

    return response;
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
}

/**
 * Create a new XAIClient instance from environment variables
 */
export function createClient(): XAIClient {
  const apiKey = process.env.XAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'XAI_API_KEY environment variable is required. ' +
        'Get your API key from https://console.x.ai/'
    );
  }

  return new XAIClient({
    apiKey,
    baseUrl: process.env.XAI_BASE_URL || DEFAULT_BASE_URL,
    timeout: parseInt(process.env.XAI_TIMEOUT || String(DEFAULT_TIMEOUT), 10),
  });
}

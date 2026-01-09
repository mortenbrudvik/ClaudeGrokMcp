/**
 * Grok MCP Plugin - Type Definitions
 *
 * Types for xAI API integration and MCP tool responses.
 * Based on xAI API documentation as of January 2026.
 */

// =============================================================================
// xAI API Types
// =============================================================================

/**
 * Chat message format for xAI API
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
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

// =============================================================================
// xAI Client Types
// =============================================================================

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
 */
export class XAIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public statusText: string,
    public responseBody?: string
  ) {
    super(message);
    this.name = 'XAIError';
  }
}

// =============================================================================
// Model Alias Types
// =============================================================================

/**
 * User-friendly model aliases mapped to actual model IDs
 * Updated: January 9, 2026
 */
export type ModelAlias =
  | 'auto'
  | 'default'
  | 'fast'
  | 'smartest'
  | 'code'
  | 'reasoning'
  | 'cheap'
  | 'vision';

/**
 * Model alias resolution map
 * Updated: January 9, 2026 - Verified against live xAI API
 */
export const MODEL_ALIASES: Record<ModelAlias, string> = {
  auto: 'grok-4-0709',
  default: 'grok-4-0709',
  fast: 'grok-4-fast-non-reasoning',
  smartest: 'grok-4-0709',
  code: 'grok-code-fast-1',
  reasoning: 'grok-4-1-fast-reasoning',
  cheap: 'grok-4-fast-non-reasoning',
  vision: 'grok-2-vision-1212',
};

/**
 * Fallback chain for deprecated/unavailable models
 * Maps old model names to current equivalents
 */
export const MODEL_FALLBACKS: Record<string, string> = {
  'grok-3-beta': 'grok-3',
  'grok-3-mini-beta': 'grok-3-mini',
  'grok-4': 'grok-4-0709',
  'grok-4-fast': 'grok-4-fast-non-reasoning',
  'grok-4.1-fast': 'grok-4-1-fast-reasoning',
};

/**
 * Model pricing per 1M tokens (USD)
 * Updated: January 9, 2026 - Verified against xAI API
 */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Grok 4 flagship
  'grok-4-0709': { input: 3.0, output: 15.0 },
  // Grok 4 fast variants
  'grok-4-fast-non-reasoning': { input: 0.2, output: 0.5 },
  'grok-4-fast-reasoning': { input: 0.2, output: 0.5 },
  // Grok 4.1 fast variants
  'grok-4-1-fast-non-reasoning': { input: 0.2, output: 0.5 },
  'grok-4-1-fast-reasoning': { input: 0.2, output: 0.5 },
  // Specialized models
  'grok-code-fast-1': { input: 0.2, output: 1.5 },
  // Grok 3 models
  'grok-3': { input: 0.3, output: 0.5 },
  'grok-3-mini': { input: 0.1, output: 0.2 },
  // Grok 2 models
  'grok-2-1212': { input: 2.0, output: 10.0 },
  'grok-2-vision-1212': { input: 2.0, output: 10.0 },
  'grok-2-image-1212': { input: 2.0, output: 10.0 },
};

// =============================================================================
// Tool Response Types
// =============================================================================

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

// =============================================================================
// MCP Tool Input Types (JSON Schema 2020-12 compatible)
// =============================================================================

/**
 * Input parameters for grok_query tool
 */
export interface GrokQueryInput {
  query: string;
  model?: string;
  context?: string;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

/**
 * Input parameters for grok_models tool
 */
export interface GrokModelsInput {
  refresh?: boolean;
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * API tier configuration
 */
export type APITier = 'standard' | 'enterprise';

/**
 * Rate limit configuration by tier
 */
export const RATE_LIMITS: Record<APITier, { tokensPerMinute: number; requestsPerMinute: number }> =
  {
    standard: {
      tokensPerMinute: 500_000,
      requestsPerMinute: 500,
    },
    enterprise: {
      tokensPerMinute: 10_000_000,
      requestsPerMinute: 10_000,
    },
  };

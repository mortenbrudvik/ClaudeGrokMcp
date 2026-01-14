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
 *
 * SECURITY: responseBody is private to prevent leaking sensitive API details
 * when errors are logged or returned to users.
 */
export class XAIError extends Error {
  private readonly _responseBody?: string;

  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly statusText: string,
    responseBody?: string
  ) {
    super(message);
    this.name = 'XAIError';
    this._responseBody = responseBody;
  }

  /**
   * Safe error details for user-facing messages
   * Does NOT include response body to prevent leaking sensitive API details
   */
  getSanitizedMessage(): string {
    return `${this.name}: ${this.message} (HTTP ${this.statusCode})`;
  }

  /**
   * Full details for internal logging only
   * SECURITY: Only use for internal debugging, never expose to users
   */
  getDebugInfo(): string {
    return JSON.stringify({
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      statusText: this.statusText,
      responseBody: this._responseBody,
    });
  }

  /**
   * Check if the response body contains specific text (for error handling)
   * Does not expose the actual body content
   */
  hasResponseBodyContaining(text: string): boolean {
    return this._responseBody?.includes(text) ?? false;
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
  | 'vision'
  | 'image';

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
  vision: 'grok-4-0709', // Updated: grok-4 supports vision (P4-015)
  image: 'grok-2-image-1212',
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
 * Models that support vision/image input (P4-015)
 */
export const VISION_CAPABLE_MODELS: readonly string[] = [
  'grok-4-0709',
  'grok-4',
  'grok-2-vision-1212', // Legacy, still works
];

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
// Intelligent Model Selection Patterns (P4-010) & Complexity Scoring (P4-011)
// =============================================================================

/**
 * Weight tiers for indicator scoring (P4-011)
 * Higher weight = more decisive signal for model selection
 */
export const WEIGHT_TIERS = {
  DEFINITIVE: 15, // Unmistakable signals (```code```, "step by step")
  STRONG: 10, // Clear signals (function, class, prove, derive)
  MODERATE: 5, // Common signals (bug, error, analyze)
  WEAK: 2, // Ambiguous signals (code, logic, complex)
} as const;

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
export const SIMPLICITY_INDICATORS: readonly string[] = [
  'simple',
  'brief',
  'briefly',
  'quick',
  'just tell me',
  'in one sentence',
  'tldr',
  'tl;dr',
  'summary',
  'short answer',
  'quick answer',
  'one word',
  'yes or no',
];

/**
 * Code-related indicators that suggest using grok-code-fast-1
 * Includes programming keywords, language names, and code analysis terms
 */
export const CODE_INDICATORS: readonly string[] = [
  // Programming concepts
  'function',
  'class',
  'method',
  'variable',
  'const',
  'let',
  'var',
  'interface',
  'type',
  'enum',
  'struct',
  'module',
  'import',
  'export',
  // Code analysis
  'bug',
  'error',
  'exception',
  'debug',
  'fix',
  'refactor',
  'optimize',
  'performance',
  'security',
  'vulnerability',
  'memory leak',
  // Actions
  'implement',
  'write code',
  'code review',
  'pull request',
  'pr',
  // Languages
  'typescript',
  'javascript',
  'python',
  'rust',
  'go',
  'golang',
  'java',
  'c++',
  'cpp',
  'c#',
  'csharp',
  'ruby',
  'php',
  'swift',
  'kotlin',
  'scala',
  'haskell',
  'elixir',
  'clojure',
  'sql',
  'html',
  'css',
  // Frameworks/tools
  'react',
  'vue',
  'angular',
  'node',
  'express',
  'django',
  'flask',
  'spring',
  'rails',
  'laravel',
  'nextjs',
  'nuxt',
  'svelte',
  // Code patterns
  'api',
  'endpoint',
  'rest',
  'graphql',
  'webhook',
  'callback',
  'async',
  'await',
  'promise',
  'observable',
  'stream',
];

/**
 * Reasoning-related indicators that suggest using grok-4-1-fast-reasoning
 * Includes step-by-step thinking, proofs, and logical analysis
 */
export const REASONING_INDICATORS: readonly string[] = [
  // Explicit reasoning requests
  'step by step',
  'step-by-step',
  'think through',
  'reason through',
  'walk me through',
  'explain your reasoning',
  'show your work',
  // Logical operations
  'prove',
  'derive',
  'deduce',
  'infer',
  'conclude',
  'therefore',
  'hence',
  'thus',
  'because',
  // Analysis types
  'logic',
  'logical',
  'reasoning',
  'argument',
  'premise',
  'conclusion',
  // Question patterns
  'why does',
  'why is',
  'how does',
  'how can',
  'what if',
  'explain the logic',
  'what causes',
  'root cause',
  // Math/formal
  'calculate',
  'compute',
  'solve',
  'equation',
  'formula',
  'proof',
  'theorem',
  'hypothesis',
  'axiom',
];

/**
 * Complexity indicators that suggest using grok-4-0709 (flagship)
 * Includes architectural decisions, deep analysis, and creative tasks
 */
export const COMPLEXITY_INDICATORS: readonly string[] = [
  // Analysis depth
  'analyze',
  'analyse',
  'evaluate',
  'assess',
  'critique',
  'compare',
  'contrast',
  'tradeoffs',
  'trade-offs',
  'pros and cons',
  // Architecture
  'architecture',
  'design pattern',
  'system design',
  'scalability',
  'microservices',
  'distributed',
  'infrastructure',
  // Strategy
  'best approach',
  'best practice',
  'recommendation',
  'strategy',
  'roadmap',
  'plan',
  'comprehensive',
  // Creative/complex
  'creative',
  'novel',
  'innovative',
  'brainstorm',
  'complex',
  'nuanced',
  'sophisticated',
  'in-depth',
];

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

// =============================================================================
// Weighted Indicator Maps (P4-011)
// =============================================================================

/**
 * Code indicators with weights based on specificity
 * Higher weight = more decisive signal for code model selection
 */
export const CODE_WEIGHTS: readonly WeightedIndicator[] = [
  // DEFINITIVE (15) - Unmistakable code signals
  { pattern: 'write code', weight: WEIGHT_TIERS.DEFINITIVE },
  { pattern: 'code review', weight: WEIGHT_TIERS.DEFINITIVE },
  { pattern: 'pull request', weight: WEIGHT_TIERS.DEFINITIVE },

  // STRONG (10) - Programming language keywords and constructs
  { pattern: 'function', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'class', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'method', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'interface', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'type', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'enum', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'struct', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'typescript', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'javascript', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'python', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'rust', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'golang', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'java', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'c++', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'react', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'vue', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'angular', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'nextjs', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'django', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'express', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'flask', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'rails', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'laravel', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'spring', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'node', weight: WEIGHT_TIERS.STRONG },

  // MODERATE (5) - Common programming terms
  { pattern: 'bug', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'error', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'exception', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'debug', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'refactor', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'optimize', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'performance', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'security', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'vulnerability', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'api', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'endpoint', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'rest', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'graphql', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'async', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'await', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'promise', weight: WEIGHT_TIERS.MODERATE },

  // WEAK (2) - Ambiguous terms that might be code-related
  { pattern: 'code', weight: WEIGHT_TIERS.WEAK },
  { pattern: 'implement', weight: WEIGHT_TIERS.WEAK },
  { pattern: 'fix', weight: WEIGHT_TIERS.WEAK },
  { pattern: 'variable', weight: WEIGHT_TIERS.WEAK },
  { pattern: 'const', weight: WEIGHT_TIERS.WEAK },
  { pattern: 'let', weight: WEIGHT_TIERS.WEAK },
  { pattern: 'var', weight: WEIGHT_TIERS.WEAK },
  { pattern: 'pr', weight: WEIGHT_TIERS.WEAK },
];

/**
 * Reasoning indicators with weights based on specificity
 * Higher weight = more decisive signal for reasoning model selection
 */
export const REASONING_WEIGHTS: readonly WeightedIndicator[] = [
  // DEFINITIVE (15) - Explicit reasoning requests
  { pattern: 'step by step', weight: WEIGHT_TIERS.DEFINITIVE },
  { pattern: 'step-by-step', weight: WEIGHT_TIERS.DEFINITIVE },
  { pattern: 'show your work', weight: WEIGHT_TIERS.DEFINITIVE },
  { pattern: 'explain your reasoning', weight: WEIGHT_TIERS.DEFINITIVE },
  { pattern: 'walk me through', weight: WEIGHT_TIERS.DEFINITIVE },

  // STRONG (10) - Logical operations and proofs
  { pattern: 'prove', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'derive', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'deduce', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'infer', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'theorem', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'axiom', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'proof', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'hypothesis', weight: WEIGHT_TIERS.STRONG },

  // MODERATE (5) - Analysis and calculation
  { pattern: 'think through', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'reason through', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'why does', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'why is', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'how does', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'how can', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'what if', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'explain the logic', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'root cause', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'calculate', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'compute', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'solve', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'equation', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'formula', weight: WEIGHT_TIERS.MODERATE },

  // WEAK (2) - Ambiguous terms
  { pattern: 'logic', weight: WEIGHT_TIERS.WEAK },
  { pattern: 'logical', weight: WEIGHT_TIERS.WEAK },
  { pattern: 'reasoning', weight: WEIGHT_TIERS.WEAK },
  { pattern: 'because', weight: WEIGHT_TIERS.WEAK },
  { pattern: 'therefore', weight: WEIGHT_TIERS.WEAK },
  { pattern: 'hence', weight: WEIGHT_TIERS.WEAK },
  { pattern: 'thus', weight: WEIGHT_TIERS.WEAK },
];

/**
 * Complexity indicators with weights based on specificity
 * Higher weight = more decisive signal for flagship model selection
 */
export const COMPLEXITY_WEIGHTS: readonly WeightedIndicator[] = [
  // DEFINITIVE (15) - Architectural decisions
  { pattern: 'system design', weight: WEIGHT_TIERS.DEFINITIVE },
  { pattern: 'architecture review', weight: WEIGHT_TIERS.DEFINITIVE },
  { pattern: 'design pattern', weight: WEIGHT_TIERS.DEFINITIVE },

  // STRONG (10) - Complex analysis
  { pattern: 'tradeoffs', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'trade-offs', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'pros and cons', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'scalability', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'microservices', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'distributed', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'infrastructure', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'best approach', weight: WEIGHT_TIERS.STRONG },
  { pattern: 'best practice', weight: WEIGHT_TIERS.STRONG },

  // MODERATE (5) - Analysis and strategy
  { pattern: 'analyze', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'analyse', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'evaluate', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'assess', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'critique', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'compare', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'contrast', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'strategy', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'roadmap', weight: WEIGHT_TIERS.MODERATE },
  { pattern: 'recommendation', weight: WEIGHT_TIERS.MODERATE },

  // WEAK (2) - Ambiguous complexity signals
  { pattern: 'architecture', weight: WEIGHT_TIERS.WEAK },
  { pattern: 'complex', weight: WEIGHT_TIERS.WEAK },
  { pattern: 'nuanced', weight: WEIGHT_TIERS.WEAK },
  { pattern: 'sophisticated', weight: WEIGHT_TIERS.WEAK },
  { pattern: 'comprehensive', weight: WEIGHT_TIERS.WEAK },
  { pattern: 'in-depth', weight: WEIGHT_TIERS.WEAK },
  { pattern: 'creative', weight: WEIGHT_TIERS.WEAK },
  { pattern: 'novel', weight: WEIGHT_TIERS.WEAK },
  { pattern: 'innovative', weight: WEIGHT_TIERS.WEAK },
  { pattern: 'brainstorm', weight: WEIGHT_TIERS.WEAK },
  { pattern: 'plan', weight: WEIGHT_TIERS.WEAK },
];

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

// =============================================================================
// MCP Tool Input Types (JSON Schema 2020-12 compatible)
// =============================================================================

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

// =============================================================================
// Service Types (for dependency injection)
// =============================================================================

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

// =============================================================================
// Agent Tools API Types (for grok_search_x)
// =============================================================================

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
  include?: Array<
    | 'inline_citations'
    | 'verbose_streaming'
    | 'web_search_call_output'
    | 'x_search_call_output'
    | 'code_interpreter_call.outputs'
  >;
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
  web_citation?: { url: string; title?: string };
  x_citation?: { post_id: string; handle?: string };
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
  // OpenAI-style naming (used by some API versions)
  prompt_tokens?: number;
  completion_tokens?: number;
  // Newer naming convention (used by /v1/responses)
  input_tokens?: number;
  output_tokens?: number;
  // Common fields
  reasoning_tokens?: number;
  total_tokens: number;
  cached_prompt_text_tokens?: number;
  prompt_image_tokens?: number;
  prompt_text_tokens?: number;
}

/**
 * Content item in an assistant message (part of Agent Tools output)
 * Note: The API uses 'output_text' for text content, not just 'text'
 */
export interface AgentOutputContentItem {
  type: 'text' | 'output_text' | 'refusal' | string;
  text?: string;
  refusal?: string;
  logprobs?: unknown[];
  annotations?: unknown[];
}

/**
 * Assistant message in Agent Tools output array
 */
export interface AgentOutputMessage {
  id: string;
  type: 'message';
  role: 'assistant';
  status: 'completed' | 'incomplete' | 'in_progress';
  content: AgentOutputContentItem[];
}

/**
 * Tool call item in Agent Tools output array
 */
export interface AgentOutputToolCall {
  id: string;
  type: 'code_interpreter_call' | 'custom_tool_call' | string;
  status: 'completed' | 'failed' | 'in_progress';
  code?: string;
  outputs?: unknown[];
  call_id?: string;
  name?: string;
  input?: string;
}

/**
 * Union type for items in the output array
 */
export type AgentOutputItem = AgentOutputMessage | AgentOutputToolCall;

/**
 * Response from Agent Tools API (POST /v1/responses)
 *
 * Note: The API returns 'output' as an array containing tool calls and assistant messages.
 * The text response is extracted from output[].content where type === 'message'.
 * The 'created_at' field is an ISO string, not Unix timestamp.
 */
export interface AgentToolsResponse {
  id: string;
  object: 'response';
  /** Creation timestamp (ISO 8601 string) */
  created_at: string;
  /** Alias for created_at for backwards compatibility */
  created?: number;
  model: string;
  /** The response output array containing tool calls and assistant messages */
  output?: AgentOutputItem[];
  /** Legacy content field (may be undefined in newer API versions) */
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
  /** Reasoning trace (if reasoning model used) */
  reasoning?: unknown;
  /** Max output tokens setting */
  max_output_tokens?: number;
  /** Parallel tool calls setting */
  parallel_tool_calls?: boolean;
  /** Previous response ID for multi-turn conversations */
  previous_response_id?: string | null;
  /** Temperature setting used */
  temperature?: number;
}

/**
 * Extract text content from Agent Tools API response output array
 * Per xAI docs: response.output[-1].content[0].text
 * The last item in output array contains the final assistant response
 */
export function extractAgentResponseText(output?: AgentOutputItem[]): string {
  if (!output || !Array.isArray(output) || output.length === 0) return '';

  // Per xAI documentation: final response is at output[-1].content[0].text
  const lastItem = output[output.length - 1];

  // The last item should be a message with content array
  if (!lastItem || !('content' in lastItem)) return '';

  const message = lastItem as AgentOutputMessage;
  if (!message.content || !Array.isArray(message.content) || message.content.length === 0)
    return '';

  // Get text from first content item (output_text type)
  const firstContent = message.content[0];
  if (firstContent && firstContent.text) {
    return firstContent.text;
  }

  // Fallback: try to extract all text items
  return message.content
    .filter((item) => item.text)
    .map((item) => item.text!)
    .join('\n');
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

// =============================================================================
// Code Execution Tool Types (grok_execute_code)
// =============================================================================

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

// =============================================================================
// Image Generation Tool Types (grok_generate_image)
// =============================================================================

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

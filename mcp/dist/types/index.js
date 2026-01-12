/**
 * Grok MCP Plugin - Type Definitions
 *
 * Types for xAI API integration and MCP tool responses.
 * Based on xAI API documentation as of January 2026.
 */
/**
 * Custom error class for xAI API errors
 *
 * SECURITY: responseBody is private to prevent leaking sensitive API details
 * when errors are logged or returned to users.
 */
export class XAIError extends Error {
    statusCode;
    statusText;
    _responseBody;
    constructor(message, statusCode, statusText, responseBody) {
        super(message);
        this.statusCode = statusCode;
        this.statusText = statusText;
        this.name = 'XAIError';
        this._responseBody = responseBody;
    }
    /**
     * Safe error details for user-facing messages
     * Does NOT include response body to prevent leaking sensitive API details
     */
    getSanitizedMessage() {
        return `${this.name}: ${this.message} (HTTP ${this.statusCode})`;
    }
    /**
     * Full details for internal logging only
     * SECURITY: Only use for internal debugging, never expose to users
     */
    getDebugInfo() {
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
    hasResponseBodyContaining(text) {
        return this._responseBody?.includes(text) ?? false;
    }
}
/**
 * Model alias resolution map
 * Updated: January 9, 2026 - Verified against live xAI API
 */
export const MODEL_ALIASES = {
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
export const MODEL_FALLBACKS = {
    'grok-3-beta': 'grok-3',
    'grok-3-mini-beta': 'grok-3-mini',
    'grok-4': 'grok-4-0709',
    'grok-4-fast': 'grok-4-fast-non-reasoning',
    'grok-4.1-fast': 'grok-4-1-fast-reasoning',
};
/**
 * Models that support vision/image input (P4-015)
 */
export const VISION_CAPABLE_MODELS = [
    'grok-4-0709',
    'grok-4',
    'grok-2-vision-1212', // Legacy, still works
];
/**
 * Model pricing per 1M tokens (USD)
 * Updated: January 9, 2026 - Verified against xAI API
 */
export const MODEL_PRICING = {
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
};
/**
 * Simplicity indicators that reduce complexity score (P4-011)
 * When users explicitly want brief/simple output
 */
export const SIMPLICITY_INDICATORS = [
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
export const CODE_INDICATORS = [
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
export const REASONING_INDICATORS = [
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
export const COMPLEXITY_INDICATORS = [
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
// =============================================================================
// Weighted Indicator Maps (P4-011)
// =============================================================================
/**
 * Code indicators with weights based on specificity
 * Higher weight = more decisive signal for code model selection
 */
export const CODE_WEIGHTS = [
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
export const REASONING_WEIGHTS = [
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
export const COMPLEXITY_WEIGHTS = [
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
/**
 * Rate limit configuration by tier
 */
export const RATE_LIMITS = {
    standard: {
        tokensPerMinute: 500_000,
        requestsPerMinute: 500,
    },
    enterprise: {
        tokensPerMinute: 10_000_000,
        requestsPerMinute: 10_000,
    },
};
//# sourceMappingURL=index.js.map
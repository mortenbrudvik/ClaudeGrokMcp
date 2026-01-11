/**
 * grok_estimate_cost Tool
 *
 * Estimates the cost of a Grok API query before execution,
 * helping users understand and plan for API costs.
 *
 * @module tools/estimate-cost
 */

import { CallToolResult, TextContent } from '@modelcontextprotocol/sdk/types.js';
import {
  MODEL_PRICING,
  MODEL_ALIASES,
  ModelAlias,
  CODE_WEIGHTS,
  REASONING_WEIGHTS,
  COMPLEXITY_WEIGHTS,
  WeightedIndicator,
} from '../types/index.js';

/**
 * Input parameters for grok_estimate_cost tool
 */
export interface EstimateCostInput {
  /** The query text to estimate (required) */
  query: string;
  /** Model to use (default: auto) */
  model?: string;
  /** Additional system context */
  context?: string;
  /** Expected maximum output tokens (for estimation) */
  max_tokens?: number;
}

/**
 * Response from cost estimation
 */
export interface EstimateCostResponse {
  /** Estimated input tokens */
  estimated_input_tokens: number;
  /** Estimated output tokens */
  estimated_output_tokens: number;
  /** Total estimated tokens */
  estimated_total_tokens: number;
  /** Estimated cost in USD */
  estimated_cost_usd: number;
  /** Model used for estimation */
  model: string;
  /** Pricing per 1M tokens */
  pricing: {
    input_per_1m: number;
    output_per_1m: number;
  };
  /** Warning message if the query is expensive */
  warning?: string;
  /** Cost breakdown details */
  breakdown: {
    input_cost_usd: number;
    output_cost_usd: number;
  };
}

/**
 * JSON Schema for grok_estimate_cost tool (JSON Schema 2020-12)
 */
export const estimateCostSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object' as const,
  properties: {
    query: {
      type: 'string',
      description: 'The query text to estimate the cost for',
    },
    model: {
      type: 'string',
      description:
        'Model to use for estimation. Default: auto. Use aliases like "fast", "smartest", "code", "reasoning"',
    },
    context: {
      type: 'string',
      description: 'Additional system context that would be included with the query',
    },
    max_tokens: {
      type: 'number',
      minimum: 1,
      maximum: 100000,
      description: 'Expected maximum output tokens. Default: estimated based on query length',
    },
  },
  required: ['query'],
  additionalProperties: false,
};

/**
 * Approximate token count for text
 *
 * Uses a simple heuristic: ~4 characters per token for English text.
 * This is a rough approximation; actual token count depends on the
 * specific tokenizer used by the model.
 *
 * @param text - Text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  // Remove excessive whitespace
  const normalized = text.replace(/\s+/g, ' ').trim();

  // Approximate: 1 token ≈ 4 characters for English
  // Add some overhead for special tokens and formatting
  const baseTokens = Math.ceil(normalized.length / 4);

  // Add overhead for message structure (role tokens, etc.)
  return Math.max(1, baseTokens + 4);
}

/**
 * Match indicator using word boundaries
 */
function matchesIndicator(text: string, indicator: string): boolean {
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
 * Calculate a lightweight complexity score for output estimation
 * Uses the same weighted indicators as xai-client (P4-011)
 */
function calculateQuickComplexityScore(
  query: string,
  context?: string
): { score: number; category: 'code' | 'reasoning' | 'complex' | 'simple' } {
  const combinedText = (query + ' ' + (context || '')).toLowerCase();

  // Sum weights for each category
  const sumWeights = (weights: readonly WeightedIndicator[]): number => {
    return weights.reduce((sum, { pattern, weight }) => {
      return matchesIndicator(combinedText, pattern) ? sum + weight : sum;
    }, 0);
  };

  const codeScore = sumWeights(CODE_WEIGHTS);
  const reasoningScore = sumWeights(REASONING_WEIGHTS);
  const complexityScore = sumWeights(COMPLEXITY_WEIGHTS);

  // Check for code blocks in context
  const hasCodeBlocks =
    context?.includes('```') ||
    context?.includes('function ') ||
    context?.includes('class ') ||
    /\b(const|let|var)\s+\w+\s*=/.test(context || '');

  const adjustedCodeScore = hasCodeBlocks ? codeScore + 15 : codeScore;

  // Determine category
  const maxScore = Math.max(adjustedCodeScore, reasoningScore, complexityScore);
  let category: 'code' | 'reasoning' | 'complex' | 'simple' = 'simple';

  if (maxScore > 0) {
    if (adjustedCodeScore === maxScore) category = 'code';
    else if (reasoningScore === maxScore) category = 'reasoning';
    else category = 'complex';
  }

  return { score: Math.min(100, maxScore), category };
}

/**
 * Estimate output tokens based on query complexity (P4-011)
 *
 * Uses weighted complexity scoring for more accurate estimation.
 * Higher complexity queries tend to generate longer responses.
 */
function estimateOutputTokens(query: string, context?: string, maxTokens?: number): number {
  if (maxTokens) {
    return maxTokens;
  }

  const inputTokens = estimateTokens(query);
  const { score, category } = calculateQuickComplexityScore(query, context);

  // Base multipliers by category
  const categoryMultipliers: Record<string, { base: number; min: number }> = {
    code: { base: 4, min: 500 }, // Code generates more output
    reasoning: { base: 3.5, min: 400 }, // Reasoning traces are verbose
    complex: { base: 3, min: 350 }, // Complex analysis needs space
    simple: { base: 2, min: 150 }, // Simple queries, short answers
  };

  const { base, min } = categoryMultipliers[category] || categoryMultipliers.simple;

  // Adjust multiplier based on complexity score
  // Higher scores indicate more complex queries that need longer responses
  const scoreAdjustment = 1 + (score / 100) * 0.5; // Up to 50% more for max complexity
  const effectiveMultiplier = base * scoreAdjustment;

  return Math.max(min, Math.round(inputTokens * effectiveMultiplier));
}

/**
 * Resolve model alias to actual model ID
 */
function resolveModel(model: string): string {
  // Check if it's an alias
  const alias = model.toLowerCase() as ModelAlias;
  if (alias in MODEL_ALIASES) {
    return MODEL_ALIASES[alias];
  }
  return model;
}

/**
 * Get pricing for a model
 */
function getPricing(model: string): { input: number; output: number } {
  return MODEL_PRICING[model] || { input: 2.0, output: 10.0 }; // Default to mid-range
}

/**
 * Generate warning for expensive operations
 */
function generateWarning(estimatedCost: number, model: string): string | undefined {
  // Warn if cost is high
  if (estimatedCost > 0.1) {
    return `High cost warning: This query is estimated to cost $${estimatedCost.toFixed(4)}. Consider using a cheaper model like "fast" or "cheap".`;
  }

  // Warn for expensive models with large queries
  if (model.includes('grok-4') && !model.includes('fast') && estimatedCost > 0.01) {
    return `Using premium model: Consider "fast" or "code" aliases for lower cost.`;
  }

  return undefined;
}

/**
 * Execute cost estimation
 */
export function executeEstimateCost(input: EstimateCostInput): EstimateCostResponse {
  // Validate input
  if (!input.query || input.query.trim().length === 0) {
    throw new Error('Query is required for cost estimation');
  }

  // Resolve model
  const model = input.model ? resolveModel(input.model) : resolveModel('auto');
  const pricing = getPricing(model);

  // Estimate input tokens (query + context)
  let inputTokens = estimateTokens(input.query);
  if (input.context) {
    inputTokens += estimateTokens(input.context);
  }

  // Estimate output tokens using complexity scoring (P4-011)
  const outputTokens = Math.round(
    estimateOutputTokens(input.query, input.context, input.max_tokens)
  );

  // Calculate costs
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  const totalCost = inputCost + outputCost;

  // Generate warning if needed
  const warning = generateWarning(totalCost, model);

  return {
    estimated_input_tokens: inputTokens,
    estimated_output_tokens: outputTokens,
    estimated_total_tokens: inputTokens + outputTokens,
    estimated_cost_usd: totalCost,
    model,
    pricing: {
      input_per_1m: pricing.input,
      output_per_1m: pricing.output,
    },
    warning,
    breakdown: {
      input_cost_usd: inputCost,
      output_cost_usd: outputCost,
    },
  };
}

/**
 * Format cost estimation result for MCP response
 */
function formatEstimateOutput(result: EstimateCostResponse): string {
  const lines: string[] = [];

  // Header
  lines.push(`🤖 **Grok Cost Estimate:**`);
  lines.push('');

  // Warning (if present)
  if (result.warning) {
    lines.push(`> ⚠️ **${result.warning}**`);
    lines.push('');
  }

  // Summary
  lines.push(`### Estimated Cost: $${result.estimated_cost_usd.toFixed(6)}`);
  lines.push('');

  // Details table
  lines.push('| Component | Tokens | Cost |');
  lines.push('|-----------|--------|------|');
  lines.push(
    `| Input | ${result.estimated_input_tokens.toLocaleString()} | $${result.breakdown.input_cost_usd.toFixed(6)} |`
  );
  lines.push(
    `| Output (est.) | ${result.estimated_output_tokens.toLocaleString()} | $${result.breakdown.output_cost_usd.toFixed(6)} |`
  );
  lines.push(
    `| **Total** | **${result.estimated_total_tokens.toLocaleString()}** | **$${result.estimated_cost_usd.toFixed(6)}** |`
  );
  lines.push('');

  // Model info
  lines.push('### Model Pricing');
  lines.push(`- **Model:** ${result.model}`);
  lines.push(`- **Input:** $${result.pricing.input_per_1m.toFixed(2)} per 1M tokens`);
  lines.push(`- **Output:** $${result.pricing.output_per_1m.toFixed(2)} per 1M tokens`);
  lines.push('');

  // Notes
  lines.push('---');
  lines.push(`⚡ *${result.model} • Token counts are estimates. Actual costs may vary.*`);

  return lines.join('\n');
}

/**
 * Handle grok_estimate_cost tool call
 *
 * @param input - Tool input parameters
 * @returns MCP CallToolResult
 */
export async function handleEstimateCost(input: unknown): Promise<CallToolResult> {
  try {
    // Validate input
    if (!input || typeof input !== 'object') {
      throw new Error('Invalid input: expected object with query property');
    }

    const params = input as Record<string, unknown>;
    if (!params.query || typeof params.query !== 'string') {
      throw new Error('Invalid input: query property is required and must be a string');
    }

    const estimateInput: EstimateCostInput = {
      query: params.query,
      model: typeof params.model === 'string' ? params.model : undefined,
      context: typeof params.context === 'string' ? params.context : undefined,
      max_tokens: typeof params.max_tokens === 'number' ? params.max_tokens : undefined,
    };

    const result = executeEstimateCost(estimateInput);

    const content: TextContent = {
      type: 'text',
      text: formatEstimateOutput(result),
    };

    return {
      content: [content],
      isError: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return {
      content: [{ type: 'text', text: `Error estimating cost: ${errorMessage}` }],
      isError: true,
    };
  }
}

/**
 * Compare costs across models for a given query
 *
 * Useful for helping users choose the right model.
 */
export function compareModelCosts(
  query: string,
  context?: string
): Array<{ model: string; cost: number; alias?: string }> {
  const modelsToCompare = [
    { alias: 'fast', model: 'grok-4-fast-non-reasoning' },
    { alias: 'smartest', model: 'grok-4-0709' },
    { alias: 'code', model: 'grok-code-fast-1' },
    { alias: 'reasoning', model: 'grok-4-1-fast-reasoning' },
  ];

  return modelsToCompare
    .map(({ alias, model }) => {
      const result = executeEstimateCost({ query, context, model });
      return {
        model,
        alias,
        cost: result.estimated_cost_usd,
      };
    })
    .sort((a, b) => a.cost - b.cost);
}

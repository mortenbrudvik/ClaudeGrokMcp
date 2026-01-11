/**
 * Test API Client Utilities
 *
 * Provides helpers for creating clients with test-optimized settings.
 *
 * @module integration/helpers/api-client
 */
import { createClient, XAIClient } from '../../client/xai-client.js';
import { MODEL_PRICING } from '../../types/index.js';
import { recordCost } from '../setup.js';

/** Default model for tests (cheapest option) */
export const TEST_MODEL = 'grok-4-fast';

/** Default settings for minimal cost */
export const TEST_DEFAULTS = {
  max_tokens: 50,
  temperature: 0, // Deterministic responses
} as const;

/**
 * Create a test client with validation
 *
 * @throws Error if XAI_API_KEY is not set
 * @returns Configured XAIClient instance
 */
export function createTestClient(): XAIClient {
  return createClient();
}

/**
 * Create a client with an invalid API key (for error testing)
 *
 * Note: This temporarily modifies the environment variable.
 *
 * @returns XAIClient with invalid credentials
 */
export function createInvalidClient(): XAIClient {
  // Temporarily set invalid key
  const originalKey = process.env.XAI_API_KEY;
  process.env.XAI_API_KEY = 'xai-invalid-test-key-12345678901234567890';

  try {
    return createClient();
  } finally {
    process.env.XAI_API_KEY = originalKey;
  }
}

/**
 * Usage stats from API response
 */
export interface UsageStats {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens?: number;
}

/**
 * Calculate and record cost from API response
 *
 * @param testName - Name of the test for tracking
 * @param model - Model used for the request
 * @param usage - Usage statistics from API response
 * @returns Calculated cost in USD
 */
export function trackCost(testName: string, model: string, usage: UsageStats): number {
  const pricing = MODEL_PRICING[model] || { input: 2.0, output: 10.0 };
  const inputCost = (usage.prompt_tokens / 1_000_000) * pricing.input;
  const outputCost = (usage.completion_tokens / 1_000_000) * pricing.output;
  const totalCost = inputCost + outputCost;

  recordCost(testName, totalCost, model, usage.prompt_tokens, usage.completion_tokens);

  return totalCost;
}

/**
 * Estimate cost before making a request
 *
 * @param model - Model to use
 * @param estimatedInputTokens - Expected input token count
 * @param estimatedOutputTokens - Expected output token count
 * @returns Estimated cost in USD
 */
export function estimateCost(
  model: string,
  estimatedInputTokens: number,
  estimatedOutputTokens: number
): number {
  const pricing = MODEL_PRICING[model] || { input: 2.0, output: 10.0 };
  const inputCost = (estimatedInputTokens / 1_000_000) * pricing.input;
  const outputCost = (estimatedOutputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * Extract cost from tool response text
 *
 * Supports multiple formats:
 * - Query format: "• $0.0004 •" or just "$X.XXXX" in the metadata line
 * - Estimate format: "### Estimated Cost: $X.XXXXXX" or "**$X.XX**"
 *
 * @param responseText - Text response containing cost info
 * @returns Extracted cost or null if not found
 */
export function extractCostFromResponse(responseText: string): number | null {
  // Try query format: "• $0.0004 •" (in the ⚡ metadata line)
  const queryMatch = responseText.match(/\$(\d+\.\d+)/);
  if (queryMatch) {
    return parseFloat(queryMatch[1]);
  }

  // Try estimate format with ### header
  const estimateMatch = responseText.match(/Estimated Cost:\s*\$(\d+\.\d+)/i);
  if (estimateMatch) {
    return parseFloat(estimateMatch[1]);
  }

  // Legacy format: "Cost: $X.XX"
  const legacyMatch = responseText.match(/Cost:\s*\$([\d.]+)/i);
  if (legacyMatch) {
    return parseFloat(legacyMatch[1]);
  }

  return null;
}

/**
 * Extract token counts from tool response text
 *
 * Supports multiple formats:
 * - Query format: "• 150 tokens •" (total only, split evenly)
 * - Table format: "| Input | X |" and "| Output | Y |"
 *
 * @param responseText - Text response containing token info
 * @returns Token counts or null if not found
 */
export function extractTokensFromResponse(
  responseText: string
): { input: number; output: number } | null {
  // Try query format: "• 150 tokens •"
  const totalMatch = responseText.match(/(\d+)\s*tokens/i);
  if (totalMatch) {
    const total = parseInt(totalMatch[1], 10);
    // Approximate split (actual split not available in this format)
    return {
      input: Math.floor(total * 0.6),
      output: Math.ceil(total * 0.4),
    };
  }

  // Try table format from estimate-cost
  const inputMatch = responseText.match(/\|\s*Input\s*\|\s*([\d,]+)/i);
  const outputMatch = responseText.match(/\|\s*Output[^|]*\|\s*([\d,]+)/i);
  if (inputMatch && outputMatch) {
    return {
      input: parseInt(inputMatch[1].replace(/,/g, ''), 10),
      output: parseInt(outputMatch[1].replace(/,/g, ''), 10),
    };
  }

  // Legacy format: "Tokens: X in / Y out"
  const legacyMatch = responseText.match(/Tokens:\s*(\d+)\s*in\s*\/\s*(\d+)\s*out/i);
  if (legacyMatch) {
    return {
      input: parseInt(legacyMatch[1], 10),
      output: parseInt(legacyMatch[2], 10),
    };
  }

  return null;
}

/**
 * Extract model name from tool response text
 *
 * Supports multiple formats:
 * - Query format: "⚡ *grok-4-fast •" (model name before bullet)
 * - Legacy format: "Model: model-name"
 *
 * @param responseText - Text response containing model info
 * @returns Model name or null if not found
 */
export function extractModelFromResponse(responseText: string): string | null {
  // Try query format: "⚡ *grok-4-fast •" or just find grok-* pattern
  const grokMatch = responseText.match(/(grok-[\w-]+)/i);
  if (grokMatch) {
    return grokMatch[1];
  }

  // Legacy format: "Model: model-name"
  const legacyMatch = responseText.match(/Model:\s*(\S+)/i);
  if (legacyMatch) {
    return legacyMatch[1];
  }

  return null;
}

/**
 * Extract response time from tool response text
 *
 * Supports multiple formats:
 * - Query format: "• 250ms" or "• 250ms*"
 * - Legacy format: "Response time: Xms"
 *
 * @param responseText - Text response containing timing info
 * @returns Response time in ms or null if not found
 */
export function extractResponseTimeFromResponse(responseText: string): number | null {
  // Try query format: "• 250ms" at end of line
  const queryMatch = responseText.match(/(\d+)ms/i);
  if (queryMatch) {
    return parseInt(queryMatch[1], 10);
  }

  // Legacy format
  const legacyMatch = responseText.match(/Response time:\s*(\d+)ms/i);
  if (legacyMatch) {
    return parseInt(legacyMatch[1], 10);
  }

  return null;
}

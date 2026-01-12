/**
 * Test API Client Utilities
 *
 * Provides helpers for creating clients with test-optimized settings.
 *
 * @module integration/helpers/api-client
 */
import { XAIClient } from '../../client/xai-client.js';
/** Default model for tests (cheapest option) */
export declare const TEST_MODEL = "grok-4-fast";
/** Default settings for minimal cost */
export declare const TEST_DEFAULTS: {
    readonly max_tokens: 50;
    readonly temperature: 0;
};
/**
 * Create a test client with validation
 *
 * @throws Error if XAI_API_KEY is not set
 * @returns Configured XAIClient instance
 */
export declare function createTestClient(): XAIClient;
/**
 * Create a client with an invalid API key (for error testing)
 *
 * Note: This temporarily modifies the environment variable.
 *
 * @returns XAIClient with invalid credentials
 */
export declare function createInvalidClient(): XAIClient;
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
export declare function trackCost(testName: string, model: string, usage: UsageStats): number;
/**
 * Estimate cost before making a request
 *
 * @param model - Model to use
 * @param estimatedInputTokens - Expected input token count
 * @param estimatedOutputTokens - Expected output token count
 * @returns Estimated cost in USD
 */
export declare function estimateCost(model: string, estimatedInputTokens: number, estimatedOutputTokens: number): number;
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
export declare function extractCostFromResponse(responseText: string): number | null;
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
export declare function extractTokensFromResponse(responseText: string): {
    input: number;
    output: number;
} | null;
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
export declare function extractModelFromResponse(responseText: string): string | null;
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
export declare function extractResponseTimeFromResponse(responseText: string): number | null;
//# sourceMappingURL=api-client.d.ts.map
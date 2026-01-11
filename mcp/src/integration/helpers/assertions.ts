/**
 * Custom Vitest Assertions for Live Tests
 *
 * Provides domain-specific matchers for API responses.
 *
 * @module integration/helpers/assertions
 */
import { expect } from 'vitest';

/**
 * Usage stats structure from API responses
 */
interface UsageStats {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

/**
 * Response with usage stats
 */
interface ResponseWithUsage {
  usage?: UsageStats;
}

/**
 * Extend Vitest's expect with custom matchers
 */
expect.extend({
  /**
   * Assert response contains valid usage stats
   *
   * @example
   * expect(response).toHaveValidUsage();
   */
  toHaveValidUsage(received: ResponseWithUsage) {
    const pass =
      received.usage !== undefined &&
      typeof received.usage.prompt_tokens === 'number' &&
      typeof received.usage.completion_tokens === 'number' &&
      received.usage.prompt_tokens > 0 &&
      received.usage.completion_tokens > 0;

    return {
      pass,
      message: () =>
        pass
          ? `expected response not to have valid usage stats`
          : `expected response to have valid usage stats with prompt_tokens and completion_tokens > 0, got: ${JSON.stringify(received.usage)}`,
    };
  },

  /**
   * Assert response text contains cost information
   *
   * Supports multiple formats:
   * - Query: "• 150 tokens • $0.0004 •" (in ⚡ metadata line)
   * - Legacy: "Cost: $X.XX" and "Tokens: X in / Y out"
   *
   * @example
   * expect(responseText).toContainCostInfo();
   */
  toContainCostInfo(received: string) {
    // Check for cost in various formats
    const hasCost = /\$\d+\.\d+/.test(received);
    // Check for tokens in various formats
    const hasTokens = /\d+\s*tokens/i.test(received) || /Tokens:\s*\d+/i.test(received);

    return {
      pass: hasCost && hasTokens,
      message: () => {
        const missing: string[] = [];
        if (!hasCost) missing.push('cost (e.g., "$0.0004" or "Cost: $0.001")');
        if (!hasTokens) missing.push('tokens (e.g., "150 tokens" or "Tokens: 100")');
        return `expected response ${hasCost && hasTokens ? 'not ' : ''}to contain cost and token information. Missing: ${missing.join(', ')}`;
      },
    };
  },

  /**
   * Assert value is within percentage tolerance
   *
   * @example
   * expect(actualCost).toBeWithinTolerance(expectedCost, 10); // 10% tolerance
   */
  toBeWithinTolerance(received: number, expected: number, tolerancePercent: number = 10) {
    const tolerance = expected * (tolerancePercent / 100);
    const pass = Math.abs(received - expected) <= tolerance;

    return {
      pass,
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to be within ${tolerancePercent}% of ${expected} (range: ${expected - tolerance} to ${expected + tolerance})`,
    };
  },

  /**
   * Assert API error has expected structure
   *
   * @example
   * expect(error).toBeXAIError(401);
   */
  toBeXAIError(received: unknown, expectedStatus?: number) {
    const isError = received instanceof Error;
    const hasStatusCode = isError && 'statusCode' in received;
    const statusMatches =
      expectedStatus === undefined ||
      (hasStatusCode && (received as { statusCode: number }).statusCode === expectedStatus);

    return {
      pass: isError && hasStatusCode && statusMatches,
      message: () => {
        if (!isError) return 'expected value to be an Error';
        if (!hasStatusCode) return 'expected error to have statusCode property';
        if (!statusMatches)
          return `expected statusCode ${expectedStatus}, got ${(received as { statusCode: number }).statusCode}`;
        return 'expected value not to be an XAIError';
      },
    };
  },

  /**
   * Assert response is a valid chat completion
   *
   * @example
   * expect(response).toBeValidCompletion();
   */
  toBeValidCompletion(received: unknown) {
    const isObject = typeof received === 'object' && received !== null;
    const hasChoices =
      isObject &&
      'choices' in received &&
      Array.isArray((received as { choices: unknown }).choices);
    const hasUsage = isObject && 'usage' in received;
    const hasModel = isObject && 'model' in received;

    const pass = isObject && hasChoices && hasUsage && hasModel;

    return {
      pass,
      message: () => {
        const missing: string[] = [];
        if (!isObject) return 'expected value to be an object';
        if (!hasChoices) missing.push('choices array');
        if (!hasUsage) missing.push('usage object');
        if (!hasModel) missing.push('model string');
        return `expected response ${pass ? 'not ' : ''}to be a valid completion. Missing: ${missing.join(', ')}`;
      },
    };
  },

  /**
   * Assert response time is within expected range
   *
   * @example
   * expect(responseTimeMs).toBeReasonableResponseTime(5000); // Max 5 seconds
   */
  toBeReasonableResponseTime(received: number, maxMs: number = 30000) {
    const pass = received > 0 && received <= maxMs;

    return {
      pass,
      message: () =>
        `expected ${received}ms ${pass ? 'not ' : ''}to be a reasonable response time (0 < x <= ${maxMs}ms)`,
    };
  },
});

// TypeScript declarations for custom matchers
interface CustomMatchers<R = unknown> {
  toHaveValidUsage(): R;
  toContainCostInfo(): R;
  toBeWithinTolerance(expected: number, tolerancePercent?: number): R;
  toBeXAIError(expectedStatus?: number): R;
  toBeValidCompletion(): R;
  toBeReasonableResponseTime(maxMs?: number): R;
}

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

// Export for use in test files
export {};

/**
 * Custom Vitest Assertions for Live Tests
 *
 * Provides domain-specific matchers for API responses.
 *
 * @module integration/helpers/assertions
 */
import { expect } from 'vitest';
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
    toHaveValidUsage(received) {
        const pass = received.usage !== undefined &&
            typeof received.usage.prompt_tokens === 'number' &&
            typeof received.usage.completion_tokens === 'number' &&
            received.usage.prompt_tokens > 0 &&
            received.usage.completion_tokens > 0;
        return {
            pass,
            message: () => pass
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
    toContainCostInfo(received) {
        // Check for cost in various formats
        const hasCost = /\$\d+\.\d+/.test(received);
        // Check for tokens in various formats
        const hasTokens = /\d+\s*tokens/i.test(received) || /Tokens:\s*\d+/i.test(received);
        return {
            pass: hasCost && hasTokens,
            message: () => {
                const missing = [];
                if (!hasCost)
                    missing.push('cost (e.g., "$0.0004" or "Cost: $0.001")');
                if (!hasTokens)
                    missing.push('tokens (e.g., "150 tokens" or "Tokens: 100")');
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
    toBeWithinTolerance(received, expected, tolerancePercent = 10) {
        const tolerance = expected * (tolerancePercent / 100);
        const pass = Math.abs(received - expected) <= tolerance;
        return {
            pass,
            message: () => `expected ${received} ${pass ? 'not ' : ''}to be within ${tolerancePercent}% of ${expected} (range: ${expected - tolerance} to ${expected + tolerance})`,
        };
    },
    /**
     * Assert API error has expected structure
     *
     * @example
     * expect(error).toBeXAIError(401);
     */
    toBeXAIError(received, expectedStatus) {
        const isError = received instanceof Error;
        const hasStatusCode = isError && 'statusCode' in received;
        const statusMatches = expectedStatus === undefined ||
            (hasStatusCode && received.statusCode === expectedStatus);
        return {
            pass: isError && hasStatusCode && statusMatches,
            message: () => {
                if (!isError)
                    return 'expected value to be an Error';
                if (!hasStatusCode)
                    return 'expected error to have statusCode property';
                if (!statusMatches)
                    return `expected statusCode ${expectedStatus}, got ${received.statusCode}`;
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
    toBeValidCompletion(received) {
        const isObject = typeof received === 'object' && received !== null;
        const hasChoices = isObject &&
            'choices' in received &&
            Array.isArray(received.choices);
        const hasUsage = isObject && 'usage' in received;
        const hasModel = isObject && 'model' in received;
        const pass = isObject && hasChoices && hasUsage && hasModel;
        return {
            pass,
            message: () => {
                const missing = [];
                if (!isObject)
                    return 'expected value to be an object';
                if (!hasChoices)
                    missing.push('choices array');
                if (!hasUsage)
                    missing.push('usage object');
                if (!hasModel)
                    missing.push('model string');
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
    toBeReasonableResponseTime(received, maxMs = 30000) {
        const pass = received > 0 && received <= maxMs;
        return {
            pass,
            message: () => `expected ${received}ms ${pass ? 'not ' : ''}to be a reasonable response time (0 < x <= ${maxMs}ms)`,
        };
    },
});
//# sourceMappingURL=assertions.js.map
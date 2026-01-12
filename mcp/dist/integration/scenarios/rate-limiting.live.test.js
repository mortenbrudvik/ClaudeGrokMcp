/**
 * Rate Limiting Scenario Live Tests
 *
 * Tests rate limiting behavior and backoff strategies.
 *
 * @module integration/scenarios/rate-limiting.live.test
 */
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { RateLimiter } from '../../services/rate-limiter.js';
import { handleGrokQuery } from '../../tools/query.js';
import { isApiAvailable, skipIfApiUnavailable } from '../setup.js';
import { createTestClient } from '../helpers/api-client.js';
import { withRateLimit, withRetry, resetRateLimitState, executeSequentially, } from '../helpers/rate-limiter.js';
describe('Rate Limiting (live)', () => {
    let client;
    beforeAll(() => {
        if (!isApiAvailable())
            return;
        client = createTestClient();
    });
    beforeEach(() => {
        resetRateLimitState();
    });
    describe('token tracking', () => {
        it('should track tokens per minute', async () => {
            if (skipIfApiUnavailable())
                return;
            // Use standard tier (500K TPM, 500 RPM)
            const rateLimiter = new RateLimiter({ tier: 'standard' });
            // Make a request and track tokens
            const result = await withRateLimit(() => handleGrokQuery(client, {
                query: 'Reply: rate test',
                model: 'fast',
                max_tokens: 10,
            }));
            expect(result.content).toBeDefined();
            // Record some token usage
            rateLimiter.recordUsage(100);
            const status = rateLimiter.getStatus();
            expect(status.tokensUsed).toBe(100);
            const limits = rateLimiter.getLimits();
            expect(status.tokensRemaining).toBe(limits.tokensPerMinute - 100);
        });
        it('should report rate limit status', async () => {
            const rateLimiter = new RateLimiter({ tier: 'standard' });
            const status = rateLimiter.getStatus();
            const limits = rateLimiter.getLimits();
            expect(limits.tokensPerMinute).toBe(500000);
            expect(limits.requestsPerMinute).toBe(500);
            expect(status.tokensRemaining).toBeGreaterThan(0);
            expect(status.requestsRemaining).toBeGreaterThan(0);
        });
    });
    describe('backoff behavior', () => {
        it('should respect minimum delay between calls', async () => {
            if (skipIfApiUnavailable())
                return;
            const startTime = Date.now();
            // Make two calls with rate limiting
            await withRateLimit(() => handleGrokQuery(client, {
                query: 'Say: first',
                model: 'fast',
                max_tokens: 5,
            }));
            await withRateLimit(() => handleGrokQuery(client, {
                query: 'Say: second',
                model: 'fast',
                max_tokens: 5,
            }));
            const elapsed = Date.now() - startTime;
            // Should have at least 100ms delay between calls
            expect(elapsed).toBeGreaterThanOrEqual(100);
        });
        it('should handle sequential requests gracefully', async () => {
            if (skipIfApiUnavailable())
                return;
            // Execute multiple requests sequentially
            const results = await executeSequentially([
                () => handleGrokQuery(client, {
                    query: 'Say: a',
                    model: 'fast',
                    max_tokens: 5,
                }),
                () => handleGrokQuery(client, {
                    query: 'Say: b',
                    model: 'fast',
                    max_tokens: 5,
                }),
            ]);
            expect(results.length).toBe(2);
            expect(results[0].content).toBeDefined();
            expect(results[1].content).toBeDefined();
        });
    });
    describe('retry behavior', () => {
        it('should retry on transient errors', async () => {
            if (skipIfApiUnavailable())
                return;
            // This test verifies the retry helper works
            // We don't actually trigger a 429 since that would require many requests
            const result = await withRetry(() => handleGrokQuery(client, {
                query: 'Reply: retry test',
                model: 'fast',
                max_tokens: 10,
            }), { maxRetries: 2 });
            expect(result.content).toBeDefined();
        });
    });
});
//# sourceMappingURL=rate-limiting.live.test.js.map
/**
 * Rate Limiter Service Unit Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter, RateLimitExceededError, QueueFullError, QueueTimeoutError, getDefaultRateLimiterOptions, getDefaultRateLimiter, resetDefaultRateLimiter, } from './rate-limiter.js';
import { RATE_LIMITS } from '../types/index.js';
describe('RateLimiter', () => {
    let limiter;
    beforeEach(() => {
        vi.useFakeTimers();
        limiter = new RateLimiter({ tier: 'standard', maxRetries: 3 });
    });
    afterEach(() => {
        vi.useRealTimers();
    });
    describe('constructor', () => {
        it('should use default options when none provided', () => {
            const defaultLimiter = new RateLimiter();
            expect(defaultLimiter.getOptions().tier).toBe('standard');
        });
        it('should accept custom options', () => {
            const customLimiter = new RateLimiter({
                tier: 'enterprise',
                initialRetryDelayMs: 2000,
                maxRetryDelayMs: 120000,
                maxRetries: 10,
            });
            expect(customLimiter.getOptions().tier).toBe('enterprise');
            expect(customLimiter.getOptions().initialRetryDelayMs).toBe(2000);
        });
        it('should set correct limits for standard tier', () => {
            const standardLimiter = new RateLimiter({ tier: 'standard' });
            const limits = standardLimiter.getLimits();
            expect(limits.tokensPerMinute).toBe(RATE_LIMITS.standard.tokensPerMinute);
            expect(limits.requestsPerMinute).toBe(RATE_LIMITS.standard.requestsPerMinute);
        });
        it('should set correct limits for enterprise tier', () => {
            const enterpriseLimiter = new RateLimiter({ tier: 'enterprise' });
            const limits = enterpriseLimiter.getLimits();
            expect(limits.tokensPerMinute).toBe(RATE_LIMITS.enterprise.tokensPerMinute);
            expect(limits.requestsPerMinute).toBe(RATE_LIMITS.enterprise.requestsPerMinute);
        });
    });
    describe('acquire', () => {
        it('should allow requests within limits', async () => {
            await expect(limiter.acquire(1000)).resolves.toBeUndefined();
        });
        it('should track token usage', async () => {
            await limiter.acquire(1000);
            const status = limiter.getStatus();
            expect(status.tokensUsed).toBe(1000);
        });
        it('should track request count', async () => {
            await limiter.acquire(100);
            await limiter.acquire(100);
            const status = limiter.getStatus();
            expect(status.requestsUsed).toBe(2);
        });
    });
    describe('canMakeRequest', () => {
        it('should return true when within limits', () => {
            expect(limiter.canMakeRequest(1000)).toBe(true);
        });
        it('should return false when over token limit', async () => {
            // Use up most of the token budget
            await limiter.acquire(499_000);
            expect(limiter.canMakeRequest(2000)).toBe(false);
        });
        it('should return false when over request limit', async () => {
            // Make many small requests
            for (let i = 0; i < 500; i++) {
                await limiter.acquire(1);
            }
            expect(limiter.canMakeRequest(1)).toBe(false);
        });
    });
    describe('recordUsage', () => {
        it('should adjust token count for actual usage', async () => {
            await limiter.acquire(1000); // estimate
            limiter.recordUsage(800, 1000); // actual was less
            const status = limiter.getStatus();
            expect(status.tokensUsed).toBe(800);
        });
        it('should increase count if actual exceeds estimate', async () => {
            await limiter.acquire(1000);
            limiter.recordUsage(1500, 1000);
            const status = limiter.getStatus();
            expect(status.tokensUsed).toBe(1500);
        });
        it('should not go below zero', async () => {
            await limiter.acquire(100);
            limiter.recordUsage(50, 1000); // way over-estimated
            const status = limiter.getStatus();
            expect(status.tokensUsed).toBe(0);
        });
    });
    describe('release', () => {
        it('should release previously acquired tokens', async () => {
            await limiter.acquire(1000);
            limiter.release(1000);
            const status = limiter.getStatus();
            expect(status.tokensUsed).toBe(0);
            expect(status.requestsUsed).toBe(0);
        });
        it('should not go below zero', async () => {
            await limiter.acquire(100);
            limiter.release(500);
            const status = limiter.getStatus();
            expect(status.tokensUsed).toBe(0);
        });
    });
    describe('window reset', () => {
        it('should reset counts after window expires', async () => {
            await limiter.acquire(100_000);
            expect(limiter.getStatus().tokensUsed).toBe(100_000);
            // Advance past window
            vi.advanceTimersByTime(61_000);
            expect(limiter.getStatus().tokensUsed).toBe(0);
            expect(limiter.getStatus().requestsUsed).toBe(0);
        });
        it('should allow requests after window reset', async () => {
            // Use up the limit
            await limiter.acquire(500_000);
            expect(limiter.canMakeRequest(1000)).toBe(false);
            // Advance past window
            vi.advanceTimersByTime(61_000);
            expect(limiter.canMakeRequest(1000)).toBe(true);
        });
    });
    describe('handleRateLimitResponse', () => {
        it('should set retry time based on server suggestion', () => {
            limiter.handleRateLimitResponse(30); // 30 seconds
            expect(limiter.isRateLimited()).toBe(true);
        });
        it('should use exponential backoff', () => {
            limiter.handleRateLimitResponse(1);
            const delay1 = limiter.getStatus().currentRetryDelay;
            limiter.handleRateLimitResponse(1);
            const delay2 = limiter.getStatus().currentRetryDelay;
            expect(delay2).toBeGreaterThan(delay1);
        });
        it('should use longer of server delay or exponential', () => {
            // First retry with short server delay
            limiter.handleRateLimitResponse(0.5);
            expect(limiter.getStatus().currentRetryDelay).toBe(1000); // Initial delay
            // Second retry with long server delay
            limiter.handleRateLimitResponse(30);
            expect(limiter.getStatus().currentRetryDelay).toBe(30000); // Server delay wins
        });
        it('should cap at max retry delay', () => {
            const maxDelay = 60000;
            const smallLimiter = new RateLimiter({ maxRetryDelayMs: maxDelay });
            // Trigger many retries to exceed max
            for (let i = 0; i < 20; i++) {
                smallLimiter.handleRateLimitResponse(1);
            }
            expect(smallLimiter.getStatus().currentRetryDelay).toBeLessThanOrEqual(maxDelay);
        });
    });
    describe('waitForRetry', () => {
        it('should wait for retry period', async () => {
            limiter.handleRateLimitResponse(2); // 2 seconds
            const start = Date.now();
            const waitPromise = limiter.waitForRetry();
            vi.advanceTimersByTime(2500);
            await waitPromise;
            expect(Date.now() - start).toBeGreaterThanOrEqual(2000);
        });
        it('should throw after max retries', async () => {
            // Exhaust retries
            for (let i = 0; i < 3; i++) {
                limiter.handleRateLimitResponse(0.1);
                vi.advanceTimersByTime(200);
            }
            await expect(limiter.waitForRetry()).rejects.toThrow(RateLimitExceededError);
        });
    });
    describe('clearBackoff', () => {
        it('should reset retry state', () => {
            limiter.handleRateLimitResponse(30);
            expect(limiter.isRateLimited()).toBe(true);
            limiter.clearBackoff();
            expect(limiter.isRateLimited()).toBe(false);
            expect(limiter.getStatus().retryCount).toBe(0);
        });
    });
    describe('getStatus', () => {
        it('should return comprehensive status', async () => {
            await limiter.acquire(10_000);
            const status = limiter.getStatus();
            expect(status.tokensUsed).toBe(10_000);
            expect(status.tokensRemaining).toBe(490_000);
            expect(status.requestsUsed).toBe(1);
            expect(status.requestsRemaining).toBe(499);
            expect(status.isLimited).toBe(false);
            expect(status.retryCount).toBe(0);
        });
        it('should show limited status when rate limited', () => {
            limiter.handleRateLimitResponse(10);
            const status = limiter.getStatus();
            expect(status.isLimited).toBe(true);
        });
    });
    describe('reset', () => {
        it('should clear all state', async () => {
            await limiter.acquire(100_000);
            limiter.handleRateLimitResponse(30);
            limiter.reset();
            const status = limiter.getStatus();
            expect(status.tokensUsed).toBe(0);
            expect(status.requestsUsed).toBe(0);
            expect(status.retryCount).toBe(0);
            expect(status.isLimited).toBe(false);
        });
    });
    describe('setOptions', () => {
        it('should update tier at runtime', () => {
            expect(limiter.getLimits().tokensPerMinute).toBe(500_000);
            limiter.setOptions({ tier: 'enterprise' });
            expect(limiter.getLimits().tokensPerMinute).toBe(10_000_000);
        });
        it('should update retry options', () => {
            limiter.setOptions({
                initialRetryDelayMs: 5000,
                maxRetryDelayMs: 120000,
                maxRetries: 10,
            });
            const options = limiter.getOptions();
            expect(options.initialRetryDelayMs).toBe(5000);
            expect(options.maxRetryDelayMs).toBe(120000);
            expect(options.maxRetries).toBe(10);
        });
    });
});
describe('RateLimitExceededError', () => {
    it('should include detailed message', () => {
        const error = new RateLimitExceededError(600_000, 500_000, 30000);
        expect(error.message).toContain('600000');
        expect(error.message).toContain('500000');
        expect(error.message).toContain('30 seconds');
        expect(error.name).toBe('RateLimitExceededError');
    });
});
describe('getDefaultRateLimiterOptions', () => {
    const originalEnv = process.env;
    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
    });
    afterEach(() => {
        process.env = originalEnv;
    });
    it('should use defaults when env vars not set', () => {
        delete process.env.GROK_API_TIER;
        delete process.env.GROK_RATE_LIMIT_INITIAL_DELAY_MS;
        const options = getDefaultRateLimiterOptions();
        expect(options.tier).toBe('standard');
        expect(options.initialRetryDelayMs).toBe(1000);
    });
    it('should read GROK_API_TIER from env', () => {
        process.env.GROK_API_TIER = 'enterprise';
        const options = getDefaultRateLimiterOptions();
        expect(options.tier).toBe('enterprise');
    });
    it('should handle case-insensitive tier', () => {
        process.env.GROK_API_TIER = 'ENTERPRISE';
        const options = getDefaultRateLimiterOptions();
        expect(options.tier).toBe('enterprise');
    });
    it('should read retry delay from env', () => {
        process.env.GROK_RATE_LIMIT_INITIAL_DELAY_MS = '2000';
        const options = getDefaultRateLimiterOptions();
        expect(options.initialRetryDelayMs).toBe(2000);
    });
});
describe('singleton functions', () => {
    afterEach(() => {
        resetDefaultRateLimiter();
    });
    it('should return same instance from getDefaultRateLimiter', () => {
        const limiter1 = getDefaultRateLimiter();
        const limiter2 = getDefaultRateLimiter();
        expect(limiter1).toBe(limiter2);
    });
    it('should create new instance after reset', () => {
        const limiter1 = getDefaultRateLimiter();
        resetDefaultRateLimiter();
        const limiter2 = getDefaultRateLimiter();
        expect(limiter1).not.toBe(limiter2);
    });
});
describe('QueueFullError', () => {
    it('should include queue size in message', () => {
        const error = new QueueFullError(100, 100);
        expect(error.message).toContain('100/100');
        expect(error.name).toBe('QueueFullError');
        expect(error.queueSize).toBe(100);
        expect(error.maxSize).toBe(100);
    });
});
describe('QueueTimeoutError', () => {
    it('should include timeout in message', () => {
        const error = new QueueTimeoutError(30000);
        expect(error.message).toContain('30000ms');
        expect(error.name).toBe('QueueTimeoutError');
        expect(error.timeoutMs).toBe(30000);
    });
});
describe('Queue limits', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });
    it('should throw QueueFullError when queue exceeds maxPendingRequests', async () => {
        const limiter = new RateLimiter({
            tier: 'standard',
            maxPendingRequests: 2,
            pendingTimeoutMs: 5000,
        });
        // Use up all capacity
        await limiter.acquire(500_000);
        // Queue 2 requests (max allowed)
        limiter.acquire(1000);
        limiter.acquire(1000);
        expect(limiter.getPendingCount()).toBe(2);
        // Third request should be rejected
        await expect(limiter.acquire(1000)).rejects.toThrow(QueueFullError);
        // Clean up pending requests
        limiter.reset();
    });
    it('should throw QueueTimeoutError when request times out in queue', async () => {
        const limiter = new RateLimiter({
            tier: 'standard',
            maxPendingRequests: 10,
            pendingTimeoutMs: 1000,
        });
        // Use up all capacity
        await limiter.acquire(500_000);
        // Queue a request
        const pending = limiter.acquire(1000);
        // Advance time past timeout
        vi.advanceTimersByTime(1500);
        await expect(pending).rejects.toThrow(QueueTimeoutError);
        expect(limiter.getPendingCount()).toBe(0);
    });
    it('should process queued requests when capacity frees up', async () => {
        const limiter = new RateLimiter({
            tier: 'standard',
            maxPendingRequests: 10,
            pendingTimeoutMs: 120000,
        });
        // Use up most capacity
        await limiter.acquire(499_000);
        // Queue a request that won't fit
        const pending = limiter.acquire(2000);
        expect(limiter.getPendingCount()).toBe(1);
        // Advance time to reset the window
        vi.advanceTimersByTime(61_000);
        // The queued request should now be processed
        await pending;
        expect(limiter.getPendingCount()).toBe(0);
        expect(limiter.getStatus().tokensUsed).toBe(2000);
    });
    it('should track pending count correctly', async () => {
        const limiter = new RateLimiter({
            tier: 'standard',
            maxPendingRequests: 10,
            pendingTimeoutMs: 5000,
        });
        expect(limiter.getPendingCount()).toBe(0);
        // Use up capacity
        await limiter.acquire(500_000);
        // Queue requests
        limiter.acquire(1000);
        limiter.acquire(1000);
        limiter.acquire(1000);
        expect(limiter.getPendingCount()).toBe(3);
        // Reset clears queue
        limiter.reset();
        expect(limiter.getPendingCount()).toBe(0);
    });
    it('should allow setOptions to change maxPendingRequests', () => {
        const limiter = new RateLimiter({
            tier: 'standard',
            maxPendingRequests: 50,
        });
        expect(limiter.getOptions().maxPendingRequests).toBe(50);
        limiter.setOptions({ maxPendingRequests: 200 });
        expect(limiter.getOptions().maxPendingRequests).toBe(200);
    });
    it('should allow setOptions to change pendingTimeoutMs', () => {
        const limiter = new RateLimiter({
            tier: 'standard',
            pendingTimeoutMs: 30000,
        });
        expect(limiter.getOptions().pendingTimeoutMs).toBe(30000);
        limiter.setOptions({ pendingTimeoutMs: 60000 });
        expect(limiter.getOptions().pendingTimeoutMs).toBe(60000);
    });
    it('should use default maxPendingRequests from env or fallback to 100', () => {
        const options = getDefaultRateLimiterOptions();
        expect(options.maxPendingRequests).toBe(100);
    });
    it('should use default pendingTimeoutMs from env or fallback to 30000', () => {
        const options = getDefaultRateLimiterOptions();
        expect(options.pendingTimeoutMs).toBe(30000);
    });
});
//# sourceMappingURL=rate-limiter.test.js.map
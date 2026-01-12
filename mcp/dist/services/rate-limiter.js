/**
 * Rate Limiter Service
 *
 * Implements token bucket rate limiting with tier-aware limits
 * and exponential backoff for API rate limit handling.
 *
 * @module services/rate-limiter
 */
import { RATE_LIMITS } from '../types/index.js';
/**
 * Error thrown when rate limit is exceeded and retries exhausted
 */
export class RateLimitExceededError extends Error {
    tokensUsed;
    tokensLimit;
    retryAfterMs;
    constructor(tokensUsed, tokensLimit, retryAfterMs) {
        super(`Rate limit exceeded: ${tokensUsed} tokens used of ${tokensLimit} limit. ` +
            `Retry after ${Math.ceil(retryAfterMs / 1000)} seconds.`);
        this.tokensUsed = tokensUsed;
        this.tokensLimit = tokensLimit;
        this.retryAfterMs = retryAfterMs;
        this.name = 'RateLimitExceededError';
    }
}
/**
 * Error thrown when the pending request queue is full
 */
export class QueueFullError extends Error {
    queueSize;
    maxSize;
    constructor(queueSize, maxSize) {
        super(`Rate limit queue full (${queueSize}/${maxSize}). Try again later.`);
        this.queueSize = queueSize;
        this.maxSize = maxSize;
        this.name = 'QueueFullError';
    }
}
/**
 * Error thrown when a queued request times out
 */
export class QueueTimeoutError extends Error {
    timeoutMs;
    constructor(timeoutMs) {
        super(`Request timed out waiting for rate limit (${timeoutMs}ms).`);
        this.timeoutMs = timeoutMs;
        this.name = 'QueueTimeoutError';
    }
}
/**
 * Default options loaded from environment variables
 */
export function getDefaultRateLimiterOptions() {
    const tierEnv = process.env.GROK_API_TIER?.toLowerCase();
    const tier = tierEnv === 'enterprise' ? 'enterprise' : 'standard';
    return {
        tier,
        initialRetryDelayMs: parseInt(process.env.GROK_RATE_LIMIT_INITIAL_DELAY_MS || '1000', 10),
        maxRetryDelayMs: parseInt(process.env.GROK_RATE_LIMIT_MAX_DELAY_MS || '60000', 10),
        maxRetries: parseInt(process.env.GROK_RATE_LIMIT_MAX_RETRIES || '5', 10),
        maxPendingRequests: parseInt(process.env.GROK_RATE_LIMIT_MAX_PENDING || '100', 10),
        pendingTimeoutMs: parseInt(process.env.GROK_RATE_LIMIT_PENDING_TIMEOUT_MS || '30000', 10),
    };
}
/**
 * Rate Limiter for xAI API
 *
 * Uses a token bucket algorithm to track usage within
 * a sliding 60-second window. Provides:
 * - Pre-request limit checking
 * - Post-request token consumption tracking
 * - Exponential backoff on 429 responses
 * - Tier-aware limits (standard vs enterprise)
 *
 * @example
 * ```typescript
 * const limiter = new RateLimiter({ tier: 'standard' });
 *
 * // Before making a request
 * await limiter.acquire(100); // estimated tokens
 *
 * // After request completes
 * limiter.recordUsage(actualTokens);
 *
 * // If 429 received
 * limiter.handleRateLimitResponse(retryAfterSeconds);
 * await limiter.waitForRetry();
 * ```
 */
export class RateLimiter {
    options;
    limits;
    // Token bucket state
    tokensUsed = 0;
    requestsUsed = 0;
    windowStart = Date.now();
    windowDurationMs = 60_000;
    // Backoff state
    retryCount = 0;
    nextRetryTime = 0;
    currentRetryDelay = 0;
    // Request queue
    pendingRequests = [];
    isProcessingQueue = false;
    constructor(options) {
        const defaults = getDefaultRateLimiterOptions();
        this.options = {
            tier: options?.tier ?? defaults.tier,
            initialRetryDelayMs: options?.initialRetryDelayMs ?? defaults.initialRetryDelayMs,
            maxRetryDelayMs: options?.maxRetryDelayMs ?? defaults.maxRetryDelayMs,
            maxRetries: options?.maxRetries ?? defaults.maxRetries,
            maxPendingRequests: options?.maxPendingRequests ?? defaults.maxPendingRequests,
            pendingTimeoutMs: options?.pendingTimeoutMs ?? defaults.pendingTimeoutMs,
        };
        this.limits = RATE_LIMITS[this.options.tier];
        this.currentRetryDelay = this.options.initialRetryDelayMs;
    }
    /**
     * Acquire permission to make a request
     *
     * Waits if rate limited, throws if limit exceeded after retries.
     *
     * @param estimatedTokens - Estimated tokens for the request
     * @throws RateLimitExceededError if limit exceeded and retries exhausted
     * @throws QueueFullError if pending request queue is at capacity
     * @throws QueueTimeoutError if request times out waiting in queue
     */
    async acquire(estimatedTokens = 0) {
        // Check if we need to wait for retry
        if (this.isRateLimited()) {
            await this.waitForRetry();
        }
        // Refresh window if needed
        this.maybeResetWindow();
        // Check if within limits
        if (!this.canMakeRequest(estimatedTokens)) {
            // Check if queue is full
            if (this.pendingRequests.length >= this.options.maxPendingRequests) {
                throw new QueueFullError(this.pendingRequests.length, this.options.maxPendingRequests);
            }
            // Queue the request with timeout
            return new Promise((resolve, reject) => {
                const request = { resolve, reject, estimatedTokens };
                // Set up timeout
                request.timeoutId = setTimeout(() => {
                    const index = this.pendingRequests.indexOf(request);
                    if (index !== -1) {
                        this.pendingRequests.splice(index, 1);
                        reject(new QueueTimeoutError(this.options.pendingTimeoutMs));
                    }
                }, this.options.pendingTimeoutMs);
                this.pendingRequests.push(request);
                this.processQueue();
            });
        }
        // Reserve the tokens
        this.tokensUsed += estimatedTokens;
        this.requestsUsed++;
    }
    /**
     * Record actual token usage after a request completes
     *
     * Adjusts the token count based on actual vs estimated usage.
     *
     * @param actualTokens - Actual tokens used by the request
     * @param estimatedTokens - Previously estimated tokens (optional)
     */
    recordUsage(actualTokens, estimatedTokens = 0) {
        // Adjust for difference between estimated and actual
        const adjustment = actualTokens - estimatedTokens;
        this.tokensUsed = Math.max(0, this.tokensUsed + adjustment);
    }
    /**
     * Release a previously acquired request slot
     *
     * Call this if a request fails before consuming tokens.
     *
     * @param estimatedTokens - Previously estimated tokens to release
     */
    release(estimatedTokens = 0) {
        this.tokensUsed = Math.max(0, this.tokensUsed - estimatedTokens);
        this.requestsUsed = Math.max(0, this.requestsUsed - 1);
    }
    /**
     * Handle a 429 rate limit response from the API
     *
     * Updates backoff state based on retry-after header.
     *
     * @param retryAfterSeconds - Seconds to wait (from Retry-After header)
     */
    handleRateLimitResponse(retryAfterSeconds) {
        this.retryCount++;
        // Use the longer of: server-suggested delay or exponential backoff
        const exponentialDelay = Math.min(this.options.initialRetryDelayMs * Math.pow(2, this.retryCount - 1), this.options.maxRetryDelayMs);
        const serverDelay = retryAfterSeconds * 1000;
        this.currentRetryDelay = Math.max(exponentialDelay, serverDelay);
        this.nextRetryTime = Date.now() + this.currentRetryDelay;
    }
    /**
     * Wait for the retry period to elapse
     *
     * @throws RateLimitExceededError if max retries exceeded
     */
    async waitForRetry() {
        if (this.retryCount >= this.options.maxRetries) {
            throw new RateLimitExceededError(this.tokensUsed, this.limits.tokensPerMinute, this.currentRetryDelay);
        }
        const waitTime = Math.max(0, this.nextRetryTime - Date.now());
        if (waitTime > 0) {
            await this.sleep(waitTime);
        }
    }
    /**
     * Check if currently rate limited
     */
    isRateLimited() {
        return Date.now() < this.nextRetryTime;
    }
    /**
     * Check if a request can be made within limits
     */
    canMakeRequest(estimatedTokens = 0) {
        this.maybeResetWindow();
        return (this.tokensUsed + estimatedTokens <= this.limits.tokensPerMinute &&
            this.requestsUsed < this.limits.requestsPerMinute);
    }
    /**
     * Get current rate limit status
     */
    getStatus() {
        this.maybeResetWindow();
        const resetInMs = Math.max(0, this.windowStart + this.windowDurationMs - Date.now());
        return {
            tokensUsed: this.tokensUsed,
            tokensRemaining: Math.max(0, this.limits.tokensPerMinute - this.tokensUsed),
            requestsUsed: this.requestsUsed,
            requestsRemaining: Math.max(0, this.limits.requestsPerMinute - this.requestsUsed),
            resetInMs,
            isLimited: this.isRateLimited(),
            currentRetryDelay: this.currentRetryDelay,
            retryCount: this.retryCount,
        };
    }
    /**
     * Reset the rate limiter state
     */
    reset() {
        this.tokensUsed = 0;
        this.requestsUsed = 0;
        this.windowStart = Date.now();
        this.retryCount = 0;
        this.nextRetryTime = 0;
        this.currentRetryDelay = this.options.initialRetryDelayMs;
        // Clear all pending request timeouts
        for (const request of this.pendingRequests) {
            if (request.timeoutId) {
                clearTimeout(request.timeoutId);
            }
        }
        this.pendingRequests = [];
    }
    /**
     * Clear the backoff state (after successful request)
     */
    clearBackoff() {
        this.retryCount = 0;
        this.nextRetryTime = 0;
        this.currentRetryDelay = this.options.initialRetryDelayMs;
    }
    /**
     * Update options at runtime
     */
    setOptions(options) {
        if (options.tier !== undefined) {
            this.options.tier = options.tier;
            this.limits = RATE_LIMITS[options.tier];
        }
        if (options.initialRetryDelayMs !== undefined) {
            this.options.initialRetryDelayMs = options.initialRetryDelayMs;
        }
        if (options.maxRetryDelayMs !== undefined) {
            this.options.maxRetryDelayMs = options.maxRetryDelayMs;
        }
        if (options.maxRetries !== undefined) {
            this.options.maxRetries = options.maxRetries;
        }
        if (options.maxPendingRequests !== undefined) {
            this.options.maxPendingRequests = options.maxPendingRequests;
        }
        if (options.pendingTimeoutMs !== undefined) {
            this.options.pendingTimeoutMs = options.pendingTimeoutMs;
        }
    }
    /**
     * Get current options
     */
    getOptions() {
        return { ...this.options };
    }
    /**
     * Get tier limits
     */
    getLimits() {
        return { ...this.limits };
    }
    /**
     * Get the number of pending requests in queue
     */
    getPendingCount() {
        return this.pendingRequests.length;
    }
    // Private methods
    maybeResetWindow() {
        const now = Date.now();
        if (now - this.windowStart >= this.windowDurationMs) {
            this.tokensUsed = 0;
            this.requestsUsed = 0;
            this.windowStart = now;
        }
    }
    async processQueue() {
        if (this.isProcessingQueue)
            return;
        this.isProcessingQueue = true;
        try {
            while (this.pendingRequests.length > 0) {
                // Wait for window reset if needed
                const status = this.getStatus();
                if (status.resetInMs > 0 && !this.canMakeRequest(this.pendingRequests[0].estimatedTokens)) {
                    await this.sleep(status.resetInMs + 100); // Small buffer
                    this.maybeResetWindow();
                }
                const request = this.pendingRequests[0];
                if (this.canMakeRequest(request.estimatedTokens)) {
                    this.pendingRequests.shift();
                    // Clear timeout before resolving
                    if (request.timeoutId) {
                        clearTimeout(request.timeoutId);
                    }
                    this.tokensUsed += request.estimatedTokens;
                    this.requestsUsed++;
                    request.resolve();
                }
                else {
                    // Still can't process, wait for next window
                    break;
                }
            }
        }
        finally {
            this.isProcessingQueue = false;
        }
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
/**
 * Singleton instance for shared use
 */
let defaultLimiterInstance = null;
/**
 * Get or create the default rate limiter instance
 */
export function getDefaultRateLimiter() {
    if (!defaultLimiterInstance) {
        defaultLimiterInstance = new RateLimiter();
    }
    return defaultLimiterInstance;
}
/**
 * Reset the default limiter instance
 */
export function resetDefaultRateLimiter() {
    defaultLimiterInstance = null;
}
//# sourceMappingURL=rate-limiter.js.map
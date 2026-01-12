/**
 * Rate Limiter Service
 *
 * Implements token bucket rate limiting with tier-aware limits
 * and exponential backoff for API rate limit handling.
 *
 * @module services/rate-limiter
 */
import { APITier } from '../types/index.js';
/**
 * Configuration options for the rate limiter
 */
export interface RateLimiterOptions {
    /** API tier (standard or enterprise) */
    tier: APITier;
    /** Initial retry delay in ms (default: 1000) */
    initialRetryDelayMs: number;
    /** Maximum retry delay in ms (default: 60000) */
    maxRetryDelayMs: number;
    /** Maximum retries before giving up (default: 5) */
    maxRetries: number;
    /** Maximum pending requests in queue (default: 100) */
    maxPendingRequests: number;
    /** Timeout for pending requests in ms (default: 30000) */
    pendingTimeoutMs: number;
}
/**
 * Rate limit status information
 */
export interface RateLimitStatus {
    /** Tokens used in current window */
    tokensUsed: number;
    /** Tokens remaining in current window */
    tokensRemaining: number;
    /** Requests made in current window */
    requestsUsed: number;
    /** Requests remaining in current window */
    requestsRemaining: number;
    /** Time until window resets (ms) */
    resetInMs: number;
    /** Whether currently rate limited */
    isLimited: boolean;
    /** Current retry delay if limited (ms) */
    currentRetryDelay: number;
    /** Number of retries attempted */
    retryCount: number;
}
/**
 * Error thrown when rate limit is exceeded and retries exhausted
 */
export declare class RateLimitExceededError extends Error {
    tokensUsed: number;
    tokensLimit: number;
    retryAfterMs: number;
    constructor(tokensUsed: number, tokensLimit: number, retryAfterMs: number);
}
/**
 * Error thrown when the pending request queue is full
 */
export declare class QueueFullError extends Error {
    queueSize: number;
    maxSize: number;
    constructor(queueSize: number, maxSize: number);
}
/**
 * Error thrown when a queued request times out
 */
export declare class QueueTimeoutError extends Error {
    timeoutMs: number;
    constructor(timeoutMs: number);
}
/**
 * Default options loaded from environment variables
 */
export declare function getDefaultRateLimiterOptions(): RateLimiterOptions;
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
export declare class RateLimiter {
    private options;
    private limits;
    private tokensUsed;
    private requestsUsed;
    private windowStart;
    private readonly windowDurationMs;
    private retryCount;
    private nextRetryTime;
    private currentRetryDelay;
    private pendingRequests;
    private isProcessingQueue;
    constructor(options?: Partial<RateLimiterOptions>);
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
    acquire(estimatedTokens?: number): Promise<void>;
    /**
     * Record actual token usage after a request completes
     *
     * Adjusts the token count based on actual vs estimated usage.
     *
     * @param actualTokens - Actual tokens used by the request
     * @param estimatedTokens - Previously estimated tokens (optional)
     */
    recordUsage(actualTokens: number, estimatedTokens?: number): void;
    /**
     * Release a previously acquired request slot
     *
     * Call this if a request fails before consuming tokens.
     *
     * @param estimatedTokens - Previously estimated tokens to release
     */
    release(estimatedTokens?: number): void;
    /**
     * Handle a 429 rate limit response from the API
     *
     * Updates backoff state based on retry-after header.
     *
     * @param retryAfterSeconds - Seconds to wait (from Retry-After header)
     */
    handleRateLimitResponse(retryAfterSeconds: number): void;
    /**
     * Wait for the retry period to elapse
     *
     * @throws RateLimitExceededError if max retries exceeded
     */
    waitForRetry(): Promise<void>;
    /**
     * Check if currently rate limited
     */
    isRateLimited(): boolean;
    /**
     * Check if a request can be made within limits
     */
    canMakeRequest(estimatedTokens?: number): boolean;
    /**
     * Get current rate limit status
     */
    getStatus(): RateLimitStatus;
    /**
     * Reset the rate limiter state
     */
    reset(): void;
    /**
     * Clear the backoff state (after successful request)
     */
    clearBackoff(): void;
    /**
     * Update options at runtime
     */
    setOptions(options: Partial<RateLimiterOptions>): void;
    /**
     * Get current options
     */
    getOptions(): Readonly<RateLimiterOptions>;
    /**
     * Get tier limits
     */
    getLimits(): {
        tokensPerMinute: number;
        requestsPerMinute: number;
    };
    /**
     * Get the number of pending requests in queue
     */
    getPendingCount(): number;
    private maybeResetWindow;
    private processQueue;
    private sleep;
}
/**
 * Get or create the default rate limiter instance
 */
export declare function getDefaultRateLimiter(): RateLimiter;
/**
 * Reset the default limiter instance
 */
export declare function resetDefaultRateLimiter(): void;
//# sourceMappingURL=rate-limiter.d.ts.map
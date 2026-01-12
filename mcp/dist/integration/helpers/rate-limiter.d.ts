/**
 * Rate Limit Test Utilities
 *
 * Helpers for testing rate limiting and backoff behavior.
 *
 * @module integration/helpers/rate-limiter
 */
/**
 * Sleep for specified milliseconds
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after delay
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Execute function with rate limiting
 *
 * Ensures minimum delay between API calls to avoid triggering
 * rate limits during tests.
 *
 * @param fn - Function to execute
 * @returns Promise with function result
 *
 * @example
 * ```typescript
 * const result = await withRateLimit(() => client.chatCompletion(params));
 * ```
 */
export declare function withRateLimit<T>(fn: () => Promise<T>): Promise<T>;
/**
 * Options for retry behavior
 */
export interface RetryOptions {
    /** Maximum number of retries (default: 3) */
    maxRetries?: number;
    /** Base delay in milliseconds (default: 1000) */
    baseDelayMs?: number;
    /** Maximum delay in milliseconds (default: 30000) */
    maxDelayMs?: number;
    /** Whether to log retry attempts (default: true) */
    logRetries?: boolean;
}
/**
 * Execute with retry on rate limit (429)
 *
 * Implements exponential backoff for rate limit errors.
 *
 * @param fn - Function to execute
 * @param options - Retry configuration
 * @returns Promise with function result
 * @throws Last error if all retries exhausted
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => client.chatCompletion(params),
 *   { maxRetries: 5 }
 * );
 * ```
 */
export declare function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
/**
 * Reset rate limit state (for test isolation)
 *
 * Call this in beforeEach or afterEach to reset state between tests.
 */
export declare function resetRateLimitState(): void;
/**
 * Get time until next call is allowed
 *
 * @returns Milliseconds until next call, or 0 if ready
 */
export declare function getTimeUntilNextCall(): number;
/**
 * Wait until rate limit allows next call
 *
 * @returns Promise that resolves when ready
 */
export declare function waitForRateLimit(): Promise<void>;
/**
 * Create a rate-limited wrapper for a function
 *
 * @param fn - Function to wrap
 * @returns Rate-limited version of the function
 *
 * @example
 * ```typescript
 * const rateLimitedQuery = createRateLimitedFn(
 *   (query: string) => client.chatCompletion({ messages: [{ role: 'user', content: query }] })
 * );
 * ```
 */
export declare function createRateLimitedFn<T extends unknown[], R>(fn: (...args: T) => Promise<R>): (...args: T) => Promise<R>;
/**
 * Execute multiple functions in sequence with rate limiting
 *
 * @param fns - Array of functions to execute
 * @returns Array of results
 *
 * @example
 * ```typescript
 * const results = await executeSequentially([
 *   () => client.chatCompletion(params1),
 *   () => client.chatCompletion(params2),
 * ]);
 * ```
 */
export declare function executeSequentially<T>(fns: Array<() => Promise<T>>): Promise<T[]>;
//# sourceMappingURL=rate-limiter.d.ts.map
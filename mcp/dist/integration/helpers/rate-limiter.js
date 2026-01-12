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
export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/** Minimum delay between API calls to avoid rate limits */
const MIN_DELAY_MS = 100;
/** Track last call time for rate limiting */
let lastCallTime = 0;
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
export async function withRateLimit(fn) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;
    if (timeSinceLastCall < MIN_DELAY_MS) {
        await sleep(MIN_DELAY_MS - timeSinceLastCall);
    }
    lastCallTime = Date.now();
    return fn();
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
export async function withRetry(fn, options = {}) {
    const { maxRetries = 3, baseDelayMs = 1000, maxDelayMs = 30000, logRetries = true } = options;
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await withRateLimit(fn);
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            // Check if rate limited (429)
            const isRateLimited = 'statusCode' in lastError && lastError.statusCode === 429;
            if (!isRateLimited || attempt === maxRetries) {
                throw lastError;
            }
            // Exponential backoff with jitter
            const jitter = Math.random() * 0.1 * baseDelayMs;
            const delay = Math.min(baseDelayMs * Math.pow(2, attempt) + jitter, maxDelayMs);
            if (logRetries) {
                console.log(`  Rate limited, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})`);
            }
            await sleep(delay);
        }
    }
    throw lastError;
}
/**
 * Reset rate limit state (for test isolation)
 *
 * Call this in beforeEach or afterEach to reset state between tests.
 */
export function resetRateLimitState() {
    lastCallTime = 0;
}
/**
 * Get time until next call is allowed
 *
 * @returns Milliseconds until next call, or 0 if ready
 */
export function getTimeUntilNextCall() {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;
    return Math.max(0, MIN_DELAY_MS - timeSinceLastCall);
}
/**
 * Wait until rate limit allows next call
 *
 * @returns Promise that resolves when ready
 */
export async function waitForRateLimit() {
    const waitTime = getTimeUntilNextCall();
    if (waitTime > 0) {
        await sleep(waitTime);
    }
}
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
export function createRateLimitedFn(fn) {
    return (...args) => withRateLimit(() => fn(...args));
}
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
export async function executeSequentially(fns) {
    const results = [];
    for (const fn of fns) {
        results.push(await withRateLimit(fn));
    }
    return results;
}
//# sourceMappingURL=rate-limiter.js.map
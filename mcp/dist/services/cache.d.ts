/**
 * Response Cache Service
 *
 * Provides TTL-based caching for Grok API responses to reduce costs
 * and improve response times for repeated queries.
 *
 * @module services/cache
 */
import { GrokQueryResponse } from '../types/index.js';
/**
 * Configuration options for the cache service
 */
export interface CacheOptions {
    /** Whether caching is enabled (default: true) */
    enabled: boolean;
    /** Time-to-live in seconds (default: 300 = 5 minutes) */
    ttlSeconds: number;
    /** Maximum number of entries to store (default: 1000) */
    maxEntries: number;
}
/**
 * Cache statistics
 */
export interface CacheStats {
    /** Number of cache hits */
    hits: number;
    /** Number of cache misses */
    misses: number;
    /** Current number of entries in cache */
    size: number;
    /** Maximum entries allowed in cache */
    maxEntries: number;
    /** Total bytes of cached responses (approximate) */
    approximateBytes: number;
}
/**
 * Default cache options loaded from environment variables
 */
export declare function getDefaultCacheOptions(): CacheOptions;
/**
 * Response cache for Grok API queries
 *
 * Stores responses keyed by a hash of query parameters.
 * Automatically evicts expired entries on access.
 *
 * @example
 * ```typescript
 * const cache = new ResponseCache({ enabled: true, ttlSeconds: 300 });
 *
 * // Check cache before making API call
 * const key = cache.generateKey('What is 2+2?', 'grok-4-fast');
 * const cached = cache.get(key);
 * if (cached) {
 *   return { ...cached, cached: true };
 * }
 *
 * // After API call, store result
 * cache.set(key, response);
 * ```
 */
export declare class ResponseCache {
    private cache;
    private options;
    private stats;
    constructor(options?: Partial<CacheOptions>);
    /**
     * Check if caching is enabled
     */
    isEnabled(): boolean;
    /**
     * Generate a cache key from query parameters
     *
     * Uses SHA-256 hash of normalized parameters for consistent keying.
     *
     * @param query - The user's query string
     * @param model - The model ID being used
     * @param context - Optional system context
     * @returns A hex string cache key
     */
    generateKey(query: string, model: string, context?: string): string;
    /**
     * Store a response in the cache
     *
     * If caching is disabled, this is a no-op.
     * Uses LRU eviction when max size is reached.
     *
     * @param key - Cache key from generateKey()
     * @param response - The Grok API response to cache
     */
    set(key: string, response: GrokQueryResponse): void;
    /**
     * Retrieve a cached response
     *
     * Returns null if:
     * - Caching is disabled
     * - Key not found
     * - Entry has expired
     *
     * Updates LRU order on successful access.
     *
     * @param key - Cache key from generateKey()
     * @returns The cached response or null
     */
    get(key: string): GrokQueryResponse | null;
    /**
     * Check if a key exists and is not expired
     *
     * @param key - Cache key to check
     * @returns True if cached and valid
     */
    has(key: string): boolean;
    /**
     * Clear all cached entries
     */
    clear(): void;
    /**
     * Reset cache statistics
     */
    resetStats(): void;
    /**
     * Get cache statistics
     *
     * @returns Current cache stats including hit rate
     */
    getStats(): CacheStats;
    /**
     * Get cache hit rate as a percentage
     *
     * @returns Hit rate from 0 to 100, or 0 if no requests
     */
    getHitRate(): number;
    /**
     * Update cache options at runtime
     *
     * @param options - New options to apply
     */
    setOptions(options: Partial<CacheOptions>): void;
    /**
     * Get current cache options
     */
    getOptions(): Readonly<CacheOptions>;
    /**
     * Evict all expired entries
     *
     * Called automatically during set() operations.
     * Can be called manually for immediate cleanup.
     *
     * @returns Number of entries evicted
     */
    evictExpired(): number;
    /**
     * Get expiration time for a cached entry
     *
     * @param key - Cache key to check
     * @returns ISO timestamp when entry expires, or null if not found
     */
    getExpiresAt(key: string): string | null;
}
/**
 * Get or create the default cache instance
 *
 * Uses environment variables for configuration.
 */
export declare function getDefaultCache(): ResponseCache;
/**
 * Reset the default cache instance
 *
 * Useful for testing or reconfiguration.
 */
export declare function resetDefaultCache(): void;
//# sourceMappingURL=cache.d.ts.map
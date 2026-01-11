/**
 * Response Cache Service
 *
 * Provides TTL-based caching for Grok API responses to reduce costs
 * and improve response times for repeated queries.
 *
 * @module services/cache
 */

import { GrokQueryResponse } from '../types/index.js';
import { createHash } from 'crypto';

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
 * Internal cache entry structure
 */
interface CacheEntry {
  /** The cached response */
  response: GrokQueryResponse;
  /** Unix timestamp when entry was created */
  timestamp: number;
  /** Unix timestamp when entry expires */
  expiresAt: number;
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
export function getDefaultCacheOptions(): CacheOptions {
  return {
    enabled: process.env.GROK_CACHE_ENABLED !== 'false',
    ttlSeconds: parseInt(process.env.GROK_CACHE_TTL_SECONDS || '300', 10),
    maxEntries: parseInt(process.env.GROK_CACHE_MAX_ENTRIES || '1000', 10),
  };
}

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
export class ResponseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private options: CacheOptions;
  private stats: { hits: number; misses: number } = { hits: 0, misses: 0 };

  constructor(options?: Partial<CacheOptions>) {
    const defaults = getDefaultCacheOptions();
    this.options = {
      enabled: options?.enabled ?? defaults.enabled,
      ttlSeconds: options?.ttlSeconds ?? defaults.ttlSeconds,
      maxEntries: options?.maxEntries ?? defaults.maxEntries,
    };
  }

  /**
   * Check if caching is enabled
   */
  isEnabled(): boolean {
    return this.options.enabled;
  }

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
  generateKey(query: string, model: string, context?: string): string {
    const normalized = JSON.stringify({
      query: query.trim().toLowerCase(),
      model: model.toLowerCase(),
      context: context?.trim().toLowerCase() || '',
    });
    return createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Store a response in the cache
   *
   * If caching is disabled, this is a no-op.
   * Uses LRU eviction when max size is reached.
   *
   * @param key - Cache key from generateKey()
   * @param response - The Grok API response to cache
   */
  set(key: string, response: GrokQueryResponse): void {
    if (!this.options.enabled) {
      return;
    }

    // Evict oldest entry if at max capacity (LRU eviction)
    if (this.cache.size >= this.options.maxEntries && !this.cache.has(key)) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    const now = Date.now();
    const entry: CacheEntry = {
      response: { ...response, cached: true },
      timestamp: now,
      expiresAt: now + this.options.ttlSeconds * 1000,
    };

    // Delete and re-add to move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    // Periodic cleanup: evict expired entries every 100 sets
    if (this.cache.size % 100 === 0) {
      this.evictExpired();
    }
  }

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
  get(key: string): GrokQueryResponse | null {
    if (!this.options.enabled) {
      this.stats.misses++;
      return null;
    }

    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update LRU order by moving to end
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.stats.hits++;
    return entry.response;
  }

  /**
   * Check if a key exists and is not expired
   *
   * @param key - Cache key to check
   * @returns True if cached and valid
   */
  has(key: string): boolean {
    if (!this.options.enabled) {
      return false;
    }

    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Get cache statistics
   *
   * @returns Current cache stats including hit rate
   */
  getStats(): CacheStats {
    // Calculate approximate size
    let approximateBytes = 0;
    for (const entry of this.cache.values()) {
      approximateBytes += JSON.stringify(entry.response).length * 2; // UTF-16
    }

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      maxEntries: this.options.maxEntries,
      approximateBytes,
    };
  }

  /**
   * Get cache hit rate as a percentage
   *
   * @returns Hit rate from 0 to 100, or 0 if no requests
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    if (total === 0) return 0;
    return Math.round((this.stats.hits / total) * 100);
  }

  /**
   * Update cache options at runtime
   *
   * @param options - New options to apply
   */
  setOptions(options: Partial<CacheOptions>): void {
    if (options.enabled !== undefined) {
      this.options.enabled = options.enabled;
    }
    if (options.ttlSeconds !== undefined) {
      this.options.ttlSeconds = options.ttlSeconds;
    }
    if (options.maxEntries !== undefined) {
      this.options.maxEntries = options.maxEntries;
      // Evict excess entries if new max is smaller
      while (this.cache.size > this.options.maxEntries) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey !== undefined) {
          this.cache.delete(oldestKey);
        } else {
          break;
        }
      }
    }
  }

  /**
   * Get current cache options
   */
  getOptions(): Readonly<CacheOptions> {
    return { ...this.options };
  }

  /**
   * Evict all expired entries
   *
   * Called automatically during set() operations.
   * Can be called manually for immediate cleanup.
   *
   * @returns Number of entries evicted
   */
  evictExpired(): number {
    const now = Date.now();
    let evicted = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        evicted++;
      }
    }

    return evicted;
  }

  /**
   * Get expiration time for a cached entry
   *
   * @param key - Cache key to check
   * @returns ISO timestamp when entry expires, or null if not found
   */
  getExpiresAt(key: string): string | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    return new Date(entry.expiresAt).toISOString();
  }
}

/**
 * Singleton instance for shared use
 */
let defaultCacheInstance: ResponseCache | null = null;

/**
 * Get or create the default cache instance
 *
 * Uses environment variables for configuration.
 */
export function getDefaultCache(): ResponseCache {
  if (!defaultCacheInstance) {
    defaultCacheInstance = new ResponseCache();
  }
  return defaultCacheInstance;
}

/**
 * Reset the default cache instance
 *
 * Useful for testing or reconfiguration.
 */
export function resetDefaultCache(): void {
  defaultCacheInstance = null;
}

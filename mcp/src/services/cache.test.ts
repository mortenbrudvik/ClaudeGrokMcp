/**
 * Cache Service Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ResponseCache,
  getDefaultCacheOptions,
  getDefaultCache,
  resetDefaultCache,
} from './cache.js';
import { GrokQueryResponse } from '../types/index.js';

// Mock response factory
function createMockResponse(overrides: Partial<GrokQueryResponse> = {}): GrokQueryResponse {
  return {
    response: 'Test response',
    model: 'grok-4-fast-non-reasoning',
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    },
    cost: {
      estimated_usd: 0.000015,
      input_tokens: 10,
      output_tokens: 20,
      model: 'grok-4-fast-non-reasoning',
      pricing: {
        input_per_1m: 0.2,
        output_per_1m: 0.5,
      },
    },
    cached: false,
    response_time_ms: 500,
    ...overrides,
  };
}

describe('ResponseCache', () => {
  let cache: ResponseCache;

  beforeEach(() => {
    cache = new ResponseCache({ enabled: true, ttlSeconds: 300 });
  });

  describe('constructor', () => {
    it('should use default options when none provided', () => {
      const defaultCache = new ResponseCache();
      expect(defaultCache.isEnabled()).toBe(true);
      expect(defaultCache.getOptions().ttlSeconds).toBe(300);
    });

    it('should accept custom options', () => {
      const customCache = new ResponseCache({ enabled: false, ttlSeconds: 60 });
      expect(customCache.isEnabled()).toBe(false);
      expect(customCache.getOptions().ttlSeconds).toBe(60);
    });

    it('should merge partial options with defaults', () => {
      const partialCache = new ResponseCache({ ttlSeconds: 120 });
      expect(partialCache.isEnabled()).toBe(true);
      expect(partialCache.getOptions().ttlSeconds).toBe(120);
    });
  });

  describe('generateKey', () => {
    it('should generate consistent keys for same inputs', () => {
      const key1 = cache.generateKey('What is 2+2?', 'grok-4-fast');
      const key2 = cache.generateKey('What is 2+2?', 'grok-4-fast');
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different queries', () => {
      const key1 = cache.generateKey('What is 2+2?', 'grok-4-fast');
      const key2 = cache.generateKey('What is 3+3?', 'grok-4-fast');
      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different models', () => {
      const key1 = cache.generateKey('What is 2+2?', 'grok-4-fast');
      const key2 = cache.generateKey('What is 2+2?', 'grok-4');
      expect(key1).not.toBe(key2);
    });

    it('should normalize case', () => {
      const key1 = cache.generateKey('WHAT IS 2+2?', 'GROK-4-FAST');
      const key2 = cache.generateKey('what is 2+2?', 'grok-4-fast');
      expect(key1).toBe(key2);
    });

    it('should normalize whitespace', () => {
      const key1 = cache.generateKey('  What is 2+2?  ', 'grok-4-fast');
      const key2 = cache.generateKey('What is 2+2?', 'grok-4-fast');
      expect(key1).toBe(key2);
    });

    it('should include context in key generation', () => {
      const key1 = cache.generateKey('What is 2+2?', 'grok-4-fast', 'You are helpful');
      const key2 = cache.generateKey('What is 2+2?', 'grok-4-fast');
      expect(key1).not.toBe(key2);
    });

    it('should generate 64-character hex keys (SHA-256)', () => {
      const key = cache.generateKey('test', 'model');
      expect(key).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('set and get', () => {
    it('should store and retrieve responses', () => {
      const key = cache.generateKey('test', 'model');
      const response = createMockResponse();

      cache.set(key, response);
      const retrieved = cache.get(key);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.response).toBe('Test response');
    });

    it('should mark retrieved responses as cached', () => {
      const key = cache.generateKey('test', 'model');
      const response = createMockResponse({ cached: false });

      cache.set(key, response);
      const retrieved = cache.get(key);

      expect(retrieved?.cached).toBe(true);
    });

    it('should return null for non-existent keys', () => {
      const result = cache.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('should not store when disabled', () => {
      const disabledCache = new ResponseCache({ enabled: false });
      const key = disabledCache.generateKey('test', 'model');
      const response = createMockResponse();

      disabledCache.set(key, response);
      const retrieved = disabledCache.get(key);

      expect(retrieved).toBeNull();
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', () => {
      vi.useFakeTimers();

      const shortCache = new ResponseCache({ enabled: true, ttlSeconds: 1 });
      const key = shortCache.generateKey('test', 'model');
      const response = createMockResponse();

      shortCache.set(key, response);
      expect(shortCache.get(key)).not.toBeNull();

      // Advance time past TTL
      vi.advanceTimersByTime(2000);

      expect(shortCache.get(key)).toBeNull();

      vi.useRealTimers();
    });

    it('should not expire entries before TTL', () => {
      vi.useFakeTimers();

      const shortCache = new ResponseCache({ enabled: true, ttlSeconds: 10 });
      const key = shortCache.generateKey('test', 'model');
      const response = createMockResponse();

      shortCache.set(key, response);

      // Advance time but stay within TTL
      vi.advanceTimersByTime(5000);

      expect(shortCache.get(key)).not.toBeNull();

      vi.useRealTimers();
    });
  });

  describe('has', () => {
    it('should return true for existing valid entries', () => {
      const key = cache.generateKey('test', 'model');
      cache.set(key, createMockResponse());

      expect(cache.has(key)).toBe(true);
    });

    it('should return false for non-existent entries', () => {
      expect(cache.has('non-existent')).toBe(false);
    });

    it('should return false when disabled', () => {
      const disabledCache = new ResponseCache({ enabled: false });
      expect(disabledCache.has('any-key')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      const key1 = cache.generateKey('test1', 'model');
      const key2 = cache.generateKey('test2', 'model');

      cache.set(key1, createMockResponse());
      cache.set(key2, createMockResponse());

      expect(cache.getStats().size).toBe(2);

      cache.clear();

      expect(cache.getStats().size).toBe(0);
      expect(cache.get(key1)).toBeNull();
      expect(cache.get(key2)).toBeNull();
    });
  });

  describe('statistics', () => {
    it('should track hits and misses', () => {
      const key = cache.generateKey('test', 'model');
      cache.set(key, createMockResponse());

      // Miss
      cache.get('non-existent');

      // Hit
      cache.get(key);

      // Another hit
      cache.get(key);

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });

    it('should track cache size', () => {
      cache.set('key1', createMockResponse());
      cache.set('key2', createMockResponse());
      cache.set('key3', createMockResponse());

      expect(cache.getStats().size).toBe(3);
    });

    it('should calculate hit rate', () => {
      const key = cache.generateKey('test', 'model');
      cache.set(key, createMockResponse());

      cache.get(key); // hit
      cache.get(key); // hit
      cache.get('miss'); // miss

      expect(cache.getHitRate()).toBe(67); // 2/3 = 66.67% rounded
    });

    it('should return 0 hit rate when no requests', () => {
      expect(cache.getHitRate()).toBe(0);
    });

    it('should reset stats', () => {
      cache.get('miss');
      expect(cache.getStats().misses).toBe(1);

      cache.resetStats();
      expect(cache.getStats().misses).toBe(0);
    });
  });

  describe('evictExpired', () => {
    it('should remove expired entries', () => {
      vi.useFakeTimers();

      const shortCache = new ResponseCache({ enabled: true, ttlSeconds: 1 });

      shortCache.set('key1', createMockResponse());

      vi.advanceTimersByTime(500);
      shortCache.set('key2', createMockResponse());

      vi.advanceTimersByTime(600);

      // key1 should be expired, key2 still valid
      const evicted = shortCache.evictExpired();

      expect(evicted).toBe(1);
      expect(shortCache.has('key1')).toBe(false);
      expect(shortCache.has('key2')).toBe(true);

      vi.useRealTimers();
    });
  });

  describe('setOptions', () => {
    it('should update options at runtime', () => {
      expect(cache.isEnabled()).toBe(true);

      cache.setOptions({ enabled: false });
      expect(cache.isEnabled()).toBe(false);

      cache.setOptions({ ttlSeconds: 60 });
      expect(cache.getOptions().ttlSeconds).toBe(60);
    });
  });

  describe('getExpiresAt', () => {
    it('should return expiration timestamp', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-09T12:00:00Z'));

      const cacheWithTtl = new ResponseCache({ enabled: true, ttlSeconds: 300 });
      const key = cacheWithTtl.generateKey('test', 'model');
      cacheWithTtl.set(key, createMockResponse());

      const expiresAt = cacheWithTtl.getExpiresAt(key);
      expect(expiresAt).toBe('2026-01-09T12:05:00.000Z');

      vi.useRealTimers();
    });

    it('should return null for non-existent keys', () => {
      expect(cache.getExpiresAt('non-existent')).toBeNull();
    });
  });
});

describe('getDefaultCacheOptions', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should use defaults when env vars not set', () => {
    delete process.env.GROK_CACHE_ENABLED;
    delete process.env.GROK_CACHE_TTL_SECONDS;

    const options = getDefaultCacheOptions();
    expect(options.enabled).toBe(true);
    expect(options.ttlSeconds).toBe(300);
  });

  it('should read GROK_CACHE_ENABLED from env', () => {
    process.env.GROK_CACHE_ENABLED = 'false';
    const options = getDefaultCacheOptions();
    expect(options.enabled).toBe(false);
  });

  it('should read GROK_CACHE_TTL_SECONDS from env', () => {
    process.env.GROK_CACHE_TTL_SECONDS = '600';
    const options = getDefaultCacheOptions();
    expect(options.ttlSeconds).toBe(600);
  });
});

describe('singleton functions', () => {
  afterEach(() => {
    resetDefaultCache();
  });

  it('should return same instance from getDefaultCache', () => {
    const cache1 = getDefaultCache();
    const cache2 = getDefaultCache();
    expect(cache1).toBe(cache2);
  });

  it('should create new instance after reset', () => {
    const cache1 = getDefaultCache();
    resetDefaultCache();
    const cache2 = getDefaultCache();
    expect(cache1).not.toBe(cache2);
  });
});

describe('LRU eviction', () => {
  it('should evict oldest entry when max size exceeded', () => {
    const cache = new ResponseCache({ enabled: true, ttlSeconds: 300, maxEntries: 3 });

    // Add 3 entries
    cache.set('key1', createMockResponse({ response: 'first' }));
    cache.set('key2', createMockResponse({ response: 'second' }));
    cache.set('key3', createMockResponse({ response: 'third' }));

    expect(cache.getStats().size).toBe(3);
    expect(cache.has('key1')).toBe(true);

    // Add 4th entry - should evict oldest (key1)
    cache.set('key4', createMockResponse({ response: 'fourth' }));

    expect(cache.getStats().size).toBe(3);
    expect(cache.has('key1')).toBe(false);
    expect(cache.has('key2')).toBe(true);
    expect(cache.has('key3')).toBe(true);
    expect(cache.has('key4')).toBe(true);
  });

  it('should update LRU order on get', () => {
    const cache = new ResponseCache({ enabled: true, ttlSeconds: 300, maxEntries: 3 });

    cache.set('key1', createMockResponse({ response: 'first' }));
    cache.set('key2', createMockResponse({ response: 'second' }));
    cache.set('key3', createMockResponse({ response: 'third' }));

    // Access key1 to move it to most recently used
    cache.get('key1');

    // Add new entry - should evict key2 (now oldest)
    cache.set('key4', createMockResponse({ response: 'fourth' }));

    expect(cache.has('key1')).toBe(true);
    expect(cache.has('key2')).toBe(false);
    expect(cache.has('key3')).toBe(true);
    expect(cache.has('key4')).toBe(true);
  });

  it('should not evict when updating existing key', () => {
    const cache = new ResponseCache({ enabled: true, ttlSeconds: 300, maxEntries: 3 });

    cache.set('key1', createMockResponse({ response: 'first' }));
    cache.set('key2', createMockResponse({ response: 'second' }));
    cache.set('key3', createMockResponse({ response: 'third' }));

    // Update existing key
    cache.set('key1', createMockResponse({ response: 'updated first' }));

    expect(cache.getStats().size).toBe(3);
    expect(cache.has('key1')).toBe(true);
    expect(cache.has('key2')).toBe(true);
    expect(cache.has('key3')).toBe(true);
  });

  it('should include maxEntries in stats', () => {
    const cache = new ResponseCache({ enabled: true, ttlSeconds: 300, maxEntries: 500 });
    const stats = cache.getStats();
    expect(stats.maxEntries).toBe(500);
  });

  it('should allow setOptions to change maxEntries', () => {
    const cache = new ResponseCache({ enabled: true, ttlSeconds: 300, maxEntries: 100 });

    // Add 5 entries
    for (let i = 0; i < 5; i++) {
      cache.set(`key${i}`, createMockResponse());
    }
    expect(cache.getStats().size).toBe(5);

    // Reduce maxEntries - should evict excess
    cache.setOptions({ maxEntries: 3 });

    expect(cache.getStats().size).toBe(3);
    expect(cache.getStats().maxEntries).toBe(3);
    // Oldest keys should be evicted
    expect(cache.has('key0')).toBe(false);
    expect(cache.has('key1')).toBe(false);
    expect(cache.has('key2')).toBe(true);
    expect(cache.has('key3')).toBe(true);
    expect(cache.has('key4')).toBe(true);
  });

  it('should use default maxEntries from env or fallback to 1000', () => {
    const options = getDefaultCacheOptions();
    expect(options.maxEntries).toBe(1000);
  });
});

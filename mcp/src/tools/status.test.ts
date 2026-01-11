/**
 * grok_status Tool Tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
  executeGetStatus,
  handleGrokStatus,
  grokStatusSchema,
  grokStatusToolDefinition,
  GrokStatusInput,
} from './status.js';
import type { Services } from '../types/index.js';

// Mock services factory
function createMockServices(
  overrides: {
    rateLimiter?: Partial<ReturnType<Services['rateLimiter']['getStatus']>>;
    rateLimiterOptions?: Partial<ReturnType<Services['rateLimiter']['getOptions']>>;
    cache?: Partial<ReturnType<Services['cache']['getStats']>>;
    cacheOptions?: Partial<ReturnType<Services['cache']['getOptions']>>;
    costTracker?: Partial<ReturnType<Services['costTracker']['getUsageSummary']>>;
    sessionDuration?: number;
    cacheHitRate?: number;
  } = {}
): Services {
  const defaultRateLimitStatus = {
    tokensUsed: 1000,
    tokensRemaining: 499000,
    requestsUsed: 5,
    requestsRemaining: 495,
    resetInMs: 45000,
    isLimited: false,
    currentRetryDelay: 0,
    retryCount: 0,
    ...overrides.rateLimiter,
  };

  const defaultRateLimiterOptions = {
    tier: 'standard' as const,
    initialRetryDelayMs: 1000,
    maxRetryDelayMs: 60000,
    maxRetries: 5,
    maxPendingRequests: 100,
    pendingTimeoutMs: 30000,
    ...overrides.rateLimiterOptions,
  };

  const defaultCacheStats = {
    hits: 10,
    misses: 5,
    size: 50,
    maxEntries: 1000,
    approximateBytes: 51200,
    ...overrides.cache,
  };

  const defaultCacheOptions = {
    enabled: true,
    ttlSeconds: 300,
    maxEntries: 1000,
    ...overrides.cacheOptions,
  };

  const defaultCostSummary = {
    totalCostUsd: 0.05,
    limitUsd: 10,
    remainingBudgetUsd: 9.95,
    queryCount: 15,
    totalInputTokens: 5000,
    totalOutputTokens: 10000,
    byModel: {
      'grok-4-fast': { cost: 0.03, queries: 10, tokens: 8000 },
      'grok-4': { cost: 0.02, queries: 5, tokens: 7000 },
    },
    limitEnforced: true,
    budgetUsedPercent: 0.5,
    ...overrides.costTracker,
  };

  return {
    rateLimiter: {
      getStatus: vi.fn().mockReturnValue(defaultRateLimitStatus),
      getOptions: vi.fn().mockReturnValue(defaultRateLimiterOptions),
      getLimits: vi.fn().mockReturnValue({ tokensPerMinute: 500000, requestsPerMinute: 500 }),
      getPendingCount: vi.fn().mockReturnValue(0),
      acquire: vi.fn(),
      release: vi.fn(),
      recordSuccess: vi.fn(),
      recordRateLimitError: vi.fn(),
      setOptions: vi.fn(),
      reset: vi.fn(),
    } as unknown as Services['rateLimiter'],
    cache: {
      getStats: vi.fn().mockReturnValue(defaultCacheStats),
      getOptions: vi.fn().mockReturnValue(defaultCacheOptions),
      getHitRate: vi.fn().mockReturnValue(overrides.cacheHitRate ?? 67),
      get: vi.fn(),
      set: vi.fn(),
      has: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      getExpiresAt: vi.fn(),
      setOptions: vi.fn(),
      resetStats: vi.fn(),
    } as unknown as Services['cache'],
    costTracker: {
      getUsageSummary: vi.fn().mockReturnValue(defaultCostSummary),
      getSessionDuration: vi.fn().mockReturnValue(overrides.sessionDuration ?? 300000), // 5 minutes
      getTotalCost: vi.fn().mockReturnValue(defaultCostSummary.totalCostUsd),
      getRemainingBudget: vi.fn().mockReturnValue(defaultCostSummary.remainingBudgetUsd),
      getRecords: vi.fn().mockReturnValue([]),
      getSessionStartTime: vi.fn().mockReturnValue(Date.now() - 300000),
      getBudgetWarning: vi.fn().mockReturnValue(null),
      getOptions: vi.fn().mockReturnValue({ limitUsd: 10, enforceLimit: true, maxRecords: 10000 }),
      record: vi.fn(),
      isWithinBudget: vi.fn().mockReturnValue(true),
      setOptions: vi.fn(),
      reset: vi.fn(),
    } as unknown as Services['costTracker'],
  };
}

describe('grok_status tool', () => {
  describe('grokStatusSchema', () => {
    it('should use JSON Schema 2020-12', () => {
      expect(grokStatusSchema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    });

    it('should have optional include_details property', () => {
      expect(grokStatusSchema.properties.include_details.type).toBe('boolean');
    });

    it('should not allow additional properties', () => {
      expect(grokStatusSchema.additionalProperties).toBe(false);
    });
  });

  describe('grokStatusToolDefinition', () => {
    it('should have correct name', () => {
      expect(grokStatusToolDefinition.name).toBe('grok_status');
    });

    it('should have descriptive description', () => {
      expect(grokStatusToolDefinition.description).toContain('status');
      expect(grokStatusToolDefinition.description).toContain('rate limits');
    });
  });

  describe('executeGetStatus', () => {
    it('should return operational status under normal conditions', () => {
      const services = createMockServices();
      const input: GrokStatusInput = {};

      const result = executeGetStatus(services, input);

      expect(result.status).toBe('operational');
    });

    it('should return rate_limited status when rate limiter is limited', () => {
      const services = createMockServices({
        rateLimiter: { isLimited: true },
      });
      const input: GrokStatusInput = {};

      const result = executeGetStatus(services, input);

      expect(result.status).toBe('rate_limited');
    });

    it('should return budget_exceeded when budget is exhausted', () => {
      const services = createMockServices({
        costTracker: {
          remainingBudgetUsd: 0,
          limitEnforced: true,
          budgetUsedPercent: 100,
        },
      });
      const input: GrokStatusInput = {};

      const result = executeGetStatus(services, input);

      expect(result.status).toBe('budget_exceeded');
    });

    it('should prioritize budget_exceeded over rate_limited', () => {
      const services = createMockServices({
        rateLimiter: { isLimited: true },
        costTracker: {
          remainingBudgetUsd: 0,
          limitEnforced: true,
          budgetUsedPercent: 100,
        },
      });
      const input: GrokStatusInput = {};

      const result = executeGetStatus(services, input);

      expect(result.status).toBe('budget_exceeded');
    });

    it('should include rate limit information', () => {
      const services = createMockServices({
        rateLimiter: {
          tokensRemaining: 450000,
          requestsRemaining: 480,
          resetInMs: 30000,
          isLimited: false,
        },
      });
      const input: GrokStatusInput = {};

      const result = executeGetStatus(services, input);

      expect(result.rate_limits.tokens_remaining).toBe(450000);
      expect(result.rate_limits.requests_remaining).toBe(480);
      expect(result.rate_limits.reset_in_seconds).toBe(30);
      expect(result.rate_limits.is_limited).toBe(false);
    });

    it('should include cache statistics', () => {
      const services = createMockServices({
        cache: { size: 100, maxEntries: 1000 },
        cacheHitRate: 75,
      });
      const input: GrokStatusInput = {};

      const result = executeGetStatus(services, input);

      expect(result.cache.enabled).toBe(true);
      expect(result.cache.hit_rate_percent).toBe(75);
      expect(result.cache.entries).toBe(100);
      expect(result.cache.max_entries).toBe(1000);
    });

    it('should include session statistics', () => {
      const services = createMockServices({
        costTracker: {
          queryCount: 25,
          totalCostUsd: 0.15,
          remainingBudgetUsd: 9.85,
          budgetUsedPercent: 1.5,
        },
        sessionDuration: 600000, // 10 minutes
      });
      const input: GrokStatusInput = {};

      const result = executeGetStatus(services, input);

      expect(result.session.queries).toBe(25);
      expect(result.session.total_cost_usd).toBe(0.15);
      expect(result.session.remaining_budget_usd).toBe(9.85);
      expect(result.session.budget_used_percent).toBe(1.5);
      expect(result.session.duration_minutes).toBe(10);
    });

    it('should not include details by default', () => {
      const services = createMockServices();
      const input: GrokStatusInput = {};

      const result = executeGetStatus(services, input);

      expect(result.details).toBeUndefined();
    });

    it('should include details when include_details is true', () => {
      const services = createMockServices({
        cache: { approximateBytes: 102400 },
        rateLimiterOptions: { tier: 'enterprise' as const },
        rateLimiter: { retryCount: 2, currentRetryDelay: 2000 },
      });
      const input: GrokStatusInput = { include_details: true };

      const result = executeGetStatus(services, input);

      expect(result.details).toBeDefined();
      expect(result.details!.cache_bytes).toBe(102400);
      expect(result.details!.rate_limit_tier).toBe('enterprise');
      expect(result.details!.retry_state.count).toBe(2);
      expect(result.details!.retry_state.delay_ms).toBe(2000);
    });

    it('should include cost by model in details', () => {
      const services = createMockServices({
        costTracker: {
          byModel: {
            'grok-4-fast': { cost: 0.05, queries: 10, tokens: 5000 },
            'grok-4': { cost: 0.1, queries: 5, tokens: 8000 },
          },
        },
      });
      const input: GrokStatusInput = { include_details: true };

      const result = executeGetStatus(services, input);

      expect(result.details!.cost_by_model['grok-4-fast']).toBe(0.05);
      expect(result.details!.cost_by_model['grok-4']).toBe(0.1);
    });

    it('should handle zero queries gracefully', () => {
      const services = createMockServices({
        costTracker: {
          queryCount: 0,
          totalCostUsd: 0,
          remainingBudgetUsd: 10,
          budgetUsedPercent: 0,
          byModel: {},
        },
        cache: { hits: 0, misses: 0, size: 0 },
        cacheHitRate: 0,
        sessionDuration: 0,
      });
      const input: GrokStatusInput = {};

      const result = executeGetStatus(services, input);

      expect(result.session.queries).toBe(0);
      expect(result.session.total_cost_usd).toBe(0);
      expect(result.cache.hit_rate_percent).toBe(0);
      expect(result.session.duration_minutes).toBe(0);
    });

    it('should round reset time to seconds correctly', () => {
      const services = createMockServices({
        rateLimiter: { resetInMs: 15500 }, // 15.5 seconds
      });
      const input: GrokStatusInput = {};

      const result = executeGetStatus(services, input);

      expect(result.rate_limits.reset_in_seconds).toBe(16); // Ceiling
    });
  });

  describe('handleGrokStatus', () => {
    it('should return formatted MCP response on success', async () => {
      const services = createMockServices();
      const result = await handleGrokStatus(services, {});

      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
    });

    it('should include status header with emoji', async () => {
      const services = createMockServices();
      const result = await handleGrokStatus(services, {});

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('Grok MCP Status:');
      expect(text).toContain('OPERATIONAL');
    });

    it('should show rate limited status with warning emoji', async () => {
      const services = createMockServices({
        rateLimiter: { isLimited: true },
      });
      const result = await handleGrokStatus(services, {});

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('RATE_LIMITED');
    });

    it('should show budget exceeded status', async () => {
      const services = createMockServices({
        costTracker: {
          remainingBudgetUsd: 0,
          limitEnforced: true,
        },
      });
      const result = await handleGrokStatus(services, {});

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('BUDGET_EXCEEDED');
    });

    it('should include rate limits section', async () => {
      const services = createMockServices();
      const result = await handleGrokStatus(services, {});

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('Rate Limits');
      expect(text).toContain('Tokens Remaining');
      expect(text).toContain('Requests Remaining');
    });

    it('should include cache section', async () => {
      const services = createMockServices();
      const result = await handleGrokStatus(services, {});

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('Cache');
      expect(text).toContain('Hit Rate');
      expect(text).toContain('Entries');
    });

    it('should include session section', async () => {
      const services = createMockServices();
      const result = await handleGrokStatus(services, {});

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('Session');
      expect(text).toContain('Queries');
      expect(text).toContain('Total Cost');
      expect(text).toContain('Remaining Budget');
    });

    it('should include details section when requested', async () => {
      const services = createMockServices();
      const result = await handleGrokStatus(services, { include_details: true });

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('Details');
      expect(text).toContain('Cache Memory');
      expect(text).toContain('API Tier');
    });

    it('should not include details section when not requested', async () => {
      const services = createMockServices();
      const result = await handleGrokStatus(services, {});

      const text = (result.content[0] as { text: string }).text;
      expect(text).not.toContain('Details');
      expect(text).not.toContain('Cache Memory');
    });

    it('should show cost by model when details requested', async () => {
      const services = createMockServices({
        costTracker: {
          byModel: {
            'grok-4-fast': { cost: 0.05, queries: 10, tokens: 5000 },
          },
        },
      });
      const result = await handleGrokStatus(services, { include_details: true });

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('Cost by Model');
      expect(text).toContain('grok-4-fast');
    });

    it('should return error when services not provided', async () => {
      const result = await handleGrokStatus(null as unknown as Services, {});

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('Services not available');
    });

    it('should handle undefined input', async () => {
      const services = createMockServices();
      const result = await handleGrokStatus(services, undefined);

      expect(result.isError).toBe(false);
    });

    it('should handle null input', async () => {
      const services = createMockServices();
      const result = await handleGrokStatus(services, null);

      expect(result.isError).toBe(false);
    });

    it('should default include_details to false for non-boolean values', async () => {
      const services = createMockServices();
      const result = await handleGrokStatus(services, { include_details: 'yes' });

      const text = (result.content[0] as { text: string }).text;
      expect(text).not.toContain('Details');
    });

    it('should format numbers with locale separators', async () => {
      const services = createMockServices({
        rateLimiter: { tokensRemaining: 450000 },
      });
      const result = await handleGrokStatus(services, {});

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('450,000');
    });

    it('should format cost with 4 decimal places', async () => {
      const services = createMockServices({
        costTracker: { totalCostUsd: 0.1234 },
      });
      const result = await handleGrokStatus(services, {});

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('$0.1234');
    });

    it('should format remaining budget with 2 decimal places', async () => {
      const services = createMockServices({
        costTracker: { remainingBudgetUsd: 9.95 },
      });
      const result = await handleGrokStatus(services, {});

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('$9.95');
    });

    it('should show retry state when retries have occurred', async () => {
      const services = createMockServices({
        rateLimiter: { retryCount: 3, currentRetryDelay: 4000 },
      });
      const result = await handleGrokStatus(services, { include_details: true });

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('Retry State');
      expect(text).toContain('3 retries');
      expect(text).toContain('4000ms delay');
    });

    it('should not show retry state section when no retries', async () => {
      const services = createMockServices({
        rateLimiter: { retryCount: 0, currentRetryDelay: 0 },
      });
      const result = await handleGrokStatus(services, { include_details: true });

      const text = (result.content[0] as { text: string }).text;
      expect(text).not.toContain('Retry State');
    });
  });
});

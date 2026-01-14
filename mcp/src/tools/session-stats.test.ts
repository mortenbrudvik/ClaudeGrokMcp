/**
 * grok_session_stats Tool Tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
  executeGetSessionStats,
  handleGrokSessionStats,
  grokSessionStatsSchema,
  grokSessionStatsToolDefinition,
  formatDuration,
  formatSessionStatsMarkdown,
  formatSessionStatsJson,
  GrokSessionStatsInput,
  GrokSessionStatsResponse,
} from './session-stats.js';
import type { Services } from '../types/index.js';
import type { CostRecord } from '../services/cost-tracker.js';

// Mock services factory
function createMockServices(
  overrides: {
    costTracker?: Partial<ReturnType<Services['costTracker']['getUsageSummary']>>;
    sessionDuration?: number;
    sessionStartTime?: Date;
    cacheStats?: Partial<ReturnType<Services['cache']['getStats']>>;
    cacheHitRate?: number;
    records?: CostRecord[];
  } = {}
): Services {
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

  const defaultCacheStats = {
    hits: 10,
    misses: 5,
    size: 50,
    maxEntries: 1000,
    approximateBytes: 51200,
    ...overrides.cacheStats,
  };

  const defaultRecords: CostRecord[] = overrides.records || [
    { timestamp: Date.now() - 60000, costUsd: 0.01, model: 'grok-4-fast', inputTokens: 100, outputTokens: 200 },
    { timestamp: Date.now() - 30000, costUsd: 0.02, model: 'grok-4', inputTokens: 200, outputTokens: 400 },
    { timestamp: Date.now() - 10000, costUsd: 0.01, model: 'grok-4-fast', inputTokens: 150, outputTokens: 250 },
  ];

  return {
    rateLimiter: {
      getStatus: vi.fn().mockReturnValue({
        tokensUsed: 1000,
        tokensRemaining: 499000,
        requestsUsed: 5,
        requestsRemaining: 495,
        resetInMs: 45000,
        isLimited: false,
        currentRetryDelay: 0,
        retryCount: 0,
      }),
      getOptions: vi.fn().mockReturnValue({ tier: 'standard' }),
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
      getOptions: vi.fn().mockReturnValue({ enabled: true, ttlSeconds: 300, maxEntries: 1000 }),
      getHitRate: vi.fn().mockReturnValue(overrides.cacheHitRate ?? 67),
      get: vi.fn(),
      set: vi.fn(),
      has: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      getExpiresAt: vi.fn(),
      setOptions: vi.fn(),
      resetStats: vi.fn(),
      isEnabled: vi.fn().mockReturnValue(true),
      generateKey: vi.fn(),
    } as unknown as Services['cache'],
    costTracker: {
      getUsageSummary: vi.fn().mockReturnValue(defaultCostSummary),
      getSessionDuration: vi.fn().mockReturnValue(overrides.sessionDuration ?? 300000), // 5 minutes
      getSessionStartTime: vi.fn().mockReturnValue(overrides.sessionStartTime ?? new Date(Date.now() - 300000)),
      getTotalCost: vi.fn().mockReturnValue(defaultCostSummary.totalCostUsd),
      getRemainingBudget: vi.fn().mockReturnValue(defaultCostSummary.remainingBudgetUsd),
      getRecords: vi.fn().mockReturnValue(defaultRecords),
      getBudgetWarning: vi.fn().mockReturnValue(null),
      getOptions: vi.fn().mockReturnValue({ limitUsd: 10, enforceLimit: true, maxRecords: 10000 }),
      record: vi.fn(),
      isWithinBudget: vi.fn().mockReturnValue(true),
      setOptions: vi.fn(),
      reset: vi.fn(),
      addCost: vi.fn(),
      addFromEstimate: vi.fn(),
      checkBudget: vi.fn(),
    } as unknown as Services['costTracker'],
  };
}

describe('grok_session_stats tool', () => {
  describe('grokSessionStatsSchema', () => {
    it('should use JSON Schema 2020-12', () => {
      expect(grokSessionStatsSchema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    });

    it('should have optional detail_level property with enum', () => {
      expect(grokSessionStatsSchema.properties.detail_level.type).toBe('string');
      expect(grokSessionStatsSchema.properties.detail_level.enum).toEqual(['summary', 'detailed', 'full']);
    });

    it('should have optional format property with enum', () => {
      expect(grokSessionStatsSchema.properties.format.type).toBe('string');
      expect(grokSessionStatsSchema.properties.format.enum).toEqual(['markdown', 'json']);
    });

    it('should not allow additional properties', () => {
      expect(grokSessionStatsSchema.additionalProperties).toBe(false);
    });
  });

  describe('grokSessionStatsToolDefinition', () => {
    it('should have correct name', () => {
      expect(grokSessionStatsToolDefinition.name).toBe('grok_session_stats');
    });

    it('should have descriptive description', () => {
      expect(grokSessionStatsToolDefinition.description).toContain('session');
      expect(grokSessionStatsToolDefinition.description).toContain('analytics');
    });
  });

  describe('formatDuration', () => {
    it('should format seconds only', () => {
      expect(formatDuration(45000)).toBe('45s');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(125000)).toBe('2m 5s');
    });

    it('should format hours, minutes, and seconds', () => {
      expect(formatDuration(3725000)).toBe('1h 2m 5s');
    });

    it('should handle zero duration', () => {
      expect(formatDuration(0)).toBe('0s');
    });

    it('should handle exactly one minute', () => {
      expect(formatDuration(60000)).toBe('1m 0s');
    });

    it('should handle exactly one hour', () => {
      expect(formatDuration(3600000)).toBe('1h 0m 0s');
    });
  });

  describe('executeGetSessionStats', () => {
    it('should return correct session timing', () => {
      const startTime = new Date('2026-01-14T10:00:00Z');
      const services = createMockServices({
        sessionDuration: 300000, // 5 minutes
        sessionStartTime: startTime,
      });
      const input: GrokSessionStatsInput = {};

      const result = executeGetSessionStats(services, input);

      expect(result.session.started_at).toBe(startTime.toISOString());
      expect(result.session.duration).toBe('5m 0s');
      expect(result.session.duration_seconds).toBe(300);
    });

    it('should return correct totals', () => {
      const services = createMockServices({
        costTracker: {
          queryCount: 25,
          totalInputTokens: 5000,
          totalOutputTokens: 10000,
          totalCostUsd: 0.15,
        },
      });
      const input: GrokSessionStatsInput = {};

      const result = executeGetSessionStats(services, input);

      expect(result.totals.queries).toBe(25);
      expect(result.totals.input_tokens).toBe(5000);
      expect(result.totals.output_tokens).toBe(10000);
      expect(result.totals.total_tokens).toBe(15000);
      expect(result.totals.cost_usd).toBe(0.15);
      expect(result.totals.cost_formatted).toBe('$0.1500');
    });

    it('should return correct cache metrics', () => {
      const services = createMockServices({
        cacheStats: { hits: 20, misses: 10 },
        cacheHitRate: 67,
      });
      const input: GrokSessionStatsInput = {};

      const result = executeGetSessionStats(services, input);

      expect(result.cache.hit_rate_percent).toBe(67);
      expect(result.cache.hits).toBe(20);
      expect(result.cache.misses).toBe(10);
    });

    it('should calculate cache savings estimate', () => {
      const services = createMockServices({
        costTracker: {
          queryCount: 10,
          totalInputTokens: 5000,
          totalOutputTokens: 5000,
          totalCostUsd: 0.10,
        },
        cacheStats: { hits: 5, misses: 5 },
      });
      const input: GrokSessionStatsInput = {};

      const result = executeGetSessionStats(services, input);

      // 10 queries, 10000 tokens total -> 1000 tokens per query
      // 5 cache hits * 1000 = 5000 tokens saved
      expect(result.cache.tokens_saved).toBe(5000);
      // 5 cache hits * ($0.10 / 10 queries) = $0.05 saved
      expect(result.cache.cost_saved_usd).toBe(0.05);
    });

    it('should calculate rate metrics correctly', () => {
      const services = createMockServices({
        costTracker: {
          queryCount: 10,
          totalInputTokens: 5000,
          totalOutputTokens: 5000,
          totalCostUsd: 0.10,
        },
        sessionDuration: 300000, // 5 minutes
      });
      const input: GrokSessionStatsInput = {};

      const result = executeGetSessionStats(services, input);

      expect(result.rates.queries_per_minute).toBe(2); // 10 queries / 5 minutes
      expect(result.rates.tokens_per_query).toBe(1000); // 10000 tokens / 10 queries
      expect(result.rates.cost_per_query_usd).toBe(0.01); // $0.10 / 10 queries
    });

    it('should not include by_model for summary detail level', () => {
      const services = createMockServices();
      const input: GrokSessionStatsInput = { detail_level: 'summary' };

      const result = executeGetSessionStats(services, input);

      expect(result.by_model).toBeUndefined();
    });

    it('should include by_model for detailed level', () => {
      const services = createMockServices({
        costTracker: {
          queryCount: 15,
          totalCostUsd: 0.05,
          byModel: {
            'grok-4-fast': { cost: 0.03, queries: 10, tokens: 8000 },
            'grok-4': { cost: 0.02, queries: 5, tokens: 7000 },
          },
        },
      });
      const input: GrokSessionStatsInput = { detail_level: 'detailed' };

      const result = executeGetSessionStats(services, input);

      expect(result.by_model).toBeDefined();
      expect(result.by_model!['grok-4-fast']).toBeDefined();
      expect(result.by_model!['grok-4-fast'].queries).toBe(10);
      expect(result.by_model!['grok-4-fast'].cost_usd).toBe(0.03);
    });

    it('should calculate model percentages correctly', () => {
      const services = createMockServices({
        costTracker: {
          queryCount: 10,
          totalCostUsd: 0.10,
          byModel: {
            'grok-4-fast': { cost: 0.02, queries: 8, tokens: 4000 },
            'grok-4': { cost: 0.08, queries: 2, tokens: 6000 },
          },
        },
      });
      const input: GrokSessionStatsInput = { detail_level: 'detailed' };

      const result = executeGetSessionStats(services, input);

      expect(result.by_model!['grok-4-fast'].query_percent).toBe(80);
      expect(result.by_model!['grok-4-fast'].cost_percent).toBe(20);
      expect(result.by_model!['grok-4'].query_percent).toBe(20);
      expect(result.by_model!['grok-4'].cost_percent).toBe(80);
    });

    it('should not include timeline for detailed level', () => {
      const services = createMockServices();
      const input: GrokSessionStatsInput = { detail_level: 'detailed' };

      const result = executeGetSessionStats(services, input);

      expect(result.timeline).toBeUndefined();
    });

    it('should include timeline for full level', () => {
      const services = createMockServices();
      const input: GrokSessionStatsInput = { detail_level: 'full' };

      const result = executeGetSessionStats(services, input);

      expect(result.timeline).toBeDefined();
      expect(result.timeline!.recent_queries).toBeDefined();
      expect(Array.isArray(result.timeline!.recent_queries)).toBe(true);
    });

    it('should limit timeline to 10 entries', () => {
      const manyRecords: CostRecord[] = Array.from({ length: 20 }, (_, i) => ({
        timestamp: Date.now() - i * 1000,
        costUsd: 0.01,
        model: 'grok-4-fast',
        inputTokens: 100,
        outputTokens: 200,
      }));
      const services = createMockServices({ records: manyRecords });
      const input: GrokSessionStatsInput = { detail_level: 'full' };

      const result = executeGetSessionStats(services, input);

      expect(result.timeline!.recent_queries.length).toBeLessThanOrEqual(10);
    });

    it('should handle zero queries gracefully', () => {
      const services = createMockServices({
        costTracker: {
          queryCount: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalCostUsd: 0,
          byModel: {},
        },
        cacheStats: { hits: 0, misses: 0 },
        cacheHitRate: 0,
        sessionDuration: 0,
        records: [],
      });
      const input: GrokSessionStatsInput = {};

      const result = executeGetSessionStats(services, input);

      expect(result.totals.queries).toBe(0);
      expect(result.totals.total_tokens).toBe(0);
      expect(result.rates.queries_per_minute).toBe(0);
      expect(result.rates.tokens_per_query).toBe(0);
      expect(result.rates.cost_per_query_usd).toBe(0);
      expect(result.cache.tokens_saved).toBe(0);
    });

    it('should handle single model usage', () => {
      const services = createMockServices({
        costTracker: {
          queryCount: 5,
          totalCostUsd: 0.05,
          byModel: {
            'grok-4-fast': { cost: 0.05, queries: 5, tokens: 5000 },
          },
        },
      });
      const input: GrokSessionStatsInput = { detail_level: 'detailed' };

      const result = executeGetSessionStats(services, input);

      expect(Object.keys(result.by_model!).length).toBe(1);
      expect(result.by_model!['grok-4-fast'].query_percent).toBe(100);
      expect(result.by_model!['grok-4-fast'].cost_percent).toBe(100);
    });

    it('should default to summary when detail_level not provided', () => {
      const services = createMockServices();
      const input: GrokSessionStatsInput = {};

      const result = executeGetSessionStats(services, input);

      expect(result.by_model).toBeUndefined();
      expect(result.timeline).toBeUndefined();
    });
  });

  describe('formatSessionStatsMarkdown', () => {
    it('should include session section', () => {
      const response: GrokSessionStatsResponse = createTestResponse();
      const markdown = formatSessionStatsMarkdown(response);

      expect(markdown).toContain('## Session Statistics');
      expect(markdown).toContain('### Session');
      expect(markdown).toContain('**Started:**');
      expect(markdown).toContain('**Duration:**');
    });

    it('should include totals section', () => {
      const response: GrokSessionStatsResponse = createTestResponse();
      const markdown = formatSessionStatsMarkdown(response);

      expect(markdown).toContain('### Totals');
      expect(markdown).toContain('**Queries:**');
      expect(markdown).toContain('**Total Tokens:**');
      expect(markdown).toContain('**Total Cost:**');
    });

    it('should include cache efficiency section', () => {
      const response: GrokSessionStatsResponse = createTestResponse();
      const markdown = formatSessionStatsMarkdown(response);

      expect(markdown).toContain('### Cache Efficiency');
      expect(markdown).toContain('**Hit Rate:**');
      expect(markdown).toContain('**Hits / Misses:**');
    });

    it('should include rates section', () => {
      const response: GrokSessionStatsResponse = createTestResponse();
      const markdown = formatSessionStatsMarkdown(response);

      expect(markdown).toContain('### Rates');
      expect(markdown).toContain('**Queries/min:**');
      expect(markdown).toContain('**Tokens/query:**');
      expect(markdown).toContain('**Cost/query:**');
    });

    it('should include model usage table when by_model present', () => {
      const response = createTestResponse({
        by_model: {
          'grok-4-fast': {
            queries: 10,
            query_percent: 66.7,
            input_tokens: 3000,
            output_tokens: 5000,
            total_tokens: 8000,
            cost_usd: 0.03,
            cost_formatted: '$0.0300',
            cost_percent: 60,
          },
        },
      });
      const markdown = formatSessionStatsMarkdown(response);

      expect(markdown).toContain('### Model Usage');
      expect(markdown).toContain('| Model | Queries | Tokens | Cost | % of Cost |');
      expect(markdown).toContain('grok-4-fast');
    });

    it('should include recent activity when timeline present', () => {
      const response = createTestResponse({
        timeline: {
          recent_queries: [
            { timestamp: '2026-01-14T10:45:00Z', model: 'grok-4', tokens: 500, cost_usd: 0.0025 },
          ],
        },
      });
      const markdown = formatSessionStatsMarkdown(response);

      expect(markdown).toContain('### Recent Activity');
      expect(markdown).toContain('grok-4');
    });

    it('should not include model usage when by_model undefined', () => {
      const response = createTestResponse();
      delete response.by_model;
      const markdown = formatSessionStatsMarkdown(response);

      expect(markdown).not.toContain('### Model Usage');
    });

    it('should format numbers with locale separators', () => {
      const response = createTestResponse({
        totals: {
          queries: 25,
          input_tokens: 50000,
          output_tokens: 100000,
          total_tokens: 150000,
          cost_usd: 0.15,
          cost_formatted: '$0.1500',
        },
      });
      const markdown = formatSessionStatsMarkdown(response);

      expect(markdown).toContain('150,000');
    });
  });

  describe('formatSessionStatsJson', () => {
    it('should return valid JSON string', () => {
      const response = createTestResponse();
      const json = formatSessionStatsJson(response);

      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should include all response fields', () => {
      const response = createTestResponse();
      const json = formatSessionStatsJson(response);
      const parsed = JSON.parse(json);

      expect(parsed.session).toBeDefined();
      expect(parsed.totals).toBeDefined();
      expect(parsed.cache).toBeDefined();
      expect(parsed.rates).toBeDefined();
    });

    it('should be formatted with indentation', () => {
      const response = createTestResponse();
      const json = formatSessionStatsJson(response);

      expect(json).toContain('\n');
      expect(json).toContain('  ');
    });
  });

  describe('handleGrokSessionStats', () => {
    it('should return formatted MCP response on success', async () => {
      const services = createMockServices();
      const result = await handleGrokSessionStats(services, {});

      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
    });

    it('should return markdown by default', async () => {
      const services = createMockServices();
      const result = await handleGrokSessionStats(services, {});

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('## Session Statistics');
    });

    it('should return JSON when format is json', async () => {
      const services = createMockServices();
      const result = await handleGrokSessionStats(services, { format: 'json' });

      const text = (result.content[0] as { text: string }).text;
      expect(() => JSON.parse(text)).not.toThrow();
    });

    it('should return error when services not provided', async () => {
      const result = await handleGrokSessionStats(null as unknown as Services, {});

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('Services not available');
    });

    it('should handle undefined input', async () => {
      const services = createMockServices();
      const result = await handleGrokSessionStats(services, undefined);

      expect(result.isError).toBe(false);
    });

    it('should handle null input', async () => {
      const services = createMockServices();
      const result = await handleGrokSessionStats(services, null);

      expect(result.isError).toBe(false);
    });

    it('should default to summary for invalid detail_level', async () => {
      const services = createMockServices();
      const result = await handleGrokSessionStats(services, { detail_level: 'invalid' });

      const text = (result.content[0] as { text: string }).text;
      expect(text).not.toContain('Model Usage');
    });

    it('should default to markdown for invalid format', async () => {
      const services = createMockServices();
      const result = await handleGrokSessionStats(services, { format: 'xml' });

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('## Session Statistics');
    });

    it('should include model breakdown for detailed level', async () => {
      const services = createMockServices();
      const result = await handleGrokSessionStats(services, { detail_level: 'detailed' });

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('Model Usage');
    });

    it('should include timeline for full level', async () => {
      const services = createMockServices();
      const result = await handleGrokSessionStats(services, { detail_level: 'full' });

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('Recent Activity');
    });
  });
});

// Helper to create test response
function createTestResponse(overrides: Partial<GrokSessionStatsResponse> = {}): GrokSessionStatsResponse {
  return {
    session: {
      started_at: '2026-01-14T10:00:00Z',
      duration: '5m 0s',
      duration_seconds: 300,
    },
    totals: {
      queries: 15,
      input_tokens: 5000,
      output_tokens: 10000,
      total_tokens: 15000,
      cost_usd: 0.05,
      cost_formatted: '$0.0500',
    },
    cache: {
      hit_rate_percent: 67,
      hits: 10,
      misses: 5,
      tokens_saved: 6666,
      cost_saved_usd: 0.0333,
    },
    rates: {
      queries_per_minute: 3,
      tokens_per_query: 1000,
      cost_per_query_usd: 0.0033,
    },
    ...overrides,
  };
}

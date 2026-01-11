/**
 * grok_status Tool
 *
 * Get current status of the Grok MCP plugin including rate limits,
 * cache stats, and session metrics.
 *
 * @module tools/status
 */

import { CallToolResult, TextContent } from '@modelcontextprotocol/sdk/types.js';
import type { Services } from '../types/index.js';

/**
 * Input parameters for grok_status tool
 */
export interface GrokStatusInput {
  /** Include detailed breakdown by model and memory usage (default: false) */
  include_details?: boolean;
}

/**
 * Overall plugin status
 */
export type PluginStatus = 'operational' | 'rate_limited' | 'budget_exceeded';

/**
 * Response from grok_status tool
 */
export interface GrokStatusResponse {
  /** Overall plugin status */
  status: PluginStatus;
  /** Rate limiting information */
  rate_limits: {
    tokens_remaining: number;
    requests_remaining: number;
    reset_in_seconds: number;
    is_limited: boolean;
  };
  /** Cache statistics */
  cache: {
    enabled: boolean;
    hit_rate_percent: number;
    entries: number;
    max_entries: number;
  };
  /** Session statistics */
  session: {
    queries: number;
    total_cost_usd: number;
    remaining_budget_usd: number;
    budget_used_percent: number;
    duration_minutes: number;
  };
  /** Detailed information (only if include_details: true) */
  details?: {
    cache_bytes: number;
    rate_limit_tier: string;
    cost_by_model: Record<string, number>;
    retry_state: { count: number; delay_ms: number };
  };
}

/**
 * JSON Schema for grok_status tool (JSON Schema 2020-12)
 */
export const grokStatusSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object' as const,
  properties: {
    include_details: {
      type: 'boolean',
      description: 'Include detailed breakdown by model and memory usage (default: false)',
    },
  },
  additionalProperties: false,
};

/**
 * Tool definition for grok_status
 */
export const grokStatusToolDefinition = {
  name: 'grok_status',
  description:
    'Get current status of the Grok MCP plugin including rate limits, cache stats, and session metrics.',
  inputSchema: grokStatusSchema,
};

/**
 * Determine the overall plugin status based on service states
 */
function determineStatus(services: Services): PluginStatus {
  // Check if budget is exceeded
  const costSummary = services.costTracker.getUsageSummary();
  if (costSummary.remainingBudgetUsd <= 0 && costSummary.limitEnforced) {
    return 'budget_exceeded';
  }

  // Check if rate limited
  const rateLimitStatus = services.rateLimiter.getStatus();
  if (rateLimitStatus.isLimited) {
    return 'rate_limited';
  }

  return 'operational';
}

/**
 * Execute status check and gather metrics
 */
export function executeGetStatus(services: Services, input: GrokStatusInput): GrokStatusResponse {
  // Get service statuses
  const rateLimitStatus = services.rateLimiter.getStatus();
  const rateLimiterOptions = services.rateLimiter.getOptions();
  const cacheStats = services.cache.getStats();
  const cacheOptions = services.cache.getOptions();
  const costSummary = services.costTracker.getUsageSummary();
  const sessionDurationMs = services.costTracker.getSessionDuration();

  // Build response
  const response: GrokStatusResponse = {
    status: determineStatus(services),
    rate_limits: {
      tokens_remaining: rateLimitStatus.tokensRemaining,
      requests_remaining: rateLimitStatus.requestsRemaining,
      reset_in_seconds: Math.ceil(rateLimitStatus.resetInMs / 1000),
      is_limited: rateLimitStatus.isLimited,
    },
    cache: {
      enabled: cacheOptions.enabled,
      hit_rate_percent: services.cache.getHitRate(),
      entries: cacheStats.size,
      max_entries: cacheStats.maxEntries,
    },
    session: {
      queries: costSummary.queryCount,
      total_cost_usd: costSummary.totalCostUsd,
      remaining_budget_usd: costSummary.remainingBudgetUsd,
      budget_used_percent: costSummary.budgetUsedPercent,
      duration_minutes: Math.round(sessionDurationMs / 60000),
    },
  };

  // Add details if requested
  if (input.include_details) {
    // Extract just the cost from byModel
    const costByModel: Record<string, number> = {};
    for (const [model, data] of Object.entries(costSummary.byModel)) {
      costByModel[model] = data.cost;
    }

    response.details = {
      cache_bytes: cacheStats.approximateBytes,
      rate_limit_tier: rateLimiterOptions.tier,
      cost_by_model: costByModel,
      retry_state: {
        count: rateLimitStatus.retryCount,
        delay_ms: rateLimitStatus.currentRetryDelay,
      },
    };
  }

  return response;
}

/**
 * Format status response as markdown for MCP output
 */
function formatStatusOutput(response: GrokStatusResponse): string {
  const lines: string[] = [];

  // Status indicator
  const statusEmoji = {
    operational: '\u2705', // green checkmark
    rate_limited: '\u26A0\uFE0F', // warning
    budget_exceeded: '\uD83D\uDED1', // stop sign
  };

  lines.push(
    `## Grok MCP Status: ${statusEmoji[response.status]} ${response.status.toUpperCase()}`
  );
  lines.push('');

  // Rate Limits
  lines.push('### Rate Limits');
  lines.push(`- **Tokens Remaining:** ${response.rate_limits.tokens_remaining.toLocaleString()}`);
  lines.push(
    `- **Requests Remaining:** ${response.rate_limits.requests_remaining.toLocaleString()}`
  );
  lines.push(`- **Reset In:** ${response.rate_limits.reset_in_seconds}s`);
  if (response.rate_limits.is_limited) {
    lines.push('- **Status:** \u26A0\uFE0F Rate limited');
  }
  lines.push('');

  // Cache
  lines.push('### Cache');
  lines.push(`- **Enabled:** ${response.cache.enabled ? 'Yes' : 'No'}`);
  lines.push(`- **Hit Rate:** ${response.cache.hit_rate_percent}%`);
  lines.push(`- **Entries:** ${response.cache.entries} / ${response.cache.max_entries}`);
  lines.push('');

  // Session
  lines.push('### Session');
  lines.push(`- **Queries:** ${response.session.queries}`);
  lines.push(`- **Total Cost:** $${response.session.total_cost_usd.toFixed(4)}`);
  lines.push(`- **Remaining Budget:** $${response.session.remaining_budget_usd.toFixed(2)}`);
  lines.push(`- **Budget Used:** ${response.session.budget_used_percent.toFixed(1)}%`);
  lines.push(`- **Duration:** ${response.session.duration_minutes} minutes`);

  // Details (if present)
  if (response.details) {
    lines.push('');
    lines.push('### Details');
    lines.push(`- **Cache Memory:** ${(response.details.cache_bytes / 1024).toFixed(1)} KB`);
    lines.push(`- **API Tier:** ${response.details.rate_limit_tier}`);

    if (Object.keys(response.details.cost_by_model).length > 0) {
      lines.push('');
      lines.push('**Cost by Model:**');
      for (const [model, cost] of Object.entries(response.details.cost_by_model)) {
        lines.push(`- ${model}: $${cost.toFixed(4)}`);
      }
    }

    if (response.details.retry_state.count > 0) {
      lines.push('');
      lines.push(
        `**Retry State:** ${response.details.retry_state.count} retries, ${response.details.retry_state.delay_ms}ms delay`
      );
    }
  }

  return lines.join('\n');
}

/**
 * Handle grok_status tool call
 *
 * @param services - MCP services (cache, costTracker, rateLimiter)
 * @param input - Tool input parameters
 * @returns MCP CallToolResult
 */
export async function handleGrokStatus(
  services: Services,
  input: unknown
): Promise<CallToolResult> {
  try {
    // Validate services
    if (!services) {
      throw new Error('Services not available');
    }

    // Parse input
    const params = (input || {}) as Record<string, unknown>;
    const statusInput: GrokStatusInput = {
      include_details: typeof params.include_details === 'boolean' ? params.include_details : false,
    };

    // Execute status check
    const result = executeGetStatus(services, statusInput);

    // Format output
    const content: TextContent = {
      type: 'text',
      text: formatStatusOutput(result),
    };

    return {
      content: [content],
      isError: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return {
      content: [{ type: 'text', text: `Error getting status: ${errorMessage}` }],
      isError: true,
    };
  }
}

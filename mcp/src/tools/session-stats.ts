/**
 * grok_session_stats Tool
 *
 * Get detailed session analytics including queries, tokens, cost,
 * cache efficiency, and per-model breakdown.
 *
 * @module tools/session-stats
 */

import { CallToolResult, TextContent } from '@modelcontextprotocol/sdk/types.js';
import type { Services } from '../types/index.js';

/**
 * Detail level for session stats
 */
export type DetailLevel = 'summary' | 'detailed' | 'full';

/**
 * Output format for session stats
 */
export type OutputFormat = 'markdown' | 'json';

/**
 * Input parameters for grok_session_stats tool
 */
export interface GrokSessionStatsInput {
  /** Level of detail: summary (default), detailed (per-model), or full (with timeline) */
  detail_level?: DetailLevel;
  /** Output format: markdown (default) or json */
  format?: OutputFormat;
}

/**
 * Per-model statistics
 */
export interface ModelStats {
  /** Number of queries to this model */
  queries: number;
  /** Percentage of total queries */
  query_percent: number;
  /** Input tokens for this model */
  input_tokens: number;
  /** Output tokens for this model */
  output_tokens: number;
  /** Total tokens for this model */
  total_tokens: number;
  /** Cost for this model in USD */
  cost_usd: number;
  /** Formatted cost string */
  cost_formatted: string;
  /** Percentage of total cost */
  cost_percent: number;
}

/**
 * Timeline entry for recent query
 */
export interface TimelineEntry {
  /** Timestamp of the query */
  timestamp: string;
  /** Model used */
  model: string;
  /** Total tokens used */
  tokens: number;
  /** Cost in USD */
  cost_usd: number;
}

/**
 * Response from grok_session_stats tool
 */
export interface GrokSessionStatsResponse {
  /** Session timing information */
  session: {
    /** Session start time (ISO8601) */
    started_at: string;
    /** Human-readable duration */
    duration: string;
    /** Duration in seconds */
    duration_seconds: number;
  };
  /** Aggregate usage totals */
  totals: {
    /** Total number of queries */
    queries: number;
    /** Total input tokens */
    input_tokens: number;
    /** Total output tokens */
    output_tokens: number;
    /** Total tokens (input + output) */
    total_tokens: number;
    /** Total cost in USD */
    cost_usd: number;
    /** Formatted cost string */
    cost_formatted: string;
  };
  /** Cache efficiency metrics */
  cache: {
    /** Cache hit rate percentage (0-100) */
    hit_rate_percent: number;
    /** Number of cache hits */
    hits: number;
    /** Number of cache misses */
    misses: number;
    /** Estimated tokens saved by cache */
    tokens_saved: number;
    /** Estimated cost saved by cache in USD */
    cost_saved_usd: number;
  };
  /** Rate metrics */
  rates: {
    /** Average queries per minute */
    queries_per_minute: number;
    /** Average tokens per query */
    tokens_per_query: number;
    /** Average cost per query in USD */
    cost_per_query_usd: number;
  };
  /** Per-model breakdown (only if detail_level >= 'detailed') */
  by_model?: Record<string, ModelStats>;
  /** Timeline data (only if detail_level == 'full') */
  timeline?: {
    /** Recent query entries (last 10) */
    recent_queries: TimelineEntry[];
  };
}

/**
 * JSON Schema for grok_session_stats tool (JSON Schema 2020-12)
 */
export const grokSessionStatsSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object' as const,
  properties: {
    detail_level: {
      type: 'string',
      enum: ['summary', 'detailed', 'full'],
      description:
        'Level of detail: summary (default), detailed (per-model breakdown), or full (all metrics with timeline)',
    },
    format: {
      type: 'string',
      enum: ['markdown', 'json'],
      description: 'Output format: markdown (default, human-readable) or json (structured data)',
    },
  },
  additionalProperties: false,
};

/**
 * Tool definition for grok_session_stats
 */
export const grokSessionStatsToolDefinition = {
  name: 'grok_session_stats',
  description:
    'Get detailed session analytics including queries, tokens, cost, cache efficiency, and per-model breakdown.',
  inputSchema: grokSessionStatsSchema,
};

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Format cost as a string
 */
function formatCost(costUsd: number): string {
  if (costUsd < 0.0001) {
    return '$0.0000';
  } else if (costUsd < 0.01) {
    return `$${costUsd.toFixed(4)}`;
  } else if (costUsd < 1) {
    return `$${costUsd.toFixed(4)}`;
  }
  return `$${costUsd.toFixed(2)}`;
}

/**
 * Execute session stats collection and return structured response
 */
export function executeGetSessionStats(
  services: Services,
  input: GrokSessionStatsInput
): GrokSessionStatsResponse {
  const detailLevel = input.detail_level || 'summary';

  // Get data from services
  const costSummary = services.costTracker.getUsageSummary();
  const sessionDurationMs = services.costTracker.getSessionDuration();
  const sessionStartTime = services.costTracker.getSessionStartTime();
  const cacheStats = services.cache.getStats();
  const cacheHitRate = services.cache.getHitRate();

  // Calculate session metrics
  const durationSeconds = Math.floor(sessionDurationMs / 1000);
  const durationMinutes = durationSeconds / 60;
  const totalTokens = costSummary.totalInputTokens + costSummary.totalOutputTokens;

  // Calculate rates (avoid division by zero)
  const queriesPerMinute = durationMinutes > 0 ? costSummary.queryCount / durationMinutes : 0;
  const tokensPerQuery = costSummary.queryCount > 0 ? totalTokens / costSummary.queryCount : 0;
  const costPerQuery =
    costSummary.queryCount > 0 ? costSummary.totalCostUsd / costSummary.queryCount : 0;

  // Estimate cache savings
  const tokensSaved = Math.round(cacheStats.hits * tokensPerQuery);
  const costSaved = cacheStats.hits * costPerQuery;

  // Build base response
  const response: GrokSessionStatsResponse = {
    session: {
      started_at: sessionStartTime.toISOString(),
      duration: formatDuration(sessionDurationMs),
      duration_seconds: durationSeconds,
    },
    totals: {
      queries: costSummary.queryCount,
      input_tokens: costSummary.totalInputTokens,
      output_tokens: costSummary.totalOutputTokens,
      total_tokens: totalTokens,
      cost_usd: costSummary.totalCostUsd,
      cost_formatted: formatCost(costSummary.totalCostUsd),
    },
    cache: {
      hit_rate_percent: cacheHitRate,
      hits: cacheStats.hits,
      misses: cacheStats.misses,
      tokens_saved: tokensSaved,
      cost_saved_usd: costSaved,
    },
    rates: {
      queries_per_minute: Math.round(queriesPerMinute * 100) / 100,
      tokens_per_query: Math.round(tokensPerQuery),
      cost_per_query_usd: Math.round(costPerQuery * 10000) / 10000,
    },
  };

  // Add per-model breakdown if detailed or full
  if (detailLevel === 'detailed' || detailLevel === 'full') {
    const byModel: Record<string, ModelStats> = {};

    for (const [model, data] of Object.entries(costSummary.byModel)) {
      const queryPercent =
        costSummary.queryCount > 0 ? (data.queries / costSummary.queryCount) * 100 : 0;
      const costPercent =
        costSummary.totalCostUsd > 0 ? (data.cost / costSummary.totalCostUsd) * 100 : 0;

      // We need to split tokens into input/output - the byModel only tracks total tokens
      // For now, we'll estimate based on the overall ratio
      const inputRatio =
        totalTokens > 0 ? costSummary.totalInputTokens / totalTokens : 0.5;
      const estimatedInput = Math.round(data.tokens * inputRatio);
      const estimatedOutput = data.tokens - estimatedInput;

      byModel[model] = {
        queries: data.queries,
        query_percent: Math.round(queryPercent * 10) / 10,
        input_tokens: estimatedInput,
        output_tokens: estimatedOutput,
        total_tokens: data.tokens,
        cost_usd: data.cost,
        cost_formatted: formatCost(data.cost),
        cost_percent: Math.round(costPercent * 10) / 10,
      };
    }

    response.by_model = byModel;
  }

  // Add timeline if full
  if (detailLevel === 'full') {
    const records = services.costTracker.getRecords();
    const recentRecords = records.slice(-10).reverse(); // Last 10, most recent first

    response.timeline = {
      recent_queries: recentRecords.map((record) => ({
        timestamp: new Date(record.timestamp).toISOString(),
        model: record.model,
        tokens: record.inputTokens + record.outputTokens,
        cost_usd: record.costUsd,
      })),
    };
  }

  return response;
}

/**
 * Format session stats as markdown
 */
export function formatSessionStatsMarkdown(response: GrokSessionStatsResponse): string {
  const lines: string[] = [];

  lines.push('## Session Statistics');
  lines.push('');

  // Session section
  lines.push('### Session');
  lines.push(`- **Started:** ${response.session.started_at}`);
  lines.push(`- **Duration:** ${response.session.duration}`);
  lines.push('');

  // Totals section
  lines.push('### Totals');
  lines.push(`- **Queries:** ${response.totals.queries}`);
  lines.push(
    `- **Total Tokens:** ${response.totals.total_tokens.toLocaleString()} (${response.totals.input_tokens.toLocaleString()} in / ${response.totals.output_tokens.toLocaleString()} out)`
  );
  lines.push(`- **Total Cost:** ${response.totals.cost_formatted}`);
  lines.push('');

  // Cache section
  lines.push('### Cache Efficiency');
  lines.push(`- **Hit Rate:** ${response.cache.hit_rate_percent}%`);
  lines.push(`- **Hits / Misses:** ${response.cache.hits} / ${response.cache.misses}`);
  if (response.cache.tokens_saved > 0) {
    lines.push(
      `- **Estimated Savings:** ~${response.cache.tokens_saved.toLocaleString()} tokens (~${formatCost(response.cache.cost_saved_usd)})`
    );
  }
  lines.push('');

  // Rates section
  lines.push('### Rates');
  lines.push(`- **Queries/min:** ${response.rates.queries_per_minute}`);
  lines.push(`- **Tokens/query:** ${response.rates.tokens_per_query.toLocaleString()}`);
  lines.push(`- **Cost/query:** ${formatCost(response.rates.cost_per_query_usd)}`);

  // Model breakdown section (if present)
  if (response.by_model && Object.keys(response.by_model).length > 0) {
    lines.push('');
    lines.push('### Model Usage');
    lines.push('');
    lines.push('| Model | Queries | Tokens | Cost | % of Cost |');
    lines.push('|-------|---------|--------|------|-----------|');

    for (const [model, stats] of Object.entries(response.by_model)) {
      lines.push(
        `| ${model} | ${stats.queries} (${stats.query_percent}%) | ${stats.total_tokens.toLocaleString()} | ${stats.cost_formatted} | ${stats.cost_percent}% |`
      );
    }
  }

  // Timeline section (if present)
  if (response.timeline && response.timeline.recent_queries.length > 0) {
    lines.push('');
    lines.push('### Recent Activity');
    lines.push('');

    for (let i = 0; i < response.timeline.recent_queries.length; i++) {
      const entry = response.timeline.recent_queries[i];
      const time = new Date(entry.timestamp).toLocaleTimeString();
      lines.push(
        `${i + 1}. ${time} - ${entry.model} - ${entry.tokens.toLocaleString()} tokens - ${formatCost(entry.cost_usd)}`
      );
    }
  }

  return lines.join('\n');
}

/**
 * Format session stats as JSON string
 */
export function formatSessionStatsJson(response: GrokSessionStatsResponse): string {
  return JSON.stringify(response, null, 2);
}

/**
 * Handle grok_session_stats tool call
 *
 * @param services - MCP services (cache, costTracker, rateLimiter)
 * @param input - Tool input parameters
 * @returns MCP CallToolResult
 */
export async function handleGrokSessionStats(
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
    const statsInput: GrokSessionStatsInput = {
      detail_level: ['summary', 'detailed', 'full'].includes(params.detail_level as string)
        ? (params.detail_level as DetailLevel)
        : 'summary',
      format: ['markdown', 'json'].includes(params.format as string)
        ? (params.format as OutputFormat)
        : 'markdown',
    };

    // Execute stats collection
    const result = executeGetSessionStats(services, statsInput);

    // Format output based on requested format
    const outputText =
      statsInput.format === 'json'
        ? formatSessionStatsJson(result)
        : formatSessionStatsMarkdown(result);

    const content: TextContent = {
      type: 'text',
      text: outputText,
    };

    return {
      content: [content],
      isError: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return {
      content: [{ type: 'text', text: `Error getting session stats: ${errorMessage}` }],
      isError: true,
    };
  }
}

/**
 * grok_status Tool
 *
 * Get current status of the Grok MCP plugin including rate limits,
 * cache stats, and session metrics.
 *
 * @module tools/status
 */
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
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
        retry_state: {
            count: number;
            delay_ms: number;
        };
    };
}
/**
 * JSON Schema for grok_status tool (JSON Schema 2020-12)
 */
export declare const grokStatusSchema: {
    $schema: string;
    type: "object";
    properties: {
        include_details: {
            type: string;
            description: string;
        };
    };
    additionalProperties: boolean;
};
/**
 * Tool definition for grok_status
 */
export declare const grokStatusToolDefinition: {
    name: string;
    description: string;
    inputSchema: {
        $schema: string;
        type: "object";
        properties: {
            include_details: {
                type: string;
                description: string;
            };
        };
        additionalProperties: boolean;
    };
};
/**
 * Execute status check and gather metrics
 */
export declare function executeGetStatus(services: Services, input: GrokStatusInput): GrokStatusResponse;
/**
 * Handle grok_status tool call
 *
 * @param services - MCP services (cache, costTracker, rateLimiter)
 * @param input - Tool input parameters
 * @returns MCP CallToolResult
 */
export declare function handleGrokStatus(services: Services, input: unknown): Promise<CallToolResult>;
//# sourceMappingURL=status.d.ts.map
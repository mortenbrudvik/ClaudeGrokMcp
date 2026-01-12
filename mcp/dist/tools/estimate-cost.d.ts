/**
 * grok_estimate_cost Tool
 *
 * Estimates the cost of a Grok API query before execution,
 * helping users understand and plan for API costs.
 *
 * @module tools/estimate-cost
 */
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
/**
 * Input parameters for grok_estimate_cost tool
 */
export interface EstimateCostInput {
    /** The query text to estimate (required) */
    query: string;
    /** Model to use (default: auto) */
    model?: string;
    /** Additional system context */
    context?: string;
    /** Expected maximum output tokens (for estimation) */
    max_tokens?: number;
}
/**
 * Response from cost estimation
 */
export interface EstimateCostResponse {
    /** Estimated input tokens */
    estimated_input_tokens: number;
    /** Estimated output tokens */
    estimated_output_tokens: number;
    /** Total estimated tokens */
    estimated_total_tokens: number;
    /** Estimated cost in USD */
    estimated_cost_usd: number;
    /** Model used for estimation */
    model: string;
    /** Pricing per 1M tokens */
    pricing: {
        input_per_1m: number;
        output_per_1m: number;
    };
    /** Warning message if the query is expensive */
    warning?: string;
    /** Cost breakdown details */
    breakdown: {
        input_cost_usd: number;
        output_cost_usd: number;
    };
}
/**
 * JSON Schema for grok_estimate_cost tool (JSON Schema 2020-12)
 */
export declare const estimateCostSchema: {
    $schema: string;
    type: "object";
    properties: {
        query: {
            type: string;
            description: string;
        };
        model: {
            type: string;
            description: string;
        };
        context: {
            type: string;
            description: string;
        };
        max_tokens: {
            type: string;
            minimum: number;
            maximum: number;
            description: string;
        };
    };
    required: string[];
    additionalProperties: boolean;
};
/**
 * Approximate token count for text
 *
 * Uses a simple heuristic: ~4 characters per token for English text.
 * This is a rough approximation; actual token count depends on the
 * specific tokenizer used by the model.
 *
 * @param text - Text to estimate tokens for
 * @returns Estimated token count
 */
export declare function estimateTokens(text: string): number;
/**
 * Execute cost estimation
 */
export declare function executeEstimateCost(input: EstimateCostInput): EstimateCostResponse;
/**
 * Handle grok_estimate_cost tool call
 *
 * @param input - Tool input parameters
 * @returns MCP CallToolResult
 */
export declare function handleEstimateCost(input: unknown): Promise<CallToolResult>;
/**
 * Compare costs across models for a given query
 *
 * Useful for helping users choose the right model.
 */
export declare function compareModelCosts(query: string, context?: string): Array<{
    model: string;
    cost: number;
    alias?: string;
}>;
//# sourceMappingURL=estimate-cost.d.ts.map
/**
 * grok_reason Tool
 *
 * Extended reasoning tool that leverages Grok's reasoning models for
 * complex problem-solving with optional thinking trace output.
 *
 * @module tools/reason
 */
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { XAIClient } from '../client/xai-client.js';
import { TokenUsage, CostEstimate, Services } from '../types/index.js';
/**
 * Reasoning effort levels
 */
export type ReasoningEffort = 'low' | 'medium' | 'high';
/**
 * Input parameters for grok_reason tool
 */
export interface ReasonInput {
    /** The question or problem to reason through (required) */
    query: string;
    /** Reasoning effort level (default: medium) */
    effort?: ReasoningEffort;
    /** Whether to show the thinking process (default: true) */
    show_thinking?: boolean;
    /** Model to use (default: grok-4-1-fast-reasoning) */
    model?: string;
    /** Additional context for reasoning */
    context?: string;
}
/**
 * Response from reasoning
 */
export interface ReasonResponse {
    /** The final answer/conclusion */
    response: string;
    /** The thinking/reasoning trace (if show_thinking is true) */
    thinking?: string;
    /** Model used */
    model: string;
    /** Reasoning effort applied */
    effort: ReasoningEffort;
    /** Token usage information */
    usage: TokenUsage;
    /** Cost estimate */
    cost: CostEstimate;
    /** Response time in milliseconds */
    response_time_ms: number;
}
/**
 * JSON Schema for grok_reason tool (JSON Schema 2020-12)
 */
export declare const reasonSchema: {
    $schema: string;
    type: "object";
    properties: {
        query: {
            type: string;
            description: string;
        };
        effort: {
            type: string;
            enum: string[];
            default: string;
            description: string;
        };
        show_thinking: {
            type: string;
            default: boolean;
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
    };
    required: string[];
    additionalProperties: boolean;
};
/**
 * Execute reasoning query
 */
export declare function executeReason(client: XAIClient, input: ReasonInput): Promise<ReasonResponse>;
/**
 * Handle grok_reason tool call
 *
 * @param client - XAI client instance
 * @param input - Tool input parameters
 * @param services - Optional services for cost tracking and rate limiting
 * @returns MCP CallToolResult
 */
export declare function handleReason(client: XAIClient, input: unknown, services?: Services): Promise<CallToolResult>;
//# sourceMappingURL=reason.d.ts.map
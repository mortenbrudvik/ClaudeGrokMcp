/**
 * grok_query Tool Implementation
 *
 * MCP tool for querying Grok models with full parameter support.
 * Supports model aliases, cost calculation, and response caching.
 *
 * @module tools/query
 */
import { XAIClient } from '../client/xai-client.js';
import { GrokQueryInput, GrokQueryResponse, StreamingGrokQueryResponse, Services, ComplexityScore, WeightedIndicator } from '../types/index.js';
/**
 * Long output indicators for smart streaming decision (P4-014)
 * These patterns suggest the response will be lengthy and benefit from streaming
 */
export declare const LONG_OUTPUT_INDICATORS: readonly WeightedIndicator[];
/**
 * Thresholds for auto-streaming decision (P4-014)
 */
export declare const STREAMING_THRESHOLDS: {
    /** Query length (chars) above which to auto-stream */
    readonly QUERY_LENGTH: 500;
    /** Complexity score above which to auto-stream */
    readonly COMPLEXITY_SCORE: 40;
    /** Long output indicator score threshold */
    readonly LONG_OUTPUT_SCORE: 10;
};
/**
 * Result of streaming decision with reason for UX display (P4-014)
 */
export interface StreamingDecision {
    /** Whether to use streaming mode */
    shouldStream: boolean;
    /** Reason for the decision (for UX display) */
    reason: 'explicit' | 'json_mode' | 'complexity' | 'query_length' | 'reasoning_model' | 'long_output' | 'simple';
    /** Human-readable explanation */
    explanation: string;
    /** Score that triggered the decision (if applicable) */
    score?: number;
}
/**
 * Determine whether to auto-enable streaming based on query characteristics (P4-014)
 *
 * Decision hierarchy:
 * 1. Explicit stream parameter always wins (return early if set)
 * 2. JSON mode -> never stream (partial JSON is invalid)
 * 3. Reasoning model -> always stream (thinking traces benefit from streaming)
 * 4. Long output indicators -> stream if score >= threshold
 * 5. Query length > 500 chars -> stream
 * 6. High complexity score -> stream
 * 7. Otherwise -> no stream (preserve cache benefits)
 *
 * @param query - The user's query text
 * @param context - Optional system context
 * @param explicitStream - User's explicit stream parameter (true/false/undefined)
 * @param resolvedModel - The model that will be used for the query
 * @param isJsonMode - Whether JSON mode is enabled
 * @param complexityScore - Pre-calculated complexity score (optional)
 * @returns StreamingDecision with shouldStream boolean and reason
 */
export declare function shouldAutoStream(query: string, context: string | undefined, explicitStream: boolean | undefined, resolvedModel: string, isJsonMode: boolean, complexityScore?: ComplexityScore): StreamingDecision;
/**
 * JSON Schema 2020-12 definition for grok_query tool
 */
export declare const grokQuerySchema: {
    readonly $schema: "https://json-schema.org/draft/2020-12/schema";
    readonly type: "object";
    readonly properties: {
        readonly query: {
            readonly type: "string";
            readonly description: "The question or prompt to send to Grok";
            readonly minLength: 1;
            readonly maxLength: 100000;
        };
        readonly model: {
            readonly type: "string";
            readonly description: "Model to use. Aliases: auto, default, fast, smartest, code, reasoning, cheap, vision. Or use model ID directly (e.g., grok-4, grok-4-fast)";
            readonly default: "auto";
        };
        readonly context: {
            readonly type: "string";
            readonly description: "Optional system context to guide the response";
            readonly maxLength: 50000;
        };
        readonly max_tokens: {
            readonly type: "integer";
            readonly description: "Maximum tokens in the response (default: 4096)";
            readonly minimum: 1;
            readonly maximum: 131072;
            readonly default: 4096;
        };
        readonly temperature: {
            readonly type: "number";
            readonly description: "Sampling temperature (0.0-2.0, default: 0.7)";
            readonly minimum: 0;
            readonly maximum: 2;
            readonly default: 0.7;
        };
        readonly top_p: {
            readonly type: "number";
            readonly description: "Nucleus sampling: only consider tokens with top_p cumulative probability (0-1). Alternative to temperature. Recommend altering top_p OR temperature, not both.";
            readonly minimum: 0;
            readonly maximum: 1;
        };
        readonly stream: {
            readonly type: "boolean";
            readonly description: "Enable streaming response. When omitted, auto-streaming decides based on query complexity.";
        };
        readonly timeout: {
            readonly type: "integer";
            readonly description: "Request timeout in milliseconds. Default varies by model: 90s for grok-4/smartest (slow flagship), 30s for fast models. Override if needed.";
            readonly minimum: 1000;
            readonly maximum: 120000;
        };
        readonly image_url: {
            readonly type: "string";
            readonly description: "Image URL for vision queries. Supports HTTPS URLs or base64 data URIs (data:image/png;base64,...). When provided, auto-selects vision-capable model if model is \"auto\".";
            readonly maxLength: 10000000;
        };
        readonly image_detail: {
            readonly type: "string";
            readonly enum: readonly ["auto", "low", "high"];
            readonly description: "Detail level for image analysis. \"low\" uses fewer tokens, \"high\" provides more detail. Default: \"auto\".";
            readonly default: "auto";
        };
        readonly response_format: {
            readonly type: "object";
            readonly description: "Request structured JSON output. When set, Grok will return valid JSON. Use { type: \"json_object\" }.";
            readonly properties: {
                readonly type: {
                    readonly type: "string";
                    readonly enum: readonly ["json_object"];
                    readonly description: "Output format type. Currently only \"json_object\" is supported.";
                };
            };
            readonly required: readonly ["type"];
            readonly additionalProperties: false;
        };
    };
    readonly required: readonly ["query"];
    readonly additionalProperties: false;
};
/**
 * Tool definition for MCP registration
 */
export declare const grokQueryToolDefinition: {
    name: string;
    description: string;
    inputSchema: {
        readonly $schema: "https://json-schema.org/draft/2020-12/schema";
        readonly type: "object";
        readonly properties: {
            readonly query: {
                readonly type: "string";
                readonly description: "The question or prompt to send to Grok";
                readonly minLength: 1;
                readonly maxLength: 100000;
            };
            readonly model: {
                readonly type: "string";
                readonly description: "Model to use. Aliases: auto, default, fast, smartest, code, reasoning, cheap, vision. Or use model ID directly (e.g., grok-4, grok-4-fast)";
                readonly default: "auto";
            };
            readonly context: {
                readonly type: "string";
                readonly description: "Optional system context to guide the response";
                readonly maxLength: 50000;
            };
            readonly max_tokens: {
                readonly type: "integer";
                readonly description: "Maximum tokens in the response (default: 4096)";
                readonly minimum: 1;
                readonly maximum: 131072;
                readonly default: 4096;
            };
            readonly temperature: {
                readonly type: "number";
                readonly description: "Sampling temperature (0.0-2.0, default: 0.7)";
                readonly minimum: 0;
                readonly maximum: 2;
                readonly default: 0.7;
            };
            readonly top_p: {
                readonly type: "number";
                readonly description: "Nucleus sampling: only consider tokens with top_p cumulative probability (0-1). Alternative to temperature. Recommend altering top_p OR temperature, not both.";
                readonly minimum: 0;
                readonly maximum: 1;
            };
            readonly stream: {
                readonly type: "boolean";
                readonly description: "Enable streaming response. When omitted, auto-streaming decides based on query complexity.";
            };
            readonly timeout: {
                readonly type: "integer";
                readonly description: "Request timeout in milliseconds. Default varies by model: 90s for grok-4/smartest (slow flagship), 30s for fast models. Override if needed.";
                readonly minimum: 1000;
                readonly maximum: 120000;
            };
            readonly image_url: {
                readonly type: "string";
                readonly description: "Image URL for vision queries. Supports HTTPS URLs or base64 data URIs (data:image/png;base64,...). When provided, auto-selects vision-capable model if model is \"auto\".";
                readonly maxLength: 10000000;
            };
            readonly image_detail: {
                readonly type: "string";
                readonly enum: readonly ["auto", "low", "high"];
                readonly description: "Detail level for image analysis. \"low\" uses fewer tokens, \"high\" provides more detail. Default: \"auto\".";
                readonly default: "auto";
            };
            readonly response_format: {
                readonly type: "object";
                readonly description: "Request structured JSON output. When set, Grok will return valid JSON. Use { type: \"json_object\" }.";
                readonly properties: {
                    readonly type: {
                        readonly type: "string";
                        readonly enum: readonly ["json_object"];
                        readonly description: "Output format type. Currently only \"json_object\" is supported.";
                    };
                };
                readonly required: readonly ["type"];
                readonly additionalProperties: false;
            };
        };
        readonly required: readonly ["query"];
        readonly additionalProperties: false;
    };
};
/**
 * Validate input parameters for grok_query
 *
 * @param input - Raw input from MCP tool call
 * @returns Validated GrokQueryInput
 * @throws Error with descriptive message for validation failures
 */
export declare function validateGrokQueryInput(input: unknown): GrokQueryInput;
/**
 * Execute a Grok query
 *
 * @param client - XAI client instance
 * @param input - Validated query input
 * @returns Query response with content, usage, and cost
 *
 * @example
 * ```typescript
 * const client = createClient();
 * const result = await executeGrokQuery(client, {
 *   query: "Explain recursion",
 *   model: "fast"
 * });
 * console.log(result.response);
 * console.log(`Cost: $${result.cost.estimated_usd.toFixed(4)}`);
 * ```
 */
export declare function executeGrokQuery(client: XAIClient, input: GrokQueryInput): Promise<GrokQueryResponse>;
/**
 * Execute a streaming Grok query with partial response support
 *
 * Consumes SSE stream and accumulates response.
 * If timeout occurs, returns partial response with available content.
 *
 * @param client - XAI client instance
 * @param input - Validated query input
 * @returns Streaming query response with partial flag
 */
export declare function executeGrokQueryStreaming(client: XAIClient, input: GrokQueryInput): Promise<StreamingGrokQueryResponse>;
/**
 * MCP tool handler for grok_query
 *
 * This is the main entry point called by the MCP server when
 * the grok_query tool is invoked.
 *
 * @param client - XAI client instance
 * @param args - Raw arguments from MCP tool call
 * @param services - Optional services for caching, cost tracking, and rate limiting
 * @returns MCP-formatted tool response
 */
export declare function handleGrokQuery(client: XAIClient, args: unknown, services?: Services): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
//# sourceMappingURL=query.d.ts.map
#!/usr/bin/env node
/**
 * Grok MCP Server
 *
 * MCP server for integrating xAI's Grok models into Claude Code.
 * Provides tools for querying, code analysis, reasoning, and cost estimation.
 *
 * @module grok-mcp
 */
import { type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { XAIClient } from './client/xai-client.js';
/**
 * Server name and version
 */
export declare const SERVER_NAME = "grok-mcp";
export declare const SERVER_VERSION = "2.0.0";
/**
 * All available tools (exported for testing)
 */
export declare const ALL_TOOLS: ({
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
                readonly description: "Enable streaming response (default: false)";
                readonly default: false;
            };
            readonly timeout: {
                readonly type: "integer";
                readonly description: "Request timeout in milliseconds (default: 30000). Increase for complex queries to slower models like grok-4.";
                readonly minimum: 1000;
                readonly maximum: 120000;
                readonly default: 30000;
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
} | {
    name: string;
    description: string;
    inputSchema: {
        readonly $schema: "https://json-schema.org/draft/2020-12/schema";
        readonly type: "object";
        readonly properties: {
            readonly refresh: {
                readonly type: "boolean";
                readonly description: "Force refresh from API, bypassing cache (default: false)";
                readonly default: false;
            };
        };
        readonly additionalProperties: false;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        readonly $schema: "https://json-schema.org/draft/2020-12/schema";
        readonly type: "object";
        readonly properties: {
            readonly query: {
                readonly type: "string";
                readonly minLength: 1;
                readonly maxLength: 10000;
            };
            readonly enable_web_search: {
                readonly type: "boolean";
                readonly default: false;
            };
            readonly enable_x_search: {
                readonly type: "boolean";
                readonly default: true;
            };
            readonly max_turns: {
                readonly type: "integer";
                readonly minimum: 1;
                readonly maximum: 20;
                readonly default: 3;
            };
            readonly x_handles: {
                readonly type: "array";
                readonly items: {
                    readonly type: "string";
                };
            };
            readonly exclude_x_handles: {
                readonly type: "array";
                readonly items: {
                    readonly type: "string";
                };
            };
            readonly from_date: {
                readonly type: "string";
            };
            readonly to_date: {
                readonly type: "string";
            };
            readonly domains: {
                readonly type: "array";
                readonly items: {
                    readonly type: "string";
                };
            };
            readonly exclude_domains: {
                readonly type: "array";
                readonly items: {
                    readonly type: "string";
                };
            };
            readonly include_citations: {
                readonly type: "boolean";
                readonly default: true;
            };
        };
        readonly required: readonly ["query"];
        readonly additionalProperties: false;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        readonly $schema: "https://json-schema.org/draft/2020-12/schema";
        readonly type: "object";
        readonly properties: {
            readonly code: {
                readonly type: "string";
                readonly minLength: 1;
                readonly maxLength: 50000;
                readonly description: "Python code to execute";
            };
            readonly description: {
                readonly type: "string";
                readonly maxLength: 1000;
                readonly description: "What the code should accomplish (used as context)";
            };
            readonly include_output: {
                readonly type: "boolean";
                readonly default: true;
                readonly description: "Include raw stdout/stderr in response";
            };
            readonly max_turns: {
                readonly type: "integer";
                readonly minimum: 1;
                readonly maximum: 10;
                readonly default: 3;
                readonly description: "Maximum execution iterations";
            };
            readonly model: {
                readonly type: "string";
                readonly description: "Model to use (default: grok-4-1-fast)";
            };
        };
        readonly required: readonly ["code"];
        readonly additionalProperties: false;
    };
} | {
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
} | {
    name: string;
    description: string;
    inputSchema: {
        readonly $schema: "https://json-schema.org/draft/2020-12/schema";
        readonly type: "object";
        readonly properties: {
            readonly prompt: {
                readonly type: "string";
                readonly minLength: 1;
                readonly maxLength: 10000;
                readonly description: "Text description of the image to generate";
            };
            readonly n: {
                readonly type: "integer";
                readonly minimum: 1;
                readonly maximum: 10;
                readonly default: 1;
                readonly description: "Number of images to generate (1-10, default: 1)";
            };
            readonly response_format: {
                readonly type: "string";
                readonly enum: readonly ["url", "b64_json"];
                readonly default: "url";
                readonly description: "Response format: url (temporary URLs, easier to view) or b64_json (base64 data, permanent)";
            };
            readonly model: {
                readonly type: "string";
                readonly description: "Model to use (default: grok-2-image-1212). Also supports \"image\" alias.";
            };
        };
        readonly required: readonly ["prompt"];
        readonly additionalProperties: false;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        $schema: string;
        type: "object";
        properties: {
            code: {
                type: string;
                description: string;
            };
            language: {
                type: string;
                description: string;
            };
            analysis_type: {
                type: string;
                enum: string[];
                default: string;
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
} | {
    name: string;
    description: string;
    inputSchema: {
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
} | {
    name: string;
    description: string;
    inputSchema: {
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
})[];
import type { Services } from './types/index.js';
export type { Services };
/**
 * Tool handler function type
 */
type ToolHandler = (client: XAIClient, args: unknown, services?: Services) => Promise<CallToolResult>;
/**
 * Tool registry - maps tool names to their handlers (exported for testing)
 * Adding new tools only requires adding an entry here
 *
 * Note: Handlers are cast to ToolHandler for type flexibility since the
 * underlying implementations use compatible but slightly different types.
 */
export declare const TOOL_HANDLERS: Record<string, ToolHandler>;
/**
 * Initialize services (exported for testing)
 */
export declare function initializeServices(): Services;
/**
 * Log service status (exported for testing)
 */
export declare function logServiceStatus(services: Services): void;
//# sourceMappingURL=index.d.ts.map
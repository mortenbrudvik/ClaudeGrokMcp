/**
 * grok_models Tool Implementation
 *
 * MCP tool for listing available Grok models with capabilities,
 * pricing, and recommendations.
 *
 * @module tools/models
 */
import { XAIClient } from '../client/xai-client.js';
import { GrokModelsInput, GrokModelsResponse } from '../types/index.js';
/**
 * JSON Schema 2020-12 definition for grok_models tool
 */
export declare const grokModelsSchema: {
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
/**
 * Tool definition for MCP registration
 */
export declare const grokModelsToolDefinition: {
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
};
/**
 * Validate input parameters for grok_models
 *
 * @param input - Raw input from MCP tool call
 * @returns Validated GrokModelsInput
 * @throws Error with descriptive message for validation failures
 */
export declare function validateGrokModelsInput(input: unknown): GrokModelsInput;
/**
 * Execute grok_models query
 *
 * @param client - XAI client instance
 * @param input - Validated models input
 * @returns Models response with enhanced info
 *
 * @example
 * ```typescript
 * const client = createClient();
 * const result = await executeGrokModels(client, { refresh: false });
 * console.log(`Found ${result.models.length} models`);
 * ```
 */
export declare function executeGrokModels(client: XAIClient, input: GrokModelsInput): Promise<GrokModelsResponse>;
/**
 * MCP tool handler for grok_models
 *
 * This is the main entry point called by the MCP server when
 * the grok_models tool is invoked.
 *
 * @param client - XAI client instance
 * @param args - Raw arguments from MCP tool call
 * @returns MCP-formatted tool response
 */
export declare function handleGrokModels(client: XAIClient, args: unknown): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
//# sourceMappingURL=models.d.ts.map
/**
 * grok_generate_image Tool
 *
 * Generate images using xAI's Image Generation API with Grok models.
 * Uses the grok-2-image-1212 model (outputs JPEG images).
 *
 * Rate limit: 5 requests per second for image generation.
 *
 * @module tools/generate-image
 */
import { XAIClient } from '../client/xai-client.js';
import { GrokGenerateImageInput, Services } from '../types/index.js';
/**
 * JSON Schema for grok_generate_image tool input
 */
export declare const grokGenerateImageSchema: {
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
/**
 * Tool definition for MCP registration
 */
export declare const grokGenerateImageToolDefinition: {
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
};
/**
 * Validate and normalize input parameters for grok_generate_image
 *
 * @param input - Raw input from MCP tool call
 * @returns Validated and normalized input with defaults applied
 * @throws Error if validation fails
 */
export declare function validateGrokGenerateImageInput(input: unknown): GrokGenerateImageInput;
/**
 * Handle grok_generate_image tool execution
 *
 * Generates images using xAI's Image Generation API.
 * Integrates with cost tracking and respects image-specific rate limits.
 *
 * @param client - XAI API client
 * @param args - Tool arguments (validated by schema)
 * @param services - Optional services (cache, costTracker, rateLimiter)
 * @returns MCP CallToolResult with formatted response or error
 */
export declare function handleGrokGenerateImage(client: XAIClient, args: unknown, services?: Services): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
    isError?: boolean;
}>;
//# sourceMappingURL=generate-image.d.ts.map
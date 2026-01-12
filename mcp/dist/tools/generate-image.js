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
import { XAIError, } from '../types/index.js';
// =============================================================================
// Constants
// =============================================================================
/** Default model for image generation */
const DEFAULT_MODEL = 'grok-2-image-1212';
/** Default number of images to generate */
const DEFAULT_N = 1;
/** Maximum number of images per request */
const MAX_N = 10;
/** Maximum prompt length */
const MAX_PROMPT_LENGTH = 10000;
/**
 * Rate limit delay for image generation (5 requests/second = 200ms between requests)
 * This is separate from the token-based rate limiting for chat completions.
 */
const IMAGE_RATE_LIMIT_DELAY_MS = 200;
// =============================================================================
// JSON Schema 2020-12 Definition
// =============================================================================
/**
 * JSON Schema for grok_generate_image tool input
 */
export const grokGenerateImageSchema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: {
        prompt: {
            type: 'string',
            minLength: 1,
            maxLength: MAX_PROMPT_LENGTH,
            description: 'Text description of the image to generate',
        },
        n: {
            type: 'integer',
            minimum: 1,
            maximum: MAX_N,
            default: DEFAULT_N,
            description: `Number of images to generate (1-${MAX_N}, default: ${DEFAULT_N})`,
        },
        response_format: {
            type: 'string',
            enum: ['url', 'b64_json'],
            default: 'url',
            description: 'Response format: url (temporary URLs, easier to view) or b64_json (base64 data, permanent)',
        },
        model: {
            type: 'string',
            description: `Model to use (default: ${DEFAULT_MODEL}). Also supports "image" alias.`,
        },
    },
    required: ['prompt'],
    additionalProperties: false,
};
/**
 * Tool definition for MCP registration
 */
export const grokGenerateImageToolDefinition = {
    name: 'grok_generate_image',
    description: "Generate images from text descriptions using xAI's Grok image models. " +
        'Returns JPEG images as URLs or base64 data. Generates up to 10 images per request.',
    inputSchema: grokGenerateImageSchema,
};
// =============================================================================
// Input Validation
// =============================================================================
/**
 * Validate and normalize input parameters for grok_generate_image
 *
 * @param input - Raw input from MCP tool call
 * @returns Validated and normalized input with defaults applied
 * @throws Error if validation fails
 */
export function validateGrokGenerateImageInput(input) {
    // Check if input is an object
    if (!input || typeof input !== 'object') {
        throw new Error('Input must be an object');
    }
    const params = input;
    // Validate required 'prompt' parameter
    if (params.prompt === undefined || params.prompt === null) {
        throw new Error('prompt parameter is required');
    }
    if (typeof params.prompt !== 'string') {
        throw new Error('prompt parameter must be a string');
    }
    const trimmedPrompt = params.prompt.trim();
    if (trimmedPrompt.length === 0) {
        throw new Error('prompt parameter cannot be empty');
    }
    if (trimmedPrompt.length > MAX_PROMPT_LENGTH) {
        throw new Error(`prompt parameter exceeds maximum length of ${MAX_PROMPT_LENGTH} characters`);
    }
    // Validate optional 'n' parameter
    if (params.n !== undefined) {
        if (typeof params.n !== 'number' || !Number.isInteger(params.n)) {
            throw new Error('n parameter must be an integer');
        }
        if (params.n < 1 || params.n > MAX_N) {
            throw new Error(`n parameter must be between 1 and ${MAX_N}`);
        }
    }
    // Validate optional 'response_format' parameter
    if (params.response_format !== undefined) {
        if (typeof params.response_format !== 'string') {
            throw new Error('response_format parameter must be a string');
        }
        if (!['url', 'b64_json'].includes(params.response_format)) {
            throw new Error('response_format must be "url" or "b64_json"');
        }
    }
    // Validate optional 'model' parameter
    if (params.model !== undefined && typeof params.model !== 'string') {
        throw new Error('model parameter must be a string');
    }
    // Return validated input with defaults applied
    return {
        prompt: trimmedPrompt,
        n: params.n ?? DEFAULT_N,
        response_format: params.response_format ?? 'url',
        model: params.model ?? DEFAULT_MODEL,
    };
}
// =============================================================================
// Response Formatting
// =============================================================================
/**
 * Format a single image entry for display
 */
function formatImageEntry(image, index) {
    let entry = '';
    if (image.url) {
        entry += `**Image ${index + 1}:** [View Image](${image.url})\n`;
    }
    else if (image.b64_json) {
        const preview = image.b64_json.substring(0, 50);
        const sizeKB = Math.round(image.b64_json.length / 1024);
        entry += `**Image ${index + 1}:** \`data:image/jpeg;base64,${preview}...\` (${sizeKB}KB)\n`;
    }
    if (image.revised_prompt) {
        entry += `  *Revised prompt:* ${image.revised_prompt}\n`;
    }
    return entry;
}
/**
 * Format the complete response for display
 */
function formatResponse(result) {
    const lines = [];
    // Header
    lines.push('**Image Generation Results**');
    lines.push('');
    // Image list
    if (result.images.length === 0) {
        lines.push('*No images were generated.*');
    }
    else {
        const plural = result.count > 1 ? 's' : '';
        lines.push(`Generated ${result.count} image${plural}:`);
        lines.push('');
        result.images.forEach((image, index) => {
            lines.push(formatImageEntry(image, index));
        });
    }
    // URL expiration notice
    if (result.url_expiration_notice) {
        lines.push(`*Note: ${result.url_expiration_notice}*`);
        lines.push('');
    }
    // Footer with metadata
    lines.push('---');
    const plural = result.count > 1 ? 's' : '';
    lines.push(`*${result.model} | ${result.count} image${plural} | $${result.cost.estimated_usd.toFixed(4)} | ${result.response_time_ms}ms*`);
    return lines.join('\n');
}
/**
 * Format error response
 */
function formatErrorResponse(errorMessage, responseTime) {
    return `**Image Generation Failed**\n\n${errorMessage}\n\n---\n*${responseTime}ms*`;
}
// =============================================================================
// Tool Handler
// =============================================================================
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
export async function handleGrokGenerateImage(client, args, services) {
    const startTime = Date.now();
    try {
        // Validate input
        const input = validateGrokGenerateImageInput(args);
        // Resolve model (support aliases like 'image')
        const model = client.resolveModel(input.model || DEFAULT_MODEL);
        // Estimate cost before execution
        const estimatedCost = client.calculateImageCost(model, input.n || 1);
        // Check budget before execution
        if (services?.costTracker) {
            services.costTracker.checkBudget(estimatedCost.estimated_usd);
        }
        // Respect image generation rate limit (5 req/s)
        // Add small delay to avoid hitting rate limits
        await new Promise((resolve) => setTimeout(resolve, IMAGE_RATE_LIMIT_DELAY_MS));
        // Generate image
        const response = await client.generateImage({
            model,
            prompt: input.prompt,
            n: input.n,
            response_format: input.response_format,
        });
        const responseTime = Date.now() - startTime;
        // Calculate actual cost based on images generated
        const cost = client.calculateImageCost(model, response.data.length);
        // Track cost
        if (services?.costTracker) {
            services.costTracker.addFromEstimate(cost);
        }
        // Build result
        const result = {
            images: response.data,
            count: response.data.length,
            model,
            cost,
            response_time_ms: responseTime,
            url_expiration_notice: input.response_format === 'url'
                ? 'Image URLs are temporary and may expire. Download images if you need to keep them.'
                : undefined,
        };
        // Format and return response
        const formattedResponse = formatResponse(result);
        return {
            content: [{ type: 'text', text: formattedResponse }],
            isError: false,
        };
    }
    catch (error) {
        const responseTime = Date.now() - startTime;
        // Get user-safe error message
        const errorMessage = error instanceof XAIError
            ? error.getSanitizedMessage()
            : error instanceof Error
                ? error.message
                : 'Unknown error occurred';
        return {
            content: [
                {
                    type: 'text',
                    text: formatErrorResponse(errorMessage, responseTime),
                },
            ],
            isError: true,
        };
    }
}
//# sourceMappingURL=generate-image.js.map
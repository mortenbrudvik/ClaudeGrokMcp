/**
 * grok_query Tool Implementation
 *
 * MCP tool for querying Grok models with full parameter support.
 * Supports model aliases, cost calculation, and response caching.
 *
 * @module tools/query
 */

import { XAIClient } from '../client/xai-client.js';
import { GrokQueryInput, GrokQueryResponse, ChatMessage, XAIError } from '../types/index.js';

/**
 * JSON Schema 2020-12 definition for grok_query tool
 */
export const grokQuerySchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description: 'The question or prompt to send to Grok',
      minLength: 1,
      maxLength: 100000,
    },
    model: {
      type: 'string',
      description:
        'Model to use. Aliases: auto, default, fast, smartest, code, reasoning, cheap, vision. Or use model ID directly (e.g., grok-4, grok-4-fast)',
      default: 'auto',
    },
    context: {
      type: 'string',
      description: 'Optional system context to guide the response',
      maxLength: 50000,
    },
    max_tokens: {
      type: 'integer',
      description: 'Maximum tokens in the response (default: 4096)',
      minimum: 1,
      maximum: 131072,
      default: 4096,
    },
    temperature: {
      type: 'number',
      description: 'Sampling temperature (0.0-2.0, default: 0.7)',
      minimum: 0,
      maximum: 2,
      default: 0.7,
    },
    stream: {
      type: 'boolean',
      description: 'Enable streaming response (default: false)',
      default: false,
    },
  },
  required: ['query'],
  additionalProperties: false,
} as const;

/**
 * Tool definition for MCP registration
 */
export const grokQueryToolDefinition = {
  name: 'grok_query',
  description:
    "Query xAI's Grok models. Use for getting Grok's perspective on questions, code analysis, explanations, and creative tasks. Returns response with token usage and cost estimate.",
  inputSchema: grokQuerySchema,
};

/**
 * Validate input parameters for grok_query
 *
 * @param input - Raw input from MCP tool call
 * @returns Validated GrokQueryInput
 * @throws Error with descriptive message for validation failures
 */
export function validateGrokQueryInput(input: unknown): GrokQueryInput {
  if (!input || typeof input !== 'object') {
    throw new Error('Input must be an object');
  }

  const params = input as Record<string, unknown>;

  // Required: query
  if (!params.query || typeof params.query !== 'string') {
    throw new Error('query is required and must be a string');
  }

  if (params.query.length === 0) {
    throw new Error('query cannot be empty');
  }

  if (params.query.length > 100000) {
    throw new Error('query exceeds maximum length of 100,000 characters');
  }

  // Optional: model
  if (params.model !== undefined && typeof params.model !== 'string') {
    throw new Error('model must be a string');
  }

  // Optional: context
  if (params.context !== undefined) {
    if (typeof params.context !== 'string') {
      throw new Error('context must be a string');
    }
    if (params.context.length > 50000) {
      throw new Error('context exceeds maximum length of 50,000 characters');
    }
  }

  // Optional: max_tokens
  if (params.max_tokens !== undefined) {
    if (typeof params.max_tokens !== 'number' || !Number.isInteger(params.max_tokens)) {
      throw new Error('max_tokens must be an integer');
    }
    if (params.max_tokens < 1 || params.max_tokens > 131072) {
      throw new Error('max_tokens must be between 1 and 131,072');
    }
  }

  // Optional: temperature
  if (params.temperature !== undefined) {
    if (typeof params.temperature !== 'number') {
      throw new Error('temperature must be a number');
    }
    if (params.temperature < 0 || params.temperature > 2) {
      throw new Error('temperature must be between 0 and 2');
    }
  }

  // Optional: stream
  if (params.stream !== undefined && typeof params.stream !== 'boolean') {
    throw new Error('stream must be a boolean');
  }

  return {
    query: params.query,
    model: (params.model as string) || 'auto',
    context: params.context as string | undefined,
    max_tokens: (params.max_tokens as number) || 4096,
    temperature: (params.temperature as number) ?? 0.7,
    stream: (params.stream as boolean) || false,
  };
}

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
export async function executeGrokQuery(
  client: XAIClient,
  input: GrokQueryInput
): Promise<GrokQueryResponse> {
  const startTime = Date.now();

  // Resolve model alias to actual model ID
  const resolvedModel = client.resolveModel(input.model || 'auto');

  // Build messages array
  const messages: ChatMessage[] = [];

  // Add system context if provided
  if (input.context) {
    messages.push({
      role: 'system',
      content: input.context,
    });
  }

  // Add user query
  messages.push({
    role: 'user',
    content: input.query,
  });

  try {
    // Make API request
    const response = await client.chatCompletion({
      model: resolvedModel,
      messages,
      max_tokens: input.max_tokens,
      temperature: input.temperature,
      stream: input.stream,
    });

    const responseTime = Date.now() - startTime;

    // Extract response content
    const assistantMessage = response.choices[0]?.message?.content || '';

    // Calculate cost
    const cost = client.calculateCost(
      response.model,
      response.usage.prompt_tokens,
      response.usage.completion_tokens
    );

    return {
      response: assistantMessage,
      model: response.model,
      usage: {
        prompt_tokens: response.usage.prompt_tokens,
        completion_tokens: response.usage.completion_tokens,
        reasoning_tokens: response.usage.reasoning_tokens,
        total_tokens: response.usage.total_tokens,
      },
      cost,
      thinking: undefined, // Reasoning models may populate this in future
      cached: false, // Cache integration in Phase 2
      response_time_ms: responseTime,
    };
  } catch (error) {
    if (error instanceof XAIError) {
      // Re-throw XAI errors with additional context
      throw new Error(
        `Grok API error (${error.statusCode}): ${error.message}` +
          (error.statusCode === 401
            ? '. Check your XAI_API_KEY environment variable.'
            : error.statusCode === 429
              ? '. Rate limit exceeded. Try again later.'
              : '')
      );
    }
    throw error;
  }
}

/**
 * MCP tool handler for grok_query
 *
 * This is the main entry point called by the MCP server when
 * the grok_query tool is invoked.
 *
 * @param client - XAI client instance
 * @param args - Raw arguments from MCP tool call
 * @returns MCP-formatted tool response
 */
export async function handleGrokQuery(
  client: XAIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    // Validate input (throws Tool Execution Error on failure)
    const input = validateGrokQueryInput(args);

    // Execute query
    const result = await executeGrokQuery(client, input);

    // Format response for MCP
    const responseText = [
      result.response,
      '',
      '---',
      `Model: ${result.model}`,
      `Tokens: ${result.usage.prompt_tokens} in / ${result.usage.completion_tokens} out (${result.usage.total_tokens} total)`,
      `Cost: $${result.cost.estimated_usd.toFixed(4)}`,
      `Response time: ${result.response_time_ms}ms`,
    ].join('\n');

    return {
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
    };
  } catch (error) {
    // Return Tool Execution Error per MCP spec
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
    };
  }
}

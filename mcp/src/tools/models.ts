/**
 * grok_models Tool Implementation
 *
 * MCP tool for listing available Grok models with capabilities,
 * pricing, and recommendations.
 *
 * @module tools/models
 */

import { XAIClient } from '../client/xai-client.js';
import {
  GrokModelsInput,
  GrokModelsResponse,
  GrokModelInfo,
  MODEL_ALIASES,
  MODEL_PRICING,
  type ModelAlias,
} from '../types/index.js';

/**
 * Known model capabilities (supplementing API response)
 * Updated: January 9, 2026 - Verified against live xAI API
 */
const MODEL_CAPABILITIES: Record<string, string[]> = {
  'grok-4-0709': ['chat', 'reasoning', 'code', 'vision', 'function-calling'],
  'grok-4-fast-non-reasoning': ['chat', 'code', 'function-calling'],
  'grok-4-fast-reasoning': ['chat', 'reasoning', 'code', 'function-calling'],
  'grok-4-1-fast-non-reasoning': ['chat', 'code', 'function-calling'],
  'grok-4-1-fast-reasoning': ['chat', 'reasoning', 'code', 'function-calling', 'extended-thinking'],
  'grok-code-fast-1': ['chat', 'code', 'function-calling', 'agentic'],
  'grok-3': ['chat', 'code', 'function-calling'],
  'grok-3-mini': ['chat', 'code'],
  'grok-2-vision-1212': ['chat', 'vision'],
  'grok-2-1212': ['chat'],
  'grok-2-image-1212': ['chat', 'image-generation'],
};

/**
 * Known context windows (supplementing API response)
 */
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'grok-4-0709': 256000,
  'grok-4-fast-non-reasoning': 2000000,
  'grok-4-fast-reasoning': 2000000,
  'grok-4-1-fast-non-reasoning': 2000000,
  'grok-4-1-fast-reasoning': 2000000,
  'grok-code-fast-1': 256000,
  'grok-3': 131000,
  'grok-3-mini': 131000,
  'grok-2-vision-1212': 32000,
  'grok-2-1212': 32000,
  'grok-2-image-1212': 32000,
};

/**
 * Model recommendations by use case
 */
const MODEL_RECOMMENDATIONS: Record<string, string[]> = {
  'grok-4-0709': ['complex reasoning', 'multi-step analysis', 'vision tasks'],
  'grok-4-fast-non-reasoning': ['quick queries', 'cost-effective', 'general tasks'],
  'grok-4-fast-reasoning': ['quick queries with reasoning', 'balanced tasks'],
  'grok-4-1-fast-non-reasoning': ['high-speed processing', 'large context'],
  'grok-4-1-fast-reasoning': ['extended thinking', 'chain-of-thought', 'large context'],
  'grok-code-fast-1': ['code generation', 'agentic coding', 'refactoring'],
  'grok-3': ['legacy compatibility', 'simple queries'],
  'grok-3-mini': ['lightweight tasks', 'cost-sensitive'],
  'grok-2-vision-1212': ['image analysis', 'visual understanding'],
  'grok-2-1212': ['legacy support'],
  'grok-2-image-1212': ['image generation'],
};

/**
 * JSON Schema 2020-12 definition for grok_models tool
 */
export const grokModelsSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    refresh: {
      type: 'boolean',
      description: 'Force refresh from API, bypassing cache (default: false)',
      default: false,
    },
  },
  additionalProperties: false,
} as const;

/**
 * Tool definition for MCP registration
 */
export const grokModelsToolDefinition = {
  name: 'grok_models',
  description:
    'List available Grok models with capabilities, pricing, and recommendations. Results are cached for 1 hour unless refresh is requested.',
  inputSchema: grokModelsSchema,
};

/**
 * Validate input parameters for grok_models
 *
 * @param input - Raw input from MCP tool call
 * @returns Validated GrokModelsInput
 * @throws Error with descriptive message for validation failures
 */
export function validateGrokModelsInput(input: unknown): GrokModelsInput {
  if (input === null || input === undefined) {
    return { refresh: false };
  }

  if (typeof input !== 'object') {
    throw new Error('Input must be an object');
  }

  const params = input as Record<string, unknown>;

  // Optional: refresh
  if (params.refresh !== undefined && typeof params.refresh !== 'boolean') {
    throw new Error('refresh must be a boolean');
  }

  return {
    refresh: (params.refresh as boolean) || false,
  };
}

/**
 * Find alias for a model ID
 */
function findModelAlias(modelId: string): ModelAlias | undefined {
  for (const [alias, id] of Object.entries(MODEL_ALIASES)) {
    if (id === modelId) {
      return alias as ModelAlias;
    }
  }
  return undefined;
}

/**
 * Determine model status based on known deprecations
 */
function getModelStatus(modelId: string): 'available' | 'deprecated' | 'unknown' {
  const deprecatedPatterns = ['beta', 'preview', '1212'];
  if (deprecatedPatterns.some((p) => modelId.includes(p))) {
    return 'deprecated';
  }
  if (MODEL_PRICING[modelId]) {
    return 'available';
  }
  return 'unknown';
}

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
export async function executeGrokModels(
  client: XAIClient,
  input: GrokModelsInput
): Promise<GrokModelsResponse> {
  // Fetch models from API (uses cache unless refresh requested)
  const apiResponse = await client.listModels(input.refresh);

  // Enhance model info with local knowledge
  const models: GrokModelInfo[] = apiResponse.data.map((model) => {
    const pricing = MODEL_PRICING[model.id] || { input: 0, output: 0 };
    const capabilities = MODEL_CAPABILITIES[model.id] || model.capabilities || [];
    const contextWindow = MODEL_CONTEXT_WINDOWS[model.id] || model.context_window || 0;

    return {
      id: model.id,
      alias: findModelAlias(model.id),
      context_window: contextWindow,
      capabilities,
      pricing: {
        input_per_1m: pricing.input,
        output_per_1m: pricing.output,
      },
      status: getModelStatus(model.id),
      recommended_for: MODEL_RECOMMENDATIONS[model.id],
    };
  });

  // Sort: available first, then by context window (largest first)
  models.sort((a, b) => {
    if (a.status !== b.status) {
      if (a.status === 'available') return -1;
      if (b.status === 'available') return 1;
    }
    return b.context_window - a.context_window;
  });

  // Get cache expiry
  const cacheExpiry = client.getModelsCacheExpiry();

  return {
    models,
    recommended: {
      general: 'grok-4-0709',
      fast: 'grok-4-fast-non-reasoning',
      code: 'grok-code-fast-1',
      reasoning: 'grok-4-1-fast-reasoning',
    },
    cached: client.isModelsCached() && !input.refresh,
    cache_expires_at: cacheExpiry?.toISOString(),
  };
}

/**
 * Format model info as markdown table row
 */
function formatModelRow(model: GrokModelInfo): string {
  const alias = model.alias ? `(${model.alias})` : '';
  const pricing =
    model.pricing.input_per_1m > 0
      ? `$${model.pricing.input_per_1m}/$${model.pricing.output_per_1m}`
      : 'Unknown';
  const context =
    model.context_window >= 1000000
      ? `${(model.context_window / 1000000).toFixed(1)}M`
      : model.context_window >= 1000
        ? `${(model.context_window / 1000).toFixed(0)}K`
        : String(model.context_window);
  const status = model.status === 'deprecated' ? '⚠️' : model.status === 'available' ? '✓' : '?';

  return `| ${model.id} ${alias} | ${context} | ${pricing} | ${status} |`;
}

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
export async function handleGrokModels(
  client: XAIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    // Validate input
    const input = validateGrokModelsInput(args);

    // Execute query
    const result = await executeGrokModels(client, input);

    // Format response as markdown
    const lines: string[] = [
      '## Available Grok Models',
      '',
      '| Model | Context | Pricing (per 1M) | Status |',
      '|-------|---------|------------------|--------|',
      ...result.models.map(formatModelRow),
      '',
      '### Recommended Models',
      '',
      `- **General tasks**: \`${result.recommended.general}\``,
      `- **Fast/cheap**: \`${result.recommended.fast}\``,
      `- **Code generation**: \`${result.recommended.code}\``,
      `- **Reasoning**: \`${result.recommended.reasoning}\``,
      '',
      '### Model Aliases',
      '',
      '| Alias | Resolves To |',
      '|-------|-------------|',
      ...Object.entries(MODEL_ALIASES).map(([alias, id]) => `| ${alias} | ${id} |`),
      '',
      '---',
      `Cached: ${result.cached ? 'Yes' : 'No'}${result.cache_expires_at ? ` (expires: ${result.cache_expires_at})` : ''}`,
    ];

    return {
      content: [
        {
          type: 'text',
          text: lines.join('\n'),
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

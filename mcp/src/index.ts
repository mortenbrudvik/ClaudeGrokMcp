#!/usr/bin/env node
/**
 * Grok MCP Server
 *
 * MCP server for integrating xAI's Grok models into Claude Code.
 * Provides tools for querying, code analysis, reasoning, and cost estimation.
 *
 * @module grok-mcp
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';

// Client
import { createClient, XAIClient } from './client/xai-client.js';

// Tools
import { grokQueryToolDefinition, handleGrokQuery } from './tools/query.js';
import { grokModelsToolDefinition, handleGrokModels } from './tools/models.js';
import { analyzeCodeSchema, handleAnalyzeCode } from './tools/analyze-code.js';
import { reasonSchema, handleReason } from './tools/reason.js';
import { estimateCostSchema, handleEstimateCost } from './tools/estimate-cost.js';
import { grokSearchXToolDefinition, handleGrokSearchX } from './tools/search-x.js';
import { grokExecuteCodeToolDefinition, handleGrokExecuteCode } from './tools/execute-code.js';
import { grokWithFileToolDefinition, handleGrokWithFile } from './tools/with-file.js';
import { grokStatusToolDefinition, handleGrokStatus } from './tools/status.js';
import {
  grokSessionStatsToolDefinition,
  handleGrokSessionStats,
} from './tools/session-stats.js';
import {
  grokGenerateImageToolDefinition,
  handleGrokGenerateImage,
} from './tools/generate-image.js';

// Services
import { getDefaultCache } from './services/cache.js';
import { getDefaultCostTracker } from './services/cost-tracker.js';
import { getDefaultRateLimiter } from './services/rate-limiter.js';

/**
 * Server name and version
 */
export const SERVER_NAME = 'grok-mcp';
export const SERVER_VERSION = '2.0.0';

/**
 * Tool definitions for Phase 2
 */
const analyzeCodeToolDefinition = {
  name: 'grok_analyze_code',
  description:
    "Analyze code for bugs, performance issues, security vulnerabilities, and style problems using Grok's code-focused models.",
  inputSchema: analyzeCodeSchema,
};

const reasonToolDefinition = {
  name: 'grok_reason',
  description:
    "Perform extended reasoning and deep thinking on complex problems using Grok's reasoning models.",
  inputSchema: reasonSchema,
};

const estimateCostToolDefinition = {
  name: 'grok_estimate_cost',
  description:
    'Estimate the cost of a Grok API query before execution to help plan and budget API usage.',
  inputSchema: estimateCostSchema,
};

/**
 * All available tools (exported for testing)
 */
export const ALL_TOOLS = [
  grokQueryToolDefinition,
  grokModelsToolDefinition,
  analyzeCodeToolDefinition,
  reasonToolDefinition,
  estimateCostToolDefinition,
  grokSearchXToolDefinition,
  grokExecuteCodeToolDefinition,
  grokWithFileToolDefinition,
  grokStatusToolDefinition,
  grokSessionStatsToolDefinition,
  grokGenerateImageToolDefinition,
];

// Import Services type (re-export for convenience)
import type { Services } from './types/index.js';
export type { Services };

/**
 * Tool handler function type
 */
type ToolHandler = (
  client: XAIClient,
  args: unknown,
  services?: Services
) => Promise<CallToolResult>;

/**
 * Tool registry - maps tool names to their handlers (exported for testing)
 * Adding new tools only requires adding an entry here
 *
 * Note: Handlers are cast to ToolHandler for type flexibility since the
 * underlying implementations use compatible but slightly different types.
 */
export const TOOL_HANDLERS: Record<string, ToolHandler> = {
  grok_query: ((client, args, services) => handleGrokQuery(client, args, services)) as ToolHandler,
  grok_models: ((client, args) => handleGrokModels(client, args)) as ToolHandler,
  grok_analyze_code: ((client, args, services) =>
    handleAnalyzeCode(client, args, services)) as ToolHandler,
  grok_reason: ((client, args, services) => handleReason(client, args, services)) as ToolHandler,
  grok_estimate_cost: ((_client, args) => handleEstimateCost(args)) as ToolHandler,
  grok_search_x: ((client, args, services) =>
    handleGrokSearchX(client, args, services)) as ToolHandler,
  grok_execute_code: ((client, args, services) =>
    handleGrokExecuteCode(client, args, services)) as ToolHandler,
  grok_with_file: ((client, args, services) =>
    handleGrokWithFile(client, args, services)) as ToolHandler,
  grok_status: ((_client, args, services) => handleGrokStatus(services!, args)) as ToolHandler,
  grok_session_stats: ((_client, args, services) =>
    handleGrokSessionStats(services!, args)) as ToolHandler,
  grok_generate_image: ((client, args, services) =>
    handleGrokGenerateImage(client, args, services)) as ToolHandler,
};

/**
 * Initialize services (exported for testing)
 */
export function initializeServices(): Services {
  return {
    cache: getDefaultCache(),
    costTracker: getDefaultCostTracker(),
    rateLimiter: getDefaultRateLimiter(),
  };
}

/**
 * Log service status (exported for testing)
 */
export function logServiceStatus(services: Services): void {
  const cacheOpts = services.cache.getOptions();
  const costOpts = services.costTracker.getOptions();
  const rateLimits = services.rateLimiter.getLimits();

  console.error(`[${SERVER_NAME}] Services initialized:`);
  console.error(
    `[${SERVER_NAME}]   - Cache: ${cacheOpts.enabled ? `enabled (TTL: ${cacheOpts.ttlSeconds}s)` : 'disabled'}`
  );
  console.error(
    `[${SERVER_NAME}]   - Cost tracking: limit $${costOpts.limitUsd} (${costOpts.enforceLimit ? 'enforced' : 'warn only'})`
  );
  console.error(
    `[${SERVER_NAME}]   - Rate limiting: ${rateLimits.tokensPerMinute.toLocaleString()} TPM`
  );
}

/**
 * Initialize and start the MCP server
 */
async function main(): Promise<void> {
  // Create xAI client (validates API key exists)
  let client: XAIClient;
  try {
    client = createClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${SERVER_NAME}] Failed to initialize: ${message}`);
    process.exit(1);
  }

  // Initialize services
  const services = initializeServices();

  // Create MCP server
  const server = new Server(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register tool listing handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: ALL_TOOLS.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  // Register tool execution handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Log budget warning before API calls (but let handlers enforce)
    if (
      [
        'grok_query',
        'grok_analyze_code',
        'grok_reason',
        'grok_execute_code',
        'grok_with_file',
        'grok_generate_image',
      ].includes(name)
    ) {
      const budgetWarning = services.costTracker.getBudgetWarning();
      if (budgetWarning) {
        console.error(`[${SERVER_NAME}] ${budgetWarning}`);
      }
    }

    // Look up handler in registry
    const handler = TOOL_HANDLERS[name];
    if (handler) {
      return handler(client, args, services);
    }

    // Unknown tool
    return {
      content: [
        {
          type: 'text',
          text: `Error: Unknown tool "${name}"`,
        },
      ],
      isError: true,
    };
  });

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log startup (to stderr to not interfere with MCP protocol)
  console.error(`[${SERVER_NAME}] Server started (v${SERVER_VERSION})`);
  console.error(`[${SERVER_NAME}] Tools: ${ALL_TOOLS.map((t) => t.name).join(', ')}`);
  logServiceStatus(services);
}

// Start server (only when not running under test frameworks)
if (!process.env.VITEST && process.env.NODE_ENV !== 'test') {
  main().catch((error) => {
    console.error(`[${SERVER_NAME}] Fatal error:`, error);
    process.exit(1);
  });
}

#!/usr/bin/env node
/**
 * Grok MCP Server
 *
 * MCP server for integrating xAI's Grok models into Claude Code.
 * Provides grok_query and grok_models tools for multi-model collaboration.
 *
 * @module grok-mcp
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { createClient, XAIClient } from './client/xai-client.js';
import { grokQueryToolDefinition, handleGrokQuery } from './tools/query.js';
import { grokModelsToolDefinition, handleGrokModels } from './tools/models.js';

/**
 * Server name and version
 */
const SERVER_NAME = 'grok-mcp';
const SERVER_VERSION = '1.0.0';

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
      tools: [
        {
          name: grokQueryToolDefinition.name,
          description: grokQueryToolDefinition.description,
          inputSchema: grokQueryToolDefinition.inputSchema,
        },
        {
          name: grokModelsToolDefinition.name,
          description: grokModelsToolDefinition.description,
          inputSchema: grokModelsToolDefinition.inputSchema,
        },
      ],
    };
  });

  // Register tool execution handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'grok_query':
        return handleGrokQuery(client, args);

      case 'grok_models':
        return handleGrokModels(client, args);

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Error: Unknown tool "${name}"`,
            },
          ],
        };
    }
  });

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log startup (to stderr to not interfere with MCP protocol)
  console.error(`[${SERVER_NAME}] Server started (v${SERVER_VERSION})`);
  console.error(`[${SERVER_NAME}] Tools: grok_query, grok_models`);
}

// Start server
main().catch((error) => {
  console.error(`[${SERVER_NAME}] Fatal error:`, error);
  process.exit(1);
});

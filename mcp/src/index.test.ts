import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SERVER_NAME,
  SERVER_VERSION,
  ALL_TOOLS,
  TOOL_HANDLERS,
  initializeServices,
  logServiceStatus,
} from './index.js';
import type { XAIClient } from './client/xai-client.js';

describe('Grok MCP Server', () => {
  describe('constants', () => {
    it('should have correct server name', () => {
      expect(SERVER_NAME).toBe('grok-mcp');
    });

    it('should have correct server version', () => {
      expect(SERVER_VERSION).toBe('2.0.0');
    });

    it('should export server name as non-empty string', () => {
      expect(typeof SERVER_NAME).toBe('string');
      expect(SERVER_NAME.length).toBeGreaterThan(0);
    });

    it('should export semver-formatted version', () => {
      expect(SERVER_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('ALL_TOOLS', () => {
    it('should export all 11 tools', () => {
      expect(ALL_TOOLS).toHaveLength(11);
    });

    it('should include grok_query tool', () => {
      const tool = ALL_TOOLS.find((t) => t.name === 'grok_query');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('Grok');
      expect(tool?.inputSchema).toBeDefined();
    });

    it('should include grok_models tool', () => {
      const tool = ALL_TOOLS.find((t) => t.name === 'grok_models');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('model');
    });

    it('should include grok_analyze_code tool', () => {
      const tool = ALL_TOOLS.find((t) => t.name === 'grok_analyze_code');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('code');
    });

    it('should include grok_reason tool', () => {
      const tool = ALL_TOOLS.find((t) => t.name === 'grok_reason');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('reasoning');
    });

    it('should include grok_estimate_cost tool', () => {
      const tool = ALL_TOOLS.find((t) => t.name === 'grok_estimate_cost');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('cost');
    });

    it('should include grok_search_x tool', () => {
      const tool = ALL_TOOLS.find((t) => t.name === 'grok_search_x');
      expect(tool).toBeDefined();
    });

    it('should include grok_execute_code tool', () => {
      const tool = ALL_TOOLS.find((t) => t.name === 'grok_execute_code');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('Execute Python code');
    });

    it('should include grok_with_file tool', () => {
      const tool = ALL_TOOLS.find((t) => t.name === 'grok_with_file');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('file');
    });

    it('should include grok_status tool', () => {
      const tool = ALL_TOOLS.find((t) => t.name === 'grok_status');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('status');
    });

    it('should include grok_generate_image tool', () => {
      const tool = ALL_TOOLS.find((t) => t.name === 'grok_generate_image');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('image');
    });

    it('should include grok_session_stats tool', () => {
      const tool = ALL_TOOLS.find((t) => t.name === 'grok_session_stats');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('session');
    });

    it('should have valid tool definitions with required fields', () => {
      for (const tool of ALL_TOOLS) {
        expect(tool.name).toBeDefined();
        expect(typeof tool.name).toBe('string');
        expect(tool.description).toBeDefined();
        expect(typeof tool.description).toBe('string');
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.inputSchema).toBe('object');
      }
    });

    it('should have unique tool names', () => {
      const names = ALL_TOOLS.map((t) => t.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });
  });

  describe('TOOL_HANDLERS', () => {
    it('should have handlers for all 11 tools', () => {
      expect(Object.keys(TOOL_HANDLERS)).toHaveLength(11);
    });

    it('should have handler for grok_query', () => {
      expect(TOOL_HANDLERS['grok_query']).toBeDefined();
      expect(typeof TOOL_HANDLERS['grok_query']).toBe('function');
    });

    it('should have handler for grok_models', () => {
      expect(TOOL_HANDLERS['grok_models']).toBeDefined();
      expect(typeof TOOL_HANDLERS['grok_models']).toBe('function');
    });

    it('should have handler for grok_analyze_code', () => {
      expect(TOOL_HANDLERS['grok_analyze_code']).toBeDefined();
      expect(typeof TOOL_HANDLERS['grok_analyze_code']).toBe('function');
    });

    it('should have handler for grok_reason', () => {
      expect(TOOL_HANDLERS['grok_reason']).toBeDefined();
      expect(typeof TOOL_HANDLERS['grok_reason']).toBe('function');
    });

    it('should have handler for grok_estimate_cost', () => {
      expect(TOOL_HANDLERS['grok_estimate_cost']).toBeDefined();
      expect(typeof TOOL_HANDLERS['grok_estimate_cost']).toBe('function');
    });

    it('should have handler for grok_search_x', () => {
      expect(TOOL_HANDLERS['grok_search_x']).toBeDefined();
      expect(typeof TOOL_HANDLERS['grok_search_x']).toBe('function');
    });

    it('should have handler for grok_execute_code', () => {
      expect(TOOL_HANDLERS['grok_execute_code']).toBeDefined();
      expect(typeof TOOL_HANDLERS['grok_execute_code']).toBe('function');
    });

    it('should have handler for grok_with_file', () => {
      expect(TOOL_HANDLERS['grok_with_file']).toBeDefined();
      expect(typeof TOOL_HANDLERS['grok_with_file']).toBe('function');
    });

    it('should have handler for grok_status', () => {
      expect(TOOL_HANDLERS['grok_status']).toBeDefined();
      expect(typeof TOOL_HANDLERS['grok_status']).toBe('function');
    });

    it('should have handler for grok_generate_image', () => {
      expect(TOOL_HANDLERS['grok_generate_image']).toBeDefined();
      expect(typeof TOOL_HANDLERS['grok_generate_image']).toBe('function');
    });

    it('should have handler for grok_session_stats', () => {
      expect(TOOL_HANDLERS['grok_session_stats']).toBeDefined();
      expect(typeof TOOL_HANDLERS['grok_session_stats']).toBe('function');
    });

    it('should have matching handlers for all tools in ALL_TOOLS', () => {
      for (const tool of ALL_TOOLS) {
        expect(TOOL_HANDLERS[tool.name]).toBeDefined();
      }
    });

    it('should not have extra handlers beyond defined tools', () => {
      const toolNames = ALL_TOOLS.map((t) => t.name);
      const handlerNames = Object.keys(TOOL_HANDLERS);
      for (const handler of handlerNames) {
        expect(toolNames).toContain(handler);
      }
    });
  });

  describe('initializeServices', () => {
    it('should return services object with all required properties', () => {
      const services = initializeServices();
      expect(services).toBeDefined();
      expect(services.cache).toBeDefined();
      expect(services.costTracker).toBeDefined();
      expect(services.rateLimiter).toBeDefined();
    });

    it('should initialize cache with expected methods', () => {
      const services = initializeServices();
      expect(typeof services.cache.get).toBe('function');
      expect(typeof services.cache.set).toBe('function');
      expect(typeof services.cache.getOptions).toBe('function');
    });

    it('should initialize cost tracker with expected methods', () => {
      const services = initializeServices();
      expect(typeof services.costTracker.addCost).toBe('function');
      expect(typeof services.costTracker.getTotalCost).toBe('function');
      expect(typeof services.costTracker.getOptions).toBe('function');
    });

    it('should initialize rate limiter with expected methods', () => {
      const services = initializeServices();
      expect(typeof services.rateLimiter.acquire).toBe('function');
      expect(typeof services.rateLimiter.release).toBe('function');
      expect(typeof services.rateLimiter.getLimits).toBe('function');
    });

    it('should return singleton instances (same instance each call)', () => {
      const services1 = initializeServices();
      const services2 = initializeServices();
      // Same singleton instances
      expect(services1.cache).toBe(services2.cache);
      expect(services1.costTracker).toBe(services2.costTracker);
      expect(services1.rateLimiter).toBe(services2.rateLimiter);
    });
  });

  describe('logServiceStatus', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should log service status to stderr', () => {
      const services = initializeServices();
      logServiceStatus(services);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should include server name in logs', () => {
      const services = initializeServices();
      logServiceStatus(services);
      const allCalls = consoleErrorSpy.mock.calls.flat().join(' ');
      expect(allCalls).toContain(SERVER_NAME);
    });

    it('should log cache status', () => {
      const services = initializeServices();
      logServiceStatus(services);
      const allCalls = consoleErrorSpy.mock.calls.flat().join(' ');
      expect(allCalls).toContain('Cache');
    });

    it('should log cost tracking status', () => {
      const services = initializeServices();
      logServiceStatus(services);
      const allCalls = consoleErrorSpy.mock.calls.flat().join(' ');
      expect(allCalls).toContain('Cost');
    });

    it('should log rate limiting status', () => {
      const services = initializeServices();
      logServiceStatus(services);
      const allCalls = consoleErrorSpy.mock.calls.flat().join(' ');
      expect(allCalls).toContain('Rate');
    });

    it('should log TPM (tokens per minute) for rate limiter', () => {
      const services = initializeServices();
      logServiceStatus(services);
      const allCalls = consoleErrorSpy.mock.calls.flat().join(' ');
      expect(allCalls).toContain('TPM');
    });
  });

  describe('tool handler integration', () => {
    let mockClient: XAIClient;
    let services: ReturnType<typeof initializeServices>;

    beforeEach(() => {
      // Create mock client
      mockClient = {
        chatCompletion: vi.fn().mockResolvedValue({
          id: 'test-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'grok-4-fast',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Test response' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        }),
        listModels: vi.fn().mockResolvedValue({
          data: [{ id: 'grok-4-fast', object: 'model', created: Date.now(), owned_by: 'xai' }],
        }),
        resolveModel: vi.fn((alias: string) => alias),
        calculateCost: vi.fn().mockReturnValue(0.001),
        validateApiKey: vi.fn().mockResolvedValue(true),
        getModelsCacheExpiry: vi.fn().mockReturnValue(null),
        isModelsCached: vi.fn().mockReturnValue(false),
      } as unknown as XAIClient;

      services = initializeServices();
    });

    it('should handle grok_estimate_cost without client', async () => {
      const handler = TOOL_HANDLERS['grok_estimate_cost'];
      const result = await handler(mockClient, { query: 'Test query' });
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should handle grok_models with mock client', async () => {
      const handler = TOOL_HANDLERS['grok_models'];
      const result = await handler(mockClient, {});
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should handle grok_query with mock client', async () => {
      const handler = TOOL_HANDLERS['grok_query'];
      const result = await handler(mockClient, { query: 'What is 2+2?' }, services);
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should handle grok_analyze_code with mock client', async () => {
      const handler = TOOL_HANDLERS['grok_analyze_code'];
      const result = await handler(mockClient, { code: 'function test() { return 1; }' }, services);
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should handle grok_reason with mock client', async () => {
      const handler = TOOL_HANDLERS['grok_reason'];
      const result = await handler(mockClient, { query: 'Think about testing' }, services);
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should pass services to handlers that support them', async () => {
      const handler = TOOL_HANDLERS['grok_query'];
      // Should not throw when services provided
      await expect(handler(mockClient, { query: 'Test' }, services)).resolves.toBeDefined();
    });
  });

  describe('tool schema validation', () => {
    it('grok_query should have required query parameter', () => {
      const tool = ALL_TOOLS.find((t) => t.name === 'grok_query');
      const schema = tool?.inputSchema as { required?: string[] };
      expect(schema.required).toContain('query');
    });

    it('grok_analyze_code should have required code parameter', () => {
      const tool = ALL_TOOLS.find((t) => t.name === 'grok_analyze_code');
      const schema = tool?.inputSchema as { required?: string[] };
      expect(schema.required).toContain('code');
    });

    it('grok_reason should have required query parameter', () => {
      const tool = ALL_TOOLS.find((t) => t.name === 'grok_reason');
      const schema = tool?.inputSchema as { required?: string[] };
      expect(schema.required).toContain('query');
    });

    it('grok_estimate_cost should have required query parameter', () => {
      const tool = ALL_TOOLS.find((t) => t.name === 'grok_estimate_cost');
      const schema = tool?.inputSchema as { required?: string[] };
      expect(schema.required).toContain('query');
    });

    it('all tools should have valid JSON schema structure', () => {
      for (const tool of ALL_TOOLS) {
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
        expect(typeof tool.inputSchema.properties).toBe('object');
      }
    });
  });
});

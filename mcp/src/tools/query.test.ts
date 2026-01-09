/**
 * Tests for grok_query tool
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server.js';
import { XAIClient } from '../client/xai-client.js';
import {
  validateGrokQueryInput,
  executeGrokQuery,
  handleGrokQuery,
  grokQuerySchema,
  grokQueryToolDefinition,
} from './query.js';

// Create a test client
const createTestClient = (): XAIClient =>
  new XAIClient({
    apiKey: 'test-api-key',
    baseUrl: 'https://api.x.ai/v1',
    timeout: 5000,
  });

describe('grok_query tool', () => {
  describe('grokQuerySchema', () => {
    it('should have correct JSON Schema version', () => {
      expect(grokQuerySchema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    });

    it('should require query field', () => {
      expect(grokQuerySchema.required).toContain('query');
    });

    it('should have correct property definitions', () => {
      expect(grokQuerySchema.properties.query.type).toBe('string');
      expect(grokQuerySchema.properties.model.default).toBe('auto');
      expect(grokQuerySchema.properties.max_tokens.default).toBe(4096);
      expect(grokQuerySchema.properties.temperature.default).toBe(0.7);
      expect(grokQuerySchema.properties.stream.default).toBe(false);
    });

    it('should not allow additional properties', () => {
      expect(grokQuerySchema.additionalProperties).toBe(false);
    });
  });

  describe('grokQueryToolDefinition', () => {
    it('should have correct tool name', () => {
      expect(grokQueryToolDefinition.name).toBe('grok_query');
    });

    it('should have description', () => {
      expect(grokQueryToolDefinition.description).toBeTruthy();
      expect(grokQueryToolDefinition.description).toContain('Grok');
    });

    it('should include input schema', () => {
      expect(grokQueryToolDefinition.inputSchema).toBe(grokQuerySchema);
    });
  });

  describe('validateGrokQueryInput', () => {
    describe('valid inputs', () => {
      it('should accept minimal valid input', () => {
        const result = validateGrokQueryInput({ query: 'Hello' });
        expect(result.query).toBe('Hello');
        expect(result.model).toBe('auto');
        expect(result.max_tokens).toBe(4096);
        expect(result.temperature).toBe(0.7);
        expect(result.stream).toBe(false);
      });

      it('should accept full input with all parameters', () => {
        const input = {
          query: 'Explain recursion',
          model: 'fast',
          context: 'You are a helpful assistant',
          max_tokens: 2048,
          temperature: 0.5,
          stream: true,
        };
        const result = validateGrokQueryInput(input);
        expect(result).toEqual(input);
      });

      it('should accept model aliases', () => {
        const aliases = ['auto', 'default', 'fast', 'smartest', 'code', 'reasoning', 'cheap'];
        for (const model of aliases) {
          const result = validateGrokQueryInput({ query: 'test', model });
          expect(result.model).toBe(model);
        }
      });

      it('should accept direct model IDs', () => {
        const result = validateGrokQueryInput({ query: 'test', model: 'grok-4' });
        expect(result.model).toBe('grok-4');
      });

      it('should handle zero temperature', () => {
        const result = validateGrokQueryInput({ query: 'test', temperature: 0 });
        expect(result.temperature).toBe(0);
      });

      it('should handle max temperature', () => {
        const result = validateGrokQueryInput({ query: 'test', temperature: 2 });
        expect(result.temperature).toBe(2);
      });
    });

    describe('invalid inputs', () => {
      it('should reject null input', () => {
        expect(() => validateGrokQueryInput(null)).toThrow('Input must be an object');
      });

      it('should reject undefined input', () => {
        expect(() => validateGrokQueryInput(undefined)).toThrow('Input must be an object');
      });

      it('should reject non-object input', () => {
        expect(() => validateGrokQueryInput('string')).toThrow('Input must be an object');
        expect(() => validateGrokQueryInput(123)).toThrow('Input must be an object');
        expect(() => validateGrokQueryInput([])).toThrow('query is required');
      });

      it('should reject missing query', () => {
        expect(() => validateGrokQueryInput({})).toThrow('query is required');
        expect(() => validateGrokQueryInput({ model: 'fast' })).toThrow('query is required');
      });

      it('should reject empty query', () => {
        // Empty string is falsy, so it triggers the "required" check first
        expect(() => validateGrokQueryInput({ query: '' })).toThrow('query is required');
      });

      it('should reject non-string query', () => {
        expect(() => validateGrokQueryInput({ query: 123 })).toThrow(
          'query is required and must be a string'
        );
        expect(() => validateGrokQueryInput({ query: null })).toThrow(
          'query is required and must be a string'
        );
      });

      it('should reject query exceeding max length', () => {
        const longQuery = 'a'.repeat(100001);
        expect(() => validateGrokQueryInput({ query: longQuery })).toThrow(
          'query exceeds maximum length'
        );
      });

      it('should reject non-string model', () => {
        expect(() => validateGrokQueryInput({ query: 'test', model: 123 })).toThrow(
          'model must be a string'
        );
      });

      it('should reject non-string context', () => {
        expect(() => validateGrokQueryInput({ query: 'test', context: 123 })).toThrow(
          'context must be a string'
        );
      });

      it('should reject context exceeding max length', () => {
        const longContext = 'a'.repeat(50001);
        expect(() => validateGrokQueryInput({ query: 'test', context: longContext })).toThrow(
          'context exceeds maximum length'
        );
      });

      it('should reject non-integer max_tokens', () => {
        expect(() => validateGrokQueryInput({ query: 'test', max_tokens: 100.5 })).toThrow(
          'max_tokens must be an integer'
        );
        expect(() => validateGrokQueryInput({ query: 'test', max_tokens: '100' })).toThrow(
          'max_tokens must be an integer'
        );
      });

      it('should reject max_tokens out of range', () => {
        expect(() => validateGrokQueryInput({ query: 'test', max_tokens: 0 })).toThrow(
          'max_tokens must be between 1 and 131,072'
        );
        expect(() => validateGrokQueryInput({ query: 'test', max_tokens: 200000 })).toThrow(
          'max_tokens must be between 1 and 131,072'
        );
      });

      it('should reject non-number temperature', () => {
        expect(() => validateGrokQueryInput({ query: 'test', temperature: '0.5' })).toThrow(
          'temperature must be a number'
        );
      });

      it('should reject temperature out of range', () => {
        expect(() => validateGrokQueryInput({ query: 'test', temperature: -0.1 })).toThrow(
          'temperature must be between 0 and 2'
        );
        expect(() => validateGrokQueryInput({ query: 'test', temperature: 2.1 })).toThrow(
          'temperature must be between 0 and 2'
        );
      });

      it('should reject non-boolean stream', () => {
        expect(() => validateGrokQueryInput({ query: 'test', stream: 'true' })).toThrow(
          'stream must be a boolean'
        );
        expect(() => validateGrokQueryInput({ query: 'test', stream: 1 })).toThrow(
          'stream must be a boolean'
        );
      });
    });
  });

  describe('executeGrokQuery', () => {
    let client: XAIClient;

    beforeEach(() => {
      client = createTestClient();
    });

    it('should execute a simple query successfully', async () => {
      const result = await executeGrokQuery(client, {
        query: 'What is 2+2?',
        model: 'auto',
        max_tokens: 4096,
        temperature: 0.7,
        stream: false,
      });

      expect(result.response).toBeTruthy();
      expect(result.model).toBeTruthy();
      expect(result.usage.total_tokens).toBeGreaterThan(0);
      expect(result.cost.estimated_usd).toBeGreaterThanOrEqual(0);
      expect(result.response_time_ms).toBeGreaterThan(0);
      expect(result.cached).toBe(false);
    });

    it('should include system context when provided', async () => {
      // Override handler to capture request
      let capturedBody: Record<string, unknown> | undefined;
      server.use(
        http.post('https://api.x.ai/v1/chat/completions', async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            id: 'test',
            object: 'chat.completion',
            created: Date.now(),
            model: 'grok-4',
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: 'Response' },
                finish_reason: 'stop',
              },
            ],
            usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
          });
        })
      );

      await executeGrokQuery(client, {
        query: 'Hello',
        model: 'auto',
        context: 'You are a pirate',
        max_tokens: 100,
        temperature: 0.7,
        stream: false,
      });

      expect(capturedBody).toBeDefined();
      const messages = capturedBody!.messages as Array<{ role: string; content: string }>;
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('system');
      expect(messages[0].content).toBe('You are a pirate');
      expect(messages[1].role).toBe('user');
    });

    it('should resolve model aliases', async () => {
      let capturedModel: string | undefined;
      server.use(
        http.post('https://api.x.ai/v1/chat/completions', async ({ request }) => {
          const body = (await request.json()) as { model: string };
          capturedModel = body.model;
          return HttpResponse.json({
            id: 'test',
            object: 'chat.completion',
            created: Date.now(),
            model: body.model,
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: 'Response' },
                finish_reason: 'stop',
              },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
          });
        })
      );

      await executeGrokQuery(client, {
        query: 'test',
        model: 'fast',
        max_tokens: 100,
        temperature: 0.7,
        stream: false,
      });

      expect(capturedModel).toBe('grok-4-fast-non-reasoning');
    });

    it('should calculate cost correctly', async () => {
      server.use(
        http.post('https://api.x.ai/v1/chat/completions', () => {
          return HttpResponse.json({
            id: 'test',
            object: 'chat.completion',
            created: Date.now(),
            model: 'grok-4-0709',
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: 'Response' },
                finish_reason: 'stop',
              },
            ],
            usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
          });
        })
      );

      const result = await executeGrokQuery(client, {
        query: 'test',
        model: 'auto',
        max_tokens: 1000,
        temperature: 0.7,
        stream: false,
      });

      // grok-4-0709: $3/1M input, $15/1M output
      // 1000 input tokens = $0.003, 500 output tokens = $0.0075
      expect(result.cost.estimated_usd).toBeCloseTo(0.0105, 4);
      expect(result.cost.input_tokens).toBe(1000);
      expect(result.cost.output_tokens).toBe(500);
    });

    it('should handle API errors with enhanced messages', async () => {
      server.use(
        http.post('https://api.x.ai/v1/chat/completions', () => {
          return HttpResponse.json({ error: { message: 'Invalid API key' } }, { status: 401 });
        })
      );

      await expect(
        executeGrokQuery(client, {
          query: 'test',
          model: 'auto',
          max_tokens: 100,
          temperature: 0.7,
          stream: false,
        })
      ).rejects.toThrow('Check your XAI_API_KEY');
    });

    it('should handle rate limit errors', async () => {
      // Simulate rate limit that doesn't recover
      let attempts = 0;
      server.use(
        http.post('https://api.x.ai/v1/chat/completions', () => {
          attempts++;
          return HttpResponse.json(
            { error: { message: 'Rate limited' } },
            { status: 429, headers: { 'Retry-After': '0' } }
          );
        })
      );

      await expect(
        executeGrokQuery(client, {
          query: 'test',
          model: 'auto',
          max_tokens: 100,
          temperature: 0.7,
          stream: false,
        })
      ).rejects.toThrow();

      // Should have retried
      expect(attempts).toBeGreaterThan(1);
    });
  });

  describe('handleGrokQuery', () => {
    let client: XAIClient;

    beforeEach(() => {
      client = createTestClient();
    });

    it('should return formatted MCP response on success', async () => {
      const result = await handleGrokQuery(client, { query: 'Hello' });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Model:');
      expect(result.content[0].text).toContain('Tokens:');
      expect(result.content[0].text).toContain('Cost:');
      expect(result.content[0].text).toContain('Response time:');
    });

    it('should return error for invalid input', async () => {
      const result = await handleGrokQuery(client, {});

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error:');
      expect(result.content[0].text).toContain('query is required');
    });

    it('should return error for API failures', async () => {
      server.use(
        http.post('https://api.x.ai/v1/chat/completions', () => {
          return HttpResponse.json({ error: { message: 'Server error' } }, { status: 500 });
        })
      );

      const result = await handleGrokQuery(client, { query: 'test' });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain('Error:');
    });

    it('should handle null input gracefully', async () => {
      const result = await handleGrokQuery(client, null);

      expect(result.content[0].text).toContain('Error:');
    });

    it('should include response metadata in output', async () => {
      server.use(
        http.post('https://api.x.ai/v1/chat/completions', () => {
          return HttpResponse.json({
            id: 'test',
            object: 'chat.completion',
            created: Date.now(),
            model: 'grok-4-fast-non-reasoning',
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: 'The answer is 4' },
                finish_reason: 'stop',
              },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          });
        })
      );

      const result = await handleGrokQuery(client, { query: 'What is 2+2?' });

      const text = result.content[0].text;
      expect(text).toContain('The answer is 4');
      expect(text).toContain('grok-4-fast-non-reasoning');
      expect(text).toContain('10 in / 5 out (15 total)');
    });
  });
});

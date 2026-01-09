/**
 * Tests for xAI Client
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server.js';
import { XAIClient, createClient } from './xai-client.js';
import { XAIError, MODEL_ALIASES, MODEL_FALLBACKS, MODEL_PRICING } from '../types/index.js';

describe('XAIClient', () => {
  describe('constructor', () => {
    it('should create client with API key', () => {
      const client = new XAIClient({ apiKey: 'test-key' });
      expect(client).toBeDefined();
    });

    it('should throw error without API key', () => {
      expect(() => new XAIClient({ apiKey: '' })).toThrow('XAI_API_KEY is required');
    });

    it('should accept custom baseUrl', () => {
      const client = new XAIClient({
        apiKey: 'test-key',
        baseUrl: 'https://custom.api.com',
      });
      expect(client).toBeDefined();
    });

    it('should accept custom timeout', () => {
      const client = new XAIClient({
        apiKey: 'test-key',
        timeout: 60000,
      });
      expect(client).toBeDefined();
    });
  });

  describe('resolveModel', () => {
    let client: XAIClient;

    beforeEach(() => {
      client = new XAIClient({ apiKey: 'test-key' });
    });

    it('should resolve model aliases', () => {
      expect(client.resolveModel('auto')).toBe(MODEL_ALIASES.auto);
      expect(client.resolveModel('fast')).toBe(MODEL_ALIASES.fast);
      expect(client.resolveModel('smartest')).toBe(MODEL_ALIASES.smartest);
      expect(client.resolveModel('code')).toBe(MODEL_ALIASES.code);
      expect(client.resolveModel('reasoning')).toBe(MODEL_ALIASES.reasoning);
    });

    it('should resolve fallback models', () => {
      expect(client.resolveModel('grok-3-beta')).toBe(MODEL_FALLBACKS['grok-3-beta']);
    });

    it('should return model ID as-is if not an alias or fallback', () => {
      // grok-4 is now a fallback to grok-4-0709
      expect(client.resolveModel('grok-4-0709')).toBe('grok-4-0709');
      expect(client.resolveModel('custom-model')).toBe('custom-model');
    });
  });

  describe('calculateCost', () => {
    let client: XAIClient;

    beforeEach(() => {
      client = new XAIClient({ apiKey: 'test-key' });
    });

    it('should calculate cost for known models', () => {
      const cost = client.calculateCost('grok-4-0709', 1000000, 500000);

      // grok-4-0709: $3 input, $15 output per 1M
      expect(cost.estimated_usd).toBe(3 + 7.5);
      expect(cost.input_tokens).toBe(1000000);
      expect(cost.output_tokens).toBe(500000);
      expect(cost.model).toBe('grok-4-0709');
      expect(cost.pricing.input_per_1m).toBe(MODEL_PRICING['grok-4-0709'].input);
      expect(cost.pricing.output_per_1m).toBe(MODEL_PRICING['grok-4-0709'].output);
    });

    it('should calculate zero cost for unknown models', () => {
      const cost = client.calculateCost('unknown-model', 1000, 500);

      expect(cost.estimated_usd).toBe(0);
      expect(cost.pricing.input_per_1m).toBe(0);
      expect(cost.pricing.output_per_1m).toBe(0);
    });

    it('should handle small token counts', () => {
      const cost = client.calculateCost('grok-4-fast-non-reasoning', 100, 50);

      // grok-4-fast-non-reasoning: $0.20 input, $0.50 output per 1M
      const expectedInput = (100 / 1000000) * 0.2;
      const expectedOutput = (50 / 1000000) * 0.5;
      expect(cost.estimated_usd).toBeCloseTo(expectedInput + expectedOutput, 8);
    });
  });

  describe('chatCompletion', () => {
    let client: XAIClient;

    beforeEach(() => {
      client = new XAIClient({ apiKey: 'test-key' });
    });

    it('should make successful chat completion request', async () => {
      const response = await client.chatCompletion({
        model: 'grok-4',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(response.choices).toHaveLength(1);
      expect(response.choices[0].message.content).toBeTruthy();
      expect(response.usage.total_tokens).toBeGreaterThan(0);
    });

    it('should resolve model aliases before sending', async () => {
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
              { index: 0, message: { role: 'assistant', content: 'Hi' }, finish_reason: 'stop' },
            ],
            usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
          });
        })
      );

      await client.chatCompletion({
        model: 'fast',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(capturedModel).toBe('grok-4-fast-non-reasoning');
    });

    it('should handle 401 unauthorized error', async () => {
      server.use(
        http.post('https://api.x.ai/v1/chat/completions', () => {
          return HttpResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
        })
      );

      await expect(
        client.chatCompletion({
          model: 'grok-4',
          messages: [{ role: 'user', content: 'Hello' }],
        })
      ).rejects.toThrow(XAIError);
    });

    it('should handle 500 server error', async () => {
      server.use(
        http.post('https://api.x.ai/v1/chat/completions', () => {
          return HttpResponse.json({ error: { message: 'Server Error' } }, { status: 500 });
        })
      );

      await expect(
        client.chatCompletion({
          model: 'grok-4',
          messages: [{ role: 'user', content: 'Hello' }],
        })
      ).rejects.toThrow(XAIError);
    });
  });

  describe('listModels', () => {
    let client: XAIClient;

    beforeEach(() => {
      client = new XAIClient({ apiKey: 'test-key' });
    });

    it('should fetch models list', async () => {
      const response = await client.listModels(true);

      expect(response.data).toBeInstanceOf(Array);
      expect(response.data.length).toBeGreaterThan(0);
    });

    it('should cache models list', async () => {
      let callCount = 0;
      server.use(
        http.get('https://api.x.ai/v1/models', () => {
          callCount++;
          return HttpResponse.json({
            object: 'list',
            data: [{ id: 'grok-4', object: 'model', created: Date.now(), owned_by: 'xai' }],
          });
        })
      );

      await client.listModels(true); // First call
      await client.listModels(false); // Cached
      await client.listModels(false); // Cached

      expect(callCount).toBe(1);
    });

    it('should force refresh when requested', async () => {
      let callCount = 0;
      server.use(
        http.get('https://api.x.ai/v1/models', () => {
          callCount++;
          return HttpResponse.json({
            object: 'list',
            data: [{ id: 'grok-4', object: 'model', created: Date.now(), owned_by: 'xai' }],
          });
        })
      );

      await client.listModels(true);
      await client.listModels(true);

      expect(callCount).toBe(2);
    });
  });

  describe('validateApiKey', () => {
    let client: XAIClient;

    beforeEach(() => {
      client = new XAIClient({ apiKey: 'test-key' });
    });

    it('should return true for valid API key', async () => {
      const isValid = await client.validateApiKey();
      expect(isValid).toBe(true);
    });

    it('should return false for invalid API key', async () => {
      server.use(
        http.get('https://api.x.ai/v1/models', () => {
          return HttpResponse.json({ error: { message: 'Invalid API key' } }, { status: 401 });
        })
      );

      const isValid = await client.validateApiKey();
      expect(isValid).toBe(false);
    });

    it('should throw for non-401 errors', async () => {
      server.use(
        http.get('https://api.x.ai/v1/models', () => {
          return HttpResponse.json({ error: { message: 'Server error' } }, { status: 500 });
        })
      );

      await expect(client.validateApiKey()).rejects.toThrow(XAIError);
    });
  });

  describe('cache methods', () => {
    let client: XAIClient;

    beforeEach(() => {
      client = new XAIClient({ apiKey: 'test-key' });
    });

    it('should return null cache expiry before first call', () => {
      expect(client.getModelsCacheExpiry()).toBeNull();
    });

    it('should return cache expiry after fetching models', async () => {
      await client.listModels(true);
      const expiry = client.getModelsCacheExpiry();
      expect(expiry).toBeInstanceOf(Date);
      expect(expiry!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should indicate cache status correctly', async () => {
      expect(client.isModelsCached()).toBe(false);
      await client.listModels(true);
      expect(client.isModelsCached()).toBe(true);
    });
  });
});

describe('createClient', () => {
  it('should throw error when XAI_API_KEY is not set', () => {
    const originalKey = process.env.XAI_API_KEY;
    delete process.env.XAI_API_KEY;

    expect(() => createClient()).toThrow('XAI_API_KEY environment variable is required');

    if (originalKey) {
      process.env.XAI_API_KEY = originalKey;
    }
  });

  it('should create client when XAI_API_KEY is set', () => {
    const originalKey = process.env.XAI_API_KEY;
    process.env.XAI_API_KEY = 'test-api-key';

    const client = createClient();
    expect(client).toBeInstanceOf(XAIClient);

    if (originalKey) {
      process.env.XAI_API_KEY = originalKey;
    } else {
      delete process.env.XAI_API_KEY;
    }
  });
});

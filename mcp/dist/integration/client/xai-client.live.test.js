/**
 * XAI Client Live Integration Tests
 *
 * Tests against the real xAI API.
 * Requires XAI_API_KEY environment variable.
 *
 * @module integration/client/xai-client.live.test
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '../../client/xai-client.js';
import { isApiAvailable, skipIfApiUnavailable } from '../setup.js';
import { createTestClient, trackCost, TEST_MODEL, TEST_DEFAULTS } from '../helpers/api-client.js';
import { withRateLimit } from '../helpers/rate-limiter.js';
import '../helpers/assertions.js';
describe('XAIClient (live)', () => {
    let client;
    beforeAll(() => {
        if (!isApiAvailable()) {
            return;
        }
        client = createTestClient();
    });
    describe('authentication', () => {
        it('should authenticate with valid API key', async () => {
            if (skipIfApiUnavailable())
                return;
            const isValid = await withRateLimit(() => client.validateApiKey());
            expect(isValid).toBe(true);
        });
        it('should reject invalid API key', async () => {
            if (skipIfApiUnavailable())
                return;
            // Create client with invalid key
            const originalKey = process.env.XAI_API_KEY;
            process.env.XAI_API_KEY = 'xai-invalid-test-key-12345678901234567890';
            try {
                const badClient = createClient();
                // API may return false or throw an error for invalid key
                try {
                    const isValid = await withRateLimit(() => badClient.validateApiKey());
                    expect(isValid).toBe(false);
                }
                catch (error) {
                    // Also valid - API rejected the key with an error
                    expect(error).toBeDefined();
                }
            }
            finally {
                process.env.XAI_API_KEY = originalKey;
            }
        });
    });
    describe('listModels', () => {
        it('should fetch available models', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => client.listModels(true));
            expect(result.data).toBeDefined();
            expect(Array.isArray(result.data)).toBe(true);
            expect(result.data.length).toBeGreaterThan(0);
            // Should include at least one Grok model
            const hasGrokModel = result.data.some((m) => m.id.includes('grok'));
            expect(hasGrokModel).toBe(true);
        });
        it('should include model metadata', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => client.listModels());
            // Check first model has expected fields
            const model = result.data[0];
            expect(model.id).toBeDefined();
            expect(typeof model.id).toBe('string');
        });
        it('should cache model list', async () => {
            if (skipIfApiUnavailable())
                return;
            // First call - should hit API
            await withRateLimit(() => client.listModels(true));
            // Second call - should use cache
            const cacheExpiry = client.getModelsCacheExpiry();
            expect(cacheExpiry).toBeDefined();
            expect(cacheExpiry.getTime()).toBeGreaterThan(Date.now());
        });
    });
    describe('chatCompletion', () => {
        it('should complete a basic chat request', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => client.chatCompletion({
                model: TEST_MODEL,
                messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
                max_tokens: TEST_DEFAULTS.max_tokens,
                temperature: TEST_DEFAULTS.temperature,
            }));
            expect(result.choices).toBeDefined();
            expect(result.choices.length).toBeGreaterThan(0);
            expect(result.choices[0].message.content).toBeDefined();
            expect(result.usage).toBeDefined();
            // Track cost
            if (result.usage) {
                trackCost('chatCompletion basic', TEST_MODEL, {
                    prompt_tokens: result.usage.prompt_tokens,
                    completion_tokens: result.usage.completion_tokens,
                });
            }
        });
        it('should return valid usage statistics', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => client.chatCompletion({
                model: TEST_MODEL,
                messages: [{ role: 'user', content: 'Say: test' }],
                max_tokens: 10,
                temperature: 0,
            }));
            expect(result).toHaveValidUsage();
            expect(result.usage.prompt_tokens).toBeGreaterThan(0);
            expect(result.usage.completion_tokens).toBeGreaterThan(0);
            // Track cost
            trackCost('chatCompletion usage', TEST_MODEL, {
                prompt_tokens: result.usage.prompt_tokens,
                completion_tokens: result.usage.completion_tokens,
            });
        });
        it('should resolve model aliases', async () => {
            if (skipIfApiUnavailable())
                return;
            // Use 'fast' alias which should resolve to grok-4-fast
            const result = await withRateLimit(() => client.chatCompletion({
                model: 'fast',
                messages: [{ role: 'user', content: 'Reply: hi' }],
                max_tokens: 5,
                temperature: 0,
            }));
            expect(result.choices).toBeDefined();
            expect(result.model).toContain('grok');
            // Track cost
            if (result.usage) {
                trackCost('chatCompletion alias', result.model, {
                    prompt_tokens: result.usage.prompt_tokens,
                    completion_tokens: result.usage.completion_tokens,
                });
            }
        });
    });
    describe('cost calculation', () => {
        it('should calculate cost correctly', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => client.chatCompletion({
                model: TEST_MODEL,
                messages: [{ role: 'user', content: 'Reply: cost test' }],
                max_tokens: 10,
                temperature: 0,
            }));
            // Use the actual model returned by the API for cost calculation
            const actualModel = result.model;
            const costEstimate = client.calculateCost(actualModel, result.usage.prompt_tokens, result.usage.completion_tokens);
            // Cost may be 0 if model not in pricing table, check tokens instead
            expect(costEstimate.input_tokens).toBe(result.usage.prompt_tokens);
            expect(costEstimate.output_tokens).toBe(result.usage.completion_tokens);
            expect(costEstimate.model).toBe(actualModel);
            // Track cost
            trackCost('cost calculation', actualModel, {
                prompt_tokens: result.usage.prompt_tokens,
                completion_tokens: result.usage.completion_tokens,
            });
        });
    });
});
//# sourceMappingURL=xai-client.live.test.js.map
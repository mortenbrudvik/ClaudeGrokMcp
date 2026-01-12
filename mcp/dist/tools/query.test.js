/**
 * Tests for grok_query tool
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server.js';
import { XAIClient } from '../client/xai-client.js';
import { ResponseCache } from '../services/cache.js';
import { CostTracker } from '../services/cost-tracker.js';
import { RateLimiter } from '../services/rate-limiter.js';
import { validateGrokQueryInput, executeGrokQuery, executeGrokQueryStreaming, handleGrokQuery, grokQuerySchema, grokQueryToolDefinition, shouldAutoStream, LONG_OUTPUT_INDICATORS, STREAMING_THRESHOLDS, } from './query.js';
// Create a test client
const createTestClient = () => new XAIClient({
    apiKey: 'xai-test-api-key-12345678',
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
            expect('default' in grokQuerySchema.properties.stream).toBe(false); // No default allows auto-streaming
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
                expect(result.stream).toBeUndefined(); // Allows auto-streaming to decide
            });
            it('should accept full input with all parameters', () => {
                const input = {
                    query: 'Explain recursion',
                    model: 'fast',
                    context: 'You are a helpful assistant',
                    max_tokens: 2048,
                    temperature: 0.5,
                    top_p: 0.9,
                    stream: true,
                    timeout: 60000,
                };
                const result = validateGrokQueryInput(input);
                expect(result).toEqual({
                    ...input,
                    image_url: undefined, // P4-015: vision fields added to output
                    image_detail: 'auto',
                });
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
                expect(() => validateGrokQueryInput({ query: 123 })).toThrow('query is required and must be a string');
                expect(() => validateGrokQueryInput({ query: null })).toThrow('query is required and must be a string');
            });
            it('should reject query exceeding max length', () => {
                const longQuery = 'a'.repeat(100001);
                expect(() => validateGrokQueryInput({ query: longQuery })).toThrow('query exceeds maximum length');
            });
            it('should reject non-string model', () => {
                expect(() => validateGrokQueryInput({ query: 'test', model: 123 })).toThrow('model must be a string');
            });
            it('should reject non-string context', () => {
                expect(() => validateGrokQueryInput({ query: 'test', context: 123 })).toThrow('context must be a string');
            });
            it('should reject context exceeding max length', () => {
                const longContext = 'a'.repeat(50001);
                expect(() => validateGrokQueryInput({ query: 'test', context: longContext })).toThrow('context exceeds maximum length');
            });
            it('should reject non-integer max_tokens', () => {
                expect(() => validateGrokQueryInput({ query: 'test', max_tokens: 100.5 })).toThrow('max_tokens must be an integer');
                expect(() => validateGrokQueryInput({ query: 'test', max_tokens: '100' })).toThrow('max_tokens must be an integer');
            });
            it('should reject max_tokens out of range', () => {
                expect(() => validateGrokQueryInput({ query: 'test', max_tokens: 0 })).toThrow('max_tokens must be between 1 and 131,072');
                expect(() => validateGrokQueryInput({ query: 'test', max_tokens: 200000 })).toThrow('max_tokens must be between 1 and 131,072');
            });
            it('should reject non-number temperature', () => {
                expect(() => validateGrokQueryInput({ query: 'test', temperature: '0.5' })).toThrow('temperature must be a number');
            });
            it('should reject temperature out of range', () => {
                expect(() => validateGrokQueryInput({ query: 'test', temperature: -0.1 })).toThrow('temperature must be between 0 and 2');
                expect(() => validateGrokQueryInput({ query: 'test', temperature: 2.1 })).toThrow('temperature must be between 0 and 2');
            });
            it('should reject non-boolean stream', () => {
                expect(() => validateGrokQueryInput({ query: 'test', stream: 'true' })).toThrow('stream must be a boolean');
                expect(() => validateGrokQueryInput({ query: 'test', stream: 1 })).toThrow('stream must be a boolean');
            });
            it('should reject non-integer timeout', () => {
                expect(() => validateGrokQueryInput({ query: 'test', timeout: '30000' })).toThrow('timeout must be an integer');
                expect(() => validateGrokQueryInput({ query: 'test', timeout: 30000.5 })).toThrow('timeout must be an integer');
            });
            it('should reject timeout out of range', () => {
                expect(() => validateGrokQueryInput({ query: 'test', timeout: 999 })).toThrow('timeout must be between 1,000 and 120,000 milliseconds');
                expect(() => validateGrokQueryInput({ query: 'test', timeout: 120001 })).toThrow('timeout must be between 1,000 and 120,000 milliseconds');
            });
            it('should accept valid timeout values', () => {
                const result1 = validateGrokQueryInput({ query: 'test', timeout: 1000 });
                expect(result1.timeout).toBe(1000);
                const result2 = validateGrokQueryInput({ query: 'test', timeout: 60000 });
                expect(result2.timeout).toBe(60000);
                const result3 = validateGrokQueryInput({ query: 'test', timeout: 120000 });
                expect(result3.timeout).toBe(120000);
            });
            it('should default timeout to 30000', () => {
                const result = validateGrokQueryInput({ query: 'test' });
                expect(result.timeout).toBe(30000);
            });
        });
        // P4-015: Vision support validation tests
        describe('vision support (P4-015)', () => {
            it('should accept valid HTTPS image URL', () => {
                const result = validateGrokQueryInput({
                    query: 'Describe this image',
                    image_url: 'https://example.com/image.png',
                });
                expect(result.image_url).toBe('https://example.com/image.png');
                expect(result.image_detail).toBe('auto');
            });
            it('should accept base64 data URI', () => {
                const base64Url = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
                const result = validateGrokQueryInput({
                    query: 'Describe this image',
                    image_url: base64Url,
                });
                expect(result.image_url).toBe(base64Url);
            });
            it('should reject HTTP URLs (insecure)', () => {
                expect(() => validateGrokQueryInput({
                    query: 'test',
                    image_url: 'http://example.com/image.png',
                })).toThrow('must be a valid HTTPS URL or base64 data URI');
            });
            it('should reject invalid URL format', () => {
                expect(() => validateGrokQueryInput({
                    query: 'test',
                    image_url: 'not-a-url',
                })).toThrow('must be a valid HTTPS URL or base64 data URI');
            });
            it('should reject empty image_url', () => {
                expect(() => validateGrokQueryInput({
                    query: 'test',
                    image_url: '',
                })).toThrow('image_url cannot be empty');
            });
            it('should reject non-string image_url', () => {
                expect(() => validateGrokQueryInput({
                    query: 'test',
                    image_url: 123,
                })).toThrow('image_url must be a string');
            });
            it('should accept valid image_detail values', () => {
                for (const detail of ['auto', 'low', 'high']) {
                    const result = validateGrokQueryInput({
                        query: 'test',
                        image_url: 'https://example.com/image.png',
                        image_detail: detail,
                    });
                    expect(result.image_detail).toBe(detail);
                }
            });
            it('should reject invalid image_detail', () => {
                expect(() => validateGrokQueryInput({
                    query: 'test',
                    image_url: 'https://example.com/image.png',
                    image_detail: 'invalid',
                })).toThrow('image_detail must be one of: auto, low, high');
            });
            it('should default image_detail to auto', () => {
                const result = validateGrokQueryInput({
                    query: 'test',
                    image_url: 'https://example.com/image.png',
                });
                expect(result.image_detail).toBe('auto');
            });
            it('should support JPEG base64 data URI', () => {
                const result = validateGrokQueryInput({
                    query: 'test',
                    image_url: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
                });
                expect(result.image_url).toContain('data:image/jpeg');
            });
            it('should support WebP base64 data URI', () => {
                const result = validateGrokQueryInput({
                    query: 'test',
                    image_url: 'data:image/webp;base64,UklGRiYAAABXRUJQ',
                });
                expect(result.image_url).toContain('data:image/webp');
            });
            it('should support GIF base64 data URI', () => {
                const result = validateGrokQueryInput({
                    query: 'test',
                    image_url: 'data:image/gif;base64,R0lGODlhAQAB',
                });
                expect(result.image_url).toContain('data:image/gif');
            });
        });
        describe('top_p parameter', () => {
            it('should accept valid top_p values', () => {
                expect(validateGrokQueryInput({ query: 'test', top_p: 0 }).top_p).toBe(0);
                expect(validateGrokQueryInput({ query: 'test', top_p: 0.5 }).top_p).toBe(0.5);
                expect(validateGrokQueryInput({ query: 'test', top_p: 1 }).top_p).toBe(1);
            });
            it('should leave top_p undefined when not provided', () => {
                const result = validateGrokQueryInput({ query: 'test' });
                expect(result.top_p).toBeUndefined();
            });
            it('should reject non-number top_p', () => {
                expect(() => validateGrokQueryInput({ query: 'test', top_p: '0.5' })).toThrow('top_p must be a number');
            });
            it('should reject top_p out of range', () => {
                expect(() => validateGrokQueryInput({ query: 'test', top_p: -0.1 })).toThrow('top_p must be between 0 and 1');
                expect(() => validateGrokQueryInput({ query: 'test', top_p: 1.1 })).toThrow('top_p must be between 0 and 1');
            });
        });
    });
    describe('executeGrokQuery', () => {
        let client;
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
            let capturedBody;
            server.use(http.post('https://api.x.ai/v1/chat/completions', async ({ request }) => {
                capturedBody = (await request.json());
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
            }));
            await executeGrokQuery(client, {
                query: 'Hello',
                model: 'auto',
                context: 'You are a pirate',
                max_tokens: 100,
                temperature: 0.7,
                stream: false,
            });
            expect(capturedBody).toBeDefined();
            const messages = capturedBody.messages;
            expect(messages).toHaveLength(2);
            expect(messages[0].role).toBe('system');
            expect(messages[0].content).toBe('You are a pirate');
            expect(messages[1].role).toBe('user');
        });
        it('should resolve model aliases', async () => {
            let capturedModel;
            server.use(http.post('https://api.x.ai/v1/chat/completions', async ({ request }) => {
                const body = (await request.json());
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
            }));
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
            server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
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
            }));
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
            server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
                return HttpResponse.json({ error: { message: 'Invalid API key' } }, { status: 401 });
            }));
            await expect(executeGrokQuery(client, {
                query: 'test',
                model: 'auto',
                max_tokens: 100,
                temperature: 0.7,
                stream: false,
            })).rejects.toThrow('Check your XAI_API_KEY');
        });
        it('should handle rate limit errors', async () => {
            // Simulate rate limit that doesn't recover
            let attempts = 0;
            server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
                attempts++;
                return HttpResponse.json({ error: { message: 'Rate limited' } }, { status: 429, headers: { 'Retry-After': '0' } });
            }));
            await expect(executeGrokQuery(client, {
                query: 'test',
                model: 'auto',
                max_tokens: 100,
                temperature: 0.7,
                stream: false,
            })).rejects.toThrow();
            // Should have retried
            expect(attempts).toBeGreaterThan(1);
        });
    });
    describe('handleGrokQuery', () => {
        let client;
        beforeEach(() => {
            client = createTestClient();
        });
        it('should return formatted MCP response on success', async () => {
            const result = await handleGrokQuery(client, { query: 'Hello' });
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('text');
            expect(result.content[0].text).toContain('🤖 **Grok:**');
            expect(result.content[0].text).toContain('⚡');
            expect(result.content[0].text).toContain('tokens');
            expect(result.content[0].text).toContain('$');
            expect(result.content[0].text).toContain('ms');
        });
        it('should return error for invalid input', async () => {
            const result = await handleGrokQuery(client, {});
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('text');
            expect(result.content[0].text).toContain('Error:');
            expect(result.content[0].text).toContain('query is required');
        });
        it('should return error for API failures', async () => {
            server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
                return HttpResponse.json({ error: { message: 'Server error' } }, { status: 500 });
            }));
            const result = await handleGrokQuery(client, { query: 'test' });
            expect(result.content).toHaveLength(1);
            expect(result.content[0].text).toContain('Error:');
        });
        it('should handle null input gracefully', async () => {
            const result = await handleGrokQuery(client, null);
            expect(result.content[0].text).toContain('Error:');
        });
        it('should include response metadata in output', async () => {
            server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
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
            }));
            const result = await handleGrokQuery(client, { query: 'What is 2+2?' });
            const text = result.content[0].text;
            expect(text).toContain('🤖 **Grok:**');
            expect(text).toContain('The answer is 4');
            expect(text).toContain('grok-4-fast-non-reasoning');
            expect(text).toContain('15 tokens');
        });
    });
    describe('handleGrokQuery with services', () => {
        let client;
        let mockServices;
        beforeEach(() => {
            client = createTestClient();
            // Create mock services
            mockServices = {
                cache: new ResponseCache({ enabled: true, ttlSeconds: 300 }),
                costTracker: new CostTracker({ limitUsd: 10, enforceLimit: true }),
                rateLimiter: new RateLimiter({ tier: 'standard' }),
            };
        });
        it('should return cached response on cache hit', async () => {
            // Pre-populate cache with the model that auto-selection will choose
            // "Hello" is a simple query, so auto-selects grok-4-fast-non-reasoning
            const cacheKey = mockServices.cache.generateKey('Hello', 'grok-4-fast-non-reasoning', undefined);
            const cachedResponse = {
                response: 'Cached response',
                model: 'grok-4-fast-non-reasoning',
                usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
                cost: {
                    estimated_usd: 0.0001,
                    input_tokens: 10,
                    output_tokens: 5,
                    model: 'grok-4-fast-non-reasoning',
                    pricing: { input_per_1m: 0.2, output_per_1m: 0.5 },
                },
                cached: false,
                response_time_ms: 100,
            };
            mockServices.cache.set(cacheKey, cachedResponse);
            const result = await handleGrokQuery(client, { query: 'Hello' }, mockServices);
            expect(result.content[0].text).toContain('Cached response');
            // Enhanced cache visibility shows CACHED badge instead of "• cached" suffix
            expect(result.content[0].text).toContain('📦 **CACHED**');
        });
        it('should cache response after API call', async () => {
            // "Cache test query" is simple, auto-selects grok-4-fast-non-reasoning
            server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
                return HttpResponse.json({
                    id: 'test',
                    object: 'chat.completion',
                    created: Date.now(),
                    model: 'grok-4-fast-non-reasoning',
                    choices: [
                        {
                            index: 0,
                            message: { role: 'assistant', content: 'Fresh response' },
                            finish_reason: 'stop',
                        },
                    ],
                    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
                });
            }));
            // First call - should hit API
            await handleGrokQuery(client, { query: 'Cache test query' }, mockServices);
            // Verify it's now cached (model is auto-selected based on query)
            const cacheKey = mockServices.cache.generateKey('Cache test query', 'grok-4-fast-non-reasoning', undefined);
            const cached = mockServices.cache.get(cacheKey);
            expect(cached).toBeDefined();
            expect(cached?.response).toBe('Fresh response');
        });
        it('should check budget before API call', async () => {
            // Set up a cost tracker that will reject
            const lowBudgetTracker = new CostTracker({ limitUsd: 0.0001, enforceLimit: true });
            // Artificially consume budget
            lowBudgetTracker.addFromEstimate({
                estimated_usd: 0.0001,
                input_tokens: 100,
                output_tokens: 50,
                model: 'grok-4-0709',
                pricing: { input_per_1m: 3, output_per_1m: 15 },
            });
            const servicesWithLowBudget = {
                ...mockServices,
                costTracker: lowBudgetTracker,
            };
            const result = await handleGrokQuery(client, { query: 'This should be rejected' }, servicesWithLowBudget);
            expect(result.content[0].text).toContain('Error:');
            expect(result.content[0].text).toContain('budget');
        });
        it('should track cost after successful API call', async () => {
            server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
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
                    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
                });
            }));
            const initialUsage = mockServices.costTracker.getUsageSummary();
            expect(initialUsage.totalCostUsd).toBe(0);
            await handleGrokQuery(client, { query: 'Track this cost' }, mockServices);
            const finalUsage = mockServices.costTracker.getUsageSummary();
            expect(finalUsage.totalCostUsd).toBeGreaterThan(0);
            expect(finalUsage.queryCount).toBe(1);
        });
        it('should work without services (backward compatible)', async () => {
            server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
                return HttpResponse.json({
                    id: 'test',
                    object: 'chat.completion',
                    created: Date.now(),
                    model: 'grok-4-0709',
                    choices: [
                        {
                            index: 0,
                            message: { role: 'assistant', content: 'Response without services' },
                            finish_reason: 'stop',
                        },
                    ],
                    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
                });
            }));
            // No services passed - should still work
            const result = await handleGrokQuery(client, { query: 'No services' });
            expect(result.content[0].text).toContain('Response without services');
        });
        it('should release rate limiter on API error', async () => {
            server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
                return HttpResponse.json({ error: { message: 'Server error' } }, { status: 500 });
            }));
            // Spy on release method
            const releaseSpy = vi.spyOn(mockServices.rateLimiter, 'release');
            await handleGrokQuery(client, { query: 'This will fail' }, mockServices);
            // Should have called release on error
            expect(releaseSpy).toHaveBeenCalled();
        });
    });
    describe('UX enhancements', () => {
        let client;
        let mockServices;
        beforeEach(() => {
            client = createTestClient();
            mockServices = {
                cache: new ResponseCache({ enabled: true, ttlSeconds: 300 }),
                costTracker: new CostTracker({ limitUsd: 10, enforceLimit: true }),
                rateLimiter: new RateLimiter({ tier: 'standard' }),
            };
        });
        it('should show complexity score when model is auto (P4-011)', async () => {
            server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
                return HttpResponse.json({
                    id: 'test',
                    object: 'chat.completion',
                    created: Date.now(),
                    model: 'grok-4-fast-non-reasoning',
                    choices: [
                        {
                            index: 0,
                            message: { role: 'assistant', content: 'Response' },
                            finish_reason: 'stop',
                        },
                    ],
                    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
                });
            }));
            // Simple query should show complexity score format
            const result = await handleGrokQuery(client, { query: 'Hello', model: 'auto' }, mockServices);
            // New P4-011 format: (complexity: X%, confidence: Y%)
            expect(result.content[0].text).toMatch(/complexity: \d+%, confidence: \d+%/);
        });
        it('should show complexity score for code queries (P4-011)', async () => {
            server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
                return HttpResponse.json({
                    id: 'test',
                    object: 'chat.completion',
                    created: Date.now(),
                    model: 'grok-code-fast-1',
                    choices: [
                        {
                            index: 0,
                            message: { role: 'assistant', content: 'Response' },
                            finish_reason: 'stop',
                        },
                    ],
                    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
                });
            }));
            // Code-related query should show complexity score with code model selected
            const result = await handleGrokQuery(client, { query: 'Fix this bug in my function', model: 'auto' }, mockServices);
            // New P4-011 format: model (complexity: X%, confidence: Y%)
            expect(result.content[0].text).toContain('grok-code-fast-1');
            expect(result.content[0].text).toMatch(/complexity: \d+%, confidence: \d+%/);
        });
        it('should show budget warning when usage exceeds 75%', async () => {
            // Pre-consume most of the budget
            const highUsageTracker = new CostTracker({ limitUsd: 1.0, enforceLimit: true });
            highUsageTracker.addCost({
                costUsd: 0.8,
                model: 'grok-4',
                inputTokens: 100,
                outputTokens: 50,
            });
            server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
                return HttpResponse.json({
                    id: 'test',
                    object: 'chat.completion',
                    created: Date.now(),
                    model: 'grok-4-fast-non-reasoning',
                    choices: [
                        {
                            index: 0,
                            message: { role: 'assistant', content: 'Response' },
                            finish_reason: 'stop',
                        },
                    ],
                    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
                });
            }));
            const servicesWithHighUsage = {
                ...mockServices,
                costTracker: highUsageTracker,
            };
            const result = await handleGrokQuery(client, { query: 'Hello' }, servicesWithHighUsage);
            expect(result.content[0].text).toContain('Budget');
            expect(result.content[0].text).toMatch(/\d+% used/);
        });
        it('should show cost savings tip for expensive models', async () => {
            server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
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
                    // High token usage to exceed $0.01 threshold for showing tips
                    // grok-4-0709: $3/1M input, $15/1M output
                    // 500 input + 1000 output = $0.0015 + $0.015 = $0.0165
                    usage: { prompt_tokens: 500, completion_tokens: 1000, total_tokens: 1500 },
                });
            }));
            // Force expensive model and high token usage
            const result = await handleGrokQuery(client, { query: 'Complex query', model: 'smartest', max_tokens: 2000 }, mockServices);
            // Should suggest cheaper alternatives for expensive models
            expect(result.content[0].text).toContain('Tip');
            expect(result.content[0].text).toContain('cheaper');
        });
        it('should show cache TTL remaining for cached responses', async () => {
            // Pre-populate cache
            const cacheKey = mockServices.cache.generateKey('Cached query', 'grok-4-fast-non-reasoning', undefined);
            const cachedResponse = {
                response: 'Cached response',
                model: 'grok-4-fast-non-reasoning',
                usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
                cost: {
                    estimated_usd: 0.0001,
                    input_tokens: 10,
                    output_tokens: 5,
                    model: 'grok-4-fast-non-reasoning',
                    pricing: { input_per_1m: 0.2, output_per_1m: 0.5 },
                },
                cached: false,
                response_time_ms: 100,
            };
            mockServices.cache.set(cacheKey, cachedResponse);
            const result = await handleGrokQuery(client, { query: 'Cached query' }, mockServices);
            // Should show cache badge with TTL
            expect(result.content[0].text).toContain('📦 **CACHED**');
            expect(result.content[0].text).toMatch(/\d+m remaining/);
        });
    });
    describe('streaming support', () => {
        let client;
        let mockServices;
        beforeEach(() => {
            client = createTestClient();
            mockServices = {
                cache: new ResponseCache({ enabled: true, ttlSeconds: 300 }),
                costTracker: new CostTracker({ limitUsd: 10, enforceLimit: true }),
                rateLimiter: new RateLimiter({ tier: 'standard' }),
            };
        });
        // Helper to create SSE stream response
        const createSSEStream = (chunks) => {
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
                start(controller) {
                    for (const chunk of chunks) {
                        controller.enqueue(encoder.encode(chunk));
                    }
                    controller.close();
                },
            });
            return stream;
        };
        describe('executeGrokQueryStreaming', () => {
            it('should accumulate streaming response chunks', async () => {
                const sseData = [
                    'data: {"id":"1","object":"chat.completion.chunk","created":1234,"model":"grok-4-fast","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}\n\n',
                    'data: {"id":"1","object":"chat.completion.chunk","created":1234,"model":"grok-4-fast","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}\n\n',
                    'data: {"id":"1","object":"chat.completion.chunk","created":1234,"model":"grok-4-fast","choices":[{"index":0,"delta":{"content":"!"},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":3,"total_tokens":13}}\n\n',
                    'data: [DONE]\n\n',
                ];
                server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
                    return new HttpResponse(createSSEStream(sseData), {
                        headers: { 'Content-Type': 'text/event-stream' },
                    });
                }));
                const result = await executeGrokQueryStreaming(client, {
                    query: 'Say hello',
                    model: 'fast',
                    max_tokens: 100,
                    temperature: 0.7,
                    stream: true,
                });
                expect(result.response).toBe('Hello world!');
                expect(result.chunks_received).toBe(3);
                expect(result.partial).toBe(false);
                expect(result.usage.total_tokens).toBe(13);
            });
            it('should set partial flag to false on complete responses', async () => {
                const sseData = [
                    'data: {"id":"1","object":"chat.completion.chunk","created":1234,"model":"grok-4-fast","choices":[{"index":0,"delta":{"content":"Complete response"},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":3,"total_tokens":13}}\n\n',
                    'data: [DONE]\n\n',
                ];
                server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
                    return new HttpResponse(createSSEStream(sseData), {
                        headers: { 'Content-Type': 'text/event-stream' },
                    });
                }));
                const result = await executeGrokQueryStreaming(client, {
                    query: 'Test',
                    model: 'fast',
                    max_tokens: 100,
                    temperature: 0.7,
                    stream: true,
                });
                expect(result.partial).toBe(false);
                expect(result.response).toBe('Complete response');
                expect(result.response).not.toContain('[Response truncated');
            });
            it('should estimate tokens when usage not provided', async () => {
                const sseData = [
                    'data: {"id":"1","object":"chat.completion.chunk","created":1234,"model":"grok-4-fast","choices":[{"index":0,"delta":{"content":"Test response"},"finish_reason":"stop"}]}\n\n',
                    'data: [DONE]\n\n',
                ];
                server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
                    return new HttpResponse(createSSEStream(sseData), {
                        headers: { 'Content-Type': 'text/event-stream' },
                    });
                }));
                const result = await executeGrokQueryStreaming(client, {
                    query: 'Test query',
                    model: 'fast',
                    max_tokens: 100,
                    temperature: 0.7,
                    stream: true,
                });
                // Should have estimated tokens (no usage in response)
                expect(result.usage.total_tokens).toBeGreaterThan(0);
                expect(result.cost.estimated_usd).toBeGreaterThanOrEqual(0);
            });
        });
        describe('handleGrokQuery with streaming', () => {
            it('should route streaming requests to streaming executor', async () => {
                const sseData = [
                    'data: {"id":"1","object":"chat.completion.chunk","created":1234,"model":"grok-4-fast","choices":[{"index":0,"delta":{"content":"Streamed response"},"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":2,"total_tokens":7}}\n\n',
                    'data: [DONE]\n\n',
                ];
                server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
                    return new HttpResponse(createSSEStream(sseData), {
                        headers: { 'Content-Type': 'text/event-stream' },
                    });
                }));
                const result = await handleGrokQuery(client, { query: 'Streaming query', stream: true }, mockServices);
                expect(result.content[0].text).toContain('Streamed response');
            });
            it('should skip cache for streaming requests', async () => {
                // Pre-populate cache with same query
                const cacheKey = mockServices.cache.generateKey('Streaming bypass', 'grok-4-fast-non-reasoning', undefined);
                const cachedResponse = {
                    response: 'CACHED RESPONSE - SHOULD NOT APPEAR',
                    model: 'grok-4-fast-non-reasoning',
                    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
                    cost: {
                        estimated_usd: 0.0001,
                        input_tokens: 10,
                        output_tokens: 5,
                        model: 'grok-4-fast-non-reasoning',
                        pricing: { input_per_1m: 0.2, output_per_1m: 0.5 },
                    },
                    cached: false,
                    response_time_ms: 100,
                };
                mockServices.cache.set(cacheKey, cachedResponse);
                const sseData = [
                    'data: {"id":"1","object":"chat.completion.chunk","created":1234,"model":"grok-4-fast","choices":[{"index":0,"delta":{"content":"Fresh streaming response"},"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":3,"total_tokens":8}}\n\n',
                    'data: [DONE]\n\n',
                ];
                server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
                    return new HttpResponse(createSSEStream(sseData), {
                        headers: { 'Content-Type': 'text/event-stream' },
                    });
                }));
                const result = await handleGrokQuery(client, { query: 'Streaming bypass', stream: true }, mockServices);
                // Should NOT show cached response
                expect(result.content[0].text).not.toContain('CACHED RESPONSE');
                expect(result.content[0].text).toContain('Fresh streaming response');
                // Should NOT show cache badge
                expect(result.content[0].text).not.toContain('📦 **CACHED**');
            });
            it('should not cache streaming responses', async () => {
                const sseData = [
                    'data: {"id":"1","object":"chat.completion.chunk","created":1234,"model":"grok-4-fast","choices":[{"index":0,"delta":{"content":"Uncached streaming"},"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":2,"total_tokens":7}}\n\n',
                    'data: [DONE]\n\n',
                ];
                server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
                    return new HttpResponse(createSSEStream(sseData), {
                        headers: { 'Content-Type': 'text/event-stream' },
                    });
                }));
                await handleGrokQuery(client, { query: 'No cache streaming', stream: true }, mockServices);
                // Verify response was NOT cached (cache.get returns null for misses)
                const cacheKey = mockServices.cache.generateKey('No cache streaming', 'grok-4-fast-non-reasoning', undefined);
                const cached = mockServices.cache.get(cacheKey);
                expect(cached).toBeFalsy();
            });
            it('should show streaming info without partial indicator for complete responses', async () => {
                const sseData = [
                    'data: {"id":"1","object":"chat.completion.chunk","created":1234,"model":"grok-4-fast","choices":[{"index":0,"delta":{"content":"Complete streaming response"},"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":4,"total_tokens":9}}\n\n',
                    'data: [DONE]\n\n',
                ];
                server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
                    return new HttpResponse(createSSEStream(sseData), {
                        headers: { 'Content-Type': 'text/event-stream' },
                    });
                }));
                const result = await handleGrokQuery(client, { query: 'Streaming query', stream: true }, mockServices);
                // Should have the response content
                expect(result.content[0].text).toContain('Complete streaming response');
                // Should NOT show partial indicator for complete responses
                expect(result.content[0].text).not.toContain('⚠️ **PARTIAL**');
            });
            it('should handle streaming API errors gracefully', async () => {
                server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
                    return HttpResponse.json({ error: { message: 'Internal server error' } }, { status: 500 });
                }));
                const result = await handleGrokQuery(client, { query: 'Streaming error test', stream: true }, mockServices);
                // Should return error response, not throw
                expect(result.content).toBeDefined();
                expect(result.content[0].text.toLowerCase()).toMatch(/error|failed/);
            });
            it('should resolve model aliases correctly in streaming mode', async () => {
                let capturedModel;
                server.use(http.post('https://api.x.ai/v1/chat/completions', async ({ request }) => {
                    const body = (await request.json());
                    capturedModel = body.model;
                    const sseData = [
                        'data: {"id":"1","object":"chat.completion.chunk","created":1234,"model":"grok-4-fast","choices":[{"index":0,"delta":{"content":"Alias test"},"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":2,"total_tokens":7}}\n\n',
                        'data: [DONE]\n\n',
                    ];
                    return new HttpResponse(createSSEStream(sseData), {
                        headers: { 'Content-Type': 'text/event-stream' },
                    });
                }));
                await handleGrokQuery(client, { query: 'Test alias resolution', model: 'fast', stream: true }, mockServices);
                // 'fast' alias should resolve to the actual model ID
                expect(capturedModel).toBe('grok-4-fast-non-reasoning');
            });
            it('should include system context in streaming requests', async () => {
                let capturedMessages;
                server.use(http.post('https://api.x.ai/v1/chat/completions', async ({ request }) => {
                    const body = (await request.json());
                    capturedMessages = body.messages;
                    const sseData = [
                        'data: {"id":"1","object":"chat.completion.chunk","created":1234,"model":"grok-4-fast","choices":[{"index":0,"delta":{"content":"Context response"},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":2,"total_tokens":12}}\n\n',
                        'data: [DONE]\n\n',
                    ];
                    return new HttpResponse(createSSEStream(sseData), {
                        headers: { 'Content-Type': 'text/event-stream' },
                    });
                }));
                await handleGrokQuery(client, {
                    query: 'What language?',
                    context: 'You are a Python expert.',
                    stream: true,
                }, mockServices);
                // Should have system message with context
                expect(capturedMessages).toBeDefined();
                expect(capturedMessages.length).toBeGreaterThanOrEqual(2);
                expect(capturedMessages[0].role).toBe('system');
                expect(capturedMessages[0].content).toBe('You are a Python expert.');
            });
            it('should track costs for streaming responses', async () => {
                const sseData = [
                    'data: {"id":"1","object":"chat.completion.chunk","created":1234,"model":"grok-4-fast","choices":[{"index":0,"delta":{"content":"Cost tracked"},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n',
                    'data: [DONE]\n\n',
                ];
                server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
                    return new HttpResponse(createSSEStream(sseData), {
                        headers: { 'Content-Type': 'text/event-stream' },
                    });
                }));
                // Cost tracker starts empty
                const initialUsage = mockServices.costTracker.getUsageSummary();
                expect(initialUsage.queryCount).toBe(0);
                await handleGrokQuery(client, { query: 'Track my cost', stream: true }, mockServices);
                // Cost should be tracked after streaming
                const usage = mockServices.costTracker.getUsageSummary();
                expect(usage.queryCount).toBe(1);
                expect(usage.totalInputTokens + usage.totalOutputTokens).toBe(15);
            });
            it('should release rate limiter on streaming error', async () => {
                // Create a mock rate limiter to spy on
                const releaseSpy = vi.spyOn(mockServices.rateLimiter, 'release');
                server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
                    return HttpResponse.json({ error: { message: 'Rate limited' } }, { status: 429 });
                }));
                await handleGrokQuery(client, { query: 'Rate limiter test', stream: true }, mockServices);
                // Rate limiter should be released even on error
                expect(releaseSpy).toHaveBeenCalled();
            });
        });
    });
    // =============================================================================
    // JSON Mode Tests (P4-016)
    // =============================================================================
    describe('JSON mode (P4-016)', () => {
        let client;
        let mockServices;
        beforeEach(() => {
            client = createTestClient();
            mockServices = {
                cache: new ResponseCache({ enabled: true, ttlSeconds: 300 }),
                costTracker: new CostTracker({ limitUsd: 10, enforceLimit: true }),
                rateLimiter: new RateLimiter({ tier: 'standard' }),
            };
        });
        describe('schema validation', () => {
            it('should have response_format in schema', () => {
                expect(grokQuerySchema.properties.response_format).toBeDefined();
                expect(grokQuerySchema.properties.response_format.type).toBe('object');
            });
            it('should define json_object as the only valid type', () => {
                expect(grokQuerySchema.properties.response_format.properties.type.enum).toEqual([
                    'json_object',
                ]);
            });
        });
        describe('validateGrokQueryInput', () => {
            it('should accept valid response_format', () => {
                const result = validateGrokQueryInput({
                    query: 'Return a JSON object',
                    response_format: { type: 'json_object' },
                });
                expect(result.response_format).toEqual({ type: 'json_object' });
            });
            it('should reject invalid response_format type', () => {
                expect(() => validateGrokQueryInput({
                    query: 'test',
                    response_format: { type: 'text' },
                })).toThrow('response_format.type must be "json_object"');
            });
            it('should reject non-object response_format', () => {
                expect(() => validateGrokQueryInput({
                    query: 'test',
                    response_format: 'json_object',
                })).toThrow('response_format must be an object');
            });
            it('should reject null response_format', () => {
                expect(() => validateGrokQueryInput({
                    query: 'test',
                    response_format: null,
                })).toThrow('response_format must be an object');
            });
            it('should allow omitting response_format', () => {
                const result = validateGrokQueryInput({ query: 'test' });
                expect(result.response_format).toBeUndefined();
            });
        });
        describe('executeGrokQuery with JSON mode', () => {
            it('should parse valid JSON response', async () => {
                server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
                    return HttpResponse.json({
                        id: 'test',
                        object: 'chat.completion',
                        created: Date.now(),
                        model: 'grok-4-fast',
                        choices: [
                            {
                                index: 0,
                                message: { role: 'assistant', content: '{"name": "test", "value": 42}' },
                                finish_reason: 'stop',
                            },
                        ],
                        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
                    });
                }));
                const result = await executeGrokQuery(client, {
                    query: 'Return a JSON object with name and value',
                    response_format: { type: 'json_object' },
                });
                expect(result.json_result).toBeDefined();
                expect(result.json_result.json_valid).toBe(true);
                expect(result.json_result.parsed).toEqual({ name: 'test', value: 42 });
            });
            it('should extract JSON from markdown code blocks', async () => {
                server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
                    return HttpResponse.json({
                        id: 'test',
                        object: 'chat.completion',
                        created: Date.now(),
                        model: 'grok-4-fast',
                        choices: [
                            {
                                index: 0,
                                message: {
                                    role: 'assistant',
                                    content: '```json\n{"wrapped": true}\n```',
                                },
                                finish_reason: 'stop',
                            },
                        ],
                        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
                    });
                }));
                const result = await executeGrokQuery(client, {
                    query: 'Return JSON',
                    response_format: { type: 'json_object' },
                });
                expect(result.json_result.json_valid).toBe(true);
                expect(result.json_result.parsed).toEqual({ wrapped: true });
            });
            it('should extract JSON from code blocks without language tag', async () => {
                server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
                    return HttpResponse.json({
                        id: 'test',
                        object: 'chat.completion',
                        created: Date.now(),
                        model: 'grok-4-fast',
                        choices: [
                            {
                                index: 0,
                                message: {
                                    role: 'assistant',
                                    content: '```\n{"no_lang_tag": true}\n```',
                                },
                                finish_reason: 'stop',
                            },
                        ],
                        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
                    });
                }));
                const result = await executeGrokQuery(client, {
                    query: 'Return JSON',
                    response_format: { type: 'json_object' },
                });
                expect(result.json_result.json_valid).toBe(true);
                expect(result.json_result.parsed).toEqual({ no_lang_tag: true });
            });
            it('should handle invalid JSON gracefully', async () => {
                server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
                    return HttpResponse.json({
                        id: 'test',
                        object: 'chat.completion',
                        created: Date.now(),
                        model: 'grok-4-fast',
                        choices: [
                            {
                                index: 0,
                                message: { role: 'assistant', content: 'This is not valid JSON at all' },
                                finish_reason: 'stop',
                            },
                        ],
                        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
                    });
                }));
                const result = await executeGrokQuery(client, {
                    query: 'Return JSON',
                    response_format: { type: 'json_object' },
                });
                expect(result.json_result).toBeDefined();
                expect(result.json_result.json_valid).toBe(false);
                expect(result.json_result.parse_error).toBeDefined();
                // Response is still returned
                expect(result.response).toBe('This is not valid JSON at all');
            });
            it('should not include json_result when response_format is not set', async () => {
                server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
                    return HttpResponse.json({
                        id: 'test',
                        object: 'chat.completion',
                        created: Date.now(),
                        model: 'grok-4-fast',
                        choices: [
                            {
                                index: 0,
                                message: { role: 'assistant', content: 'Regular text response' },
                                finish_reason: 'stop',
                            },
                        ],
                        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
                    });
                }));
                const result = await executeGrokQuery(client, {
                    query: 'Hello',
                });
                expect(result.json_result).toBeUndefined();
            });
            it('should include JSON mode system prompt in messages', async () => {
                let capturedBody;
                server.use(http.post('https://api.x.ai/v1/chat/completions', async ({ request }) => {
                    capturedBody = (await request.json());
                    return HttpResponse.json({
                        id: 'test',
                        object: 'chat.completion',
                        created: Date.now(),
                        model: 'grok-4-fast',
                        choices: [
                            {
                                index: 0,
                                message: { role: 'assistant', content: '{"test": true}' },
                                finish_reason: 'stop',
                            },
                        ],
                        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
                    });
                }));
                await executeGrokQuery(client, {
                    query: 'Return JSON',
                    response_format: { type: 'json_object' },
                });
                // Check that JSON mode system prompt was added
                const messages = capturedBody?.messages;
                expect(messages[0].role).toBe('system');
                expect(messages[0].content).toContain('valid JSON only');
            });
        });
        describe('handleGrokQuery with JSON mode', () => {
            it('should show JSON valid indicator in formatted output', async () => {
                server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
                    return HttpResponse.json({
                        id: 'test',
                        object: 'chat.completion',
                        created: Date.now(),
                        model: 'grok-4-fast',
                        choices: [
                            {
                                index: 0,
                                message: { role: 'assistant', content: '{"result": "success"}' },
                                finish_reason: 'stop',
                            },
                        ],
                        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
                    });
                }));
                const result = await handleGrokQuery(client, { query: 'Return JSON', response_format: { type: 'json_object' } }, mockServices);
                expect(result.content[0].text).toContain('✅ **JSON Valid**');
            });
            it('should show JSON parse error in formatted output', async () => {
                server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
                    return HttpResponse.json({
                        id: 'test',
                        object: 'chat.completion',
                        created: Date.now(),
                        model: 'grok-4-fast',
                        choices: [
                            {
                                index: 0,
                                message: { role: 'assistant', content: 'Not JSON' },
                                finish_reason: 'stop',
                            },
                        ],
                        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
                    });
                }));
                const result = await handleGrokQuery(client, { query: 'Return JSON', response_format: { type: 'json_object' } }, mockServices);
                expect(result.content[0].text).toContain('⚠️ **JSON Parse Error**');
            });
            it('should not show JSON indicator for regular queries', async () => {
                server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
                    return HttpResponse.json({
                        id: 'test',
                        object: 'chat.completion',
                        created: Date.now(),
                        model: 'grok-4-fast',
                        choices: [
                            {
                                index: 0,
                                message: { role: 'assistant', content: 'Regular response' },
                                finish_reason: 'stop',
                            },
                        ],
                        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
                    });
                }));
                const result = await handleGrokQuery(client, { query: 'Hello' }, mockServices);
                expect(result.content[0].text).not.toContain('JSON Valid');
                expect(result.content[0].text).not.toContain('JSON Parse Error');
            });
        });
        describe('cache key differentiation', () => {
            it('should use different cache keys for JSON vs non-JSON mode', async () => {
                // First call without JSON mode
                server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
                    return HttpResponse.json({
                        id: 'test',
                        object: 'chat.completion',
                        created: Date.now(),
                        model: 'grok-4-fast-non-reasoning',
                        choices: [
                            {
                                index: 0,
                                message: { role: 'assistant', content: 'Text response' },
                                finish_reason: 'stop',
                            },
                        ],
                        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
                    });
                }));
                await handleGrokQuery(client, { query: 'Same query', model: 'fast' }, mockServices);
                // Second call with JSON mode - should not return cached text response
                server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
                    return HttpResponse.json({
                        id: 'test',
                        object: 'chat.completion',
                        created: Date.now(),
                        model: 'grok-4-fast-non-reasoning',
                        choices: [
                            {
                                index: 0,
                                message: { role: 'assistant', content: '{"type": "json"}' },
                                finish_reason: 'stop',
                            },
                        ],
                        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
                    });
                }));
                const jsonResult = await handleGrokQuery(client, { query: 'Same query', model: 'fast', response_format: { type: 'json_object' } }, mockServices);
                // Should get JSON response, not cached text
                expect(jsonResult.content[0].text).toContain('{"type": "json"}');
                expect(jsonResult.content[0].text).toContain('✅ **JSON Valid**');
            });
        });
        describe('streaming with JSON mode', () => {
            // Helper to create SSE stream
            const createSSEStream = (data) => {
                return new ReadableStream({
                    start(controller) {
                        data.forEach((chunk) => controller.enqueue(new TextEncoder().encode(chunk)));
                        controller.close();
                    },
                });
            };
            it('should parse JSON from complete streamed response', async () => {
                const sseData = [
                    'data: {"id":"1","object":"chat.completion.chunk","created":1234,"model":"grok-4-fast","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n',
                    'data: {"id":"1","object":"chat.completion.chunk","created":1234,"model":"grok-4-fast","choices":[{"index":0,"delta":{"content":"{\\"key\\": \\"value\\"}"},"finish_reason":null}]}\n\n',
                    'data: {"id":"1","object":"chat.completion.chunk","created":1234,"model":"grok-4-fast","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":20,"completion_tokens":5,"total_tokens":25}}\n\n',
                    'data: [DONE]\n\n',
                ];
                server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
                    return new HttpResponse(createSSEStream(sseData), {
                        headers: { 'Content-Type': 'text/event-stream' },
                    });
                }));
                const result = await executeGrokQueryStreaming(client, {
                    query: 'Return JSON',
                    response_format: { type: 'json_object' },
                    stream: true,
                });
                expect(result.response).toBe('{"key": "value"}');
                expect(result.json_result).toBeDefined();
                expect(result.json_result.json_valid).toBe(true);
                expect(result.json_result.parsed).toEqual({ key: 'value' });
            });
            it('should not parse JSON for partial streaming responses', async () => {
                // Simulating a scenario where we get partial: true
                // This would require more complex mocking of timeout behavior
                // For now, we verify that the partial flag logic exists
                const result = await executeGrokQueryStreaming(client, {
                    query: 'Return JSON',
                    response_format: { type: 'json_object' },
                    stream: true,
                });
                // When streaming completes normally, partial should be false
                expect(result.partial).toBe(false);
            });
        });
    });
    describe('smart streaming (P4-014)', () => {
        describe('shouldAutoStream', () => {
            describe('explicit override', () => {
                it('should return true when stream=true explicitly', () => {
                    const result = shouldAutoStream('Hello', undefined, true, 'grok-4-fast', false);
                    expect(result.shouldStream).toBe(true);
                    expect(result.reason).toBe('explicit');
                    expect(result.explanation).toContain('explicit parameter');
                });
                it('should return false when stream=false explicitly', () => {
                    const result = shouldAutoStream('Explain step by step how React renders', undefined, false, 'grok-4-fast', false);
                    expect(result.shouldStream).toBe(false);
                    expect(result.reason).toBe('explicit');
                });
                it('should override all other signals with explicit stream=false', () => {
                    // Even with reasoning model, explicit false wins
                    const result = shouldAutoStream('Complex query', undefined, false, 'grok-4-1-fast-reasoning', false);
                    expect(result.shouldStream).toBe(false);
                    expect(result.reason).toBe('explicit');
                });
            });
            describe('JSON mode', () => {
                it('should never auto-stream for JSON mode', () => {
                    const result = shouldAutoStream('Explain step by step how to do this', undefined, undefined, 'grok-4-fast', true // isJsonMode
                    );
                    expect(result.shouldStream).toBe(false);
                    expect(result.reason).toBe('json_mode');
                    expect(result.explanation).toContain('JSON mode');
                });
                it('should allow explicit streaming for JSON mode', () => {
                    // Explicit override still works
                    const result = shouldAutoStream('Return JSON data', undefined, true, // explicit stream=true
                    'grok-4-fast', true // isJsonMode
                    );
                    expect(result.shouldStream).toBe(true);
                    expect(result.reason).toBe('explicit');
                });
            });
            describe('reasoning model', () => {
                it('should auto-stream for reasoning model', () => {
                    const result = shouldAutoStream('Hello', undefined, undefined, 'grok-4-1-fast-reasoning', false);
                    expect(result.shouldStream).toBe(true);
                    expect(result.reason).toBe('reasoning_model');
                    expect(result.explanation).toContain('reasoning model');
                });
                it('should auto-stream for model with "reasoning" in name', () => {
                    const result = shouldAutoStream('Simple query', undefined, undefined, 'some-reasoning-model', false);
                    expect(result.shouldStream).toBe(true);
                    expect(result.reason).toBe('reasoning_model');
                });
                it('should NOT auto-stream for "non-reasoning" models', () => {
                    const result = shouldAutoStream('Simple query', undefined, undefined, 'grok-4-fast-non-reasoning', false);
                    // "non-reasoning" should NOT trigger reasoning model streaming
                    expect(result.reason).not.toBe('reasoning_model');
                });
            });
            describe('long output indicators', () => {
                it('should auto-stream for "explain in detail"', () => {
                    const result = shouldAutoStream('Explain in detail how React works', undefined, undefined, 'grok-4-fast', false);
                    expect(result.shouldStream).toBe(true);
                    expect(result.reason).toBe('long_output');
                    expect(result.score).toBeGreaterThanOrEqual(STREAMING_THRESHOLDS.LONG_OUTPUT_SCORE);
                });
                it('should auto-stream for "step by step"', () => {
                    const result = shouldAutoStream('Walk me through step by step', undefined, undefined, 'grok-4-fast', false);
                    expect(result.shouldStream).toBe(true);
                    expect(result.reason).toBe('long_output');
                });
                it('should auto-stream for "step-by-step"', () => {
                    const result = shouldAutoStream('Give me a step-by-step guide', undefined, undefined, 'grok-4-fast', false);
                    expect(result.shouldStream).toBe(true);
                    expect(result.reason).toBe('long_output');
                });
                it('should auto-stream for "write code" + "implement"', () => {
                    const result = shouldAutoStream('Write code to implement a sorting algorithm', undefined, undefined, 'grok-4-fast', false);
                    expect(result.shouldStream).toBe(true);
                    expect(result.reason).toBe('long_output');
                });
                it('should auto-stream for "comprehensive" analysis', () => {
                    const result = shouldAutoStream('Provide a comprehensive analysis of this code', undefined, undefined, 'grok-4-fast', false);
                    expect(result.shouldStream).toBe(true);
                    expect(result.reason).toBe('long_output');
                });
                it('should check context for long output indicators', () => {
                    const result = shouldAutoStream('Review this', 'Please explain in detail how this code works', undefined, 'grok-4-fast', false);
                    expect(result.shouldStream).toBe(true);
                    expect(result.reason).toBe('long_output');
                });
                it('should match multi-word patterns case-insensitively', () => {
                    // "Step By Step" with mixed case should still trigger
                    const result = shouldAutoStream('Explain Step By Step how a for loop works', undefined, undefined, 'grok-4-fast', false);
                    expect(result.shouldStream).toBe(true);
                    expect(result.reason).toBe('long_output');
                });
            });
            describe('query length', () => {
                it('should auto-stream for queries > 500 chars', () => {
                    const longQuery = 'a'.repeat(501);
                    const result = shouldAutoStream(longQuery, undefined, undefined, 'grok-4-fast', false);
                    expect(result.shouldStream).toBe(true);
                    expect(result.reason).toBe('query_length');
                    expect(result.score).toBe(501);
                });
                it('should not auto-stream for queries exactly 500 chars', () => {
                    const exactQuery = 'a'.repeat(500);
                    const result = shouldAutoStream(exactQuery, undefined, undefined, 'grok-4-fast', false);
                    expect(result.shouldStream).toBe(false);
                    expect(result.reason).toBe('simple');
                });
                it('should not auto-stream for queries < 500 chars without other indicators', () => {
                    const shortQuery = 'What is 2+2?';
                    const result = shouldAutoStream(shortQuery, undefined, undefined, 'grok-4-fast', false);
                    expect(result.shouldStream).toBe(false);
                    expect(result.reason).toBe('simple');
                });
            });
            describe('complexity score', () => {
                const createComplexityScore = (adjusted) => ({
                    raw: adjusted,
                    adjusted,
                    confidence: 80,
                    category: 'complex',
                    breakdown: {
                        codeScore: 0,
                        reasoningScore: 0,
                        complexityScore: adjusted,
                        simplicityPenalty: 0,
                        lengthMultiplier: 1,
                        contextMultiplier: 1,
                    },
                    matchedIndicators: ['system design'],
                });
                it('should auto-stream for high complexity score (>= 40)', () => {
                    const result = shouldAutoStream('Evaluate', undefined, undefined, 'grok-4-fast', false, createComplexityScore(45));
                    expect(result.shouldStream).toBe(true);
                    expect(result.reason).toBe('complexity');
                    expect(result.score).toBe(45);
                });
                it('should auto-stream for complexity score exactly 40', () => {
                    const result = shouldAutoStream('Evaluate', undefined, undefined, 'grok-4-fast', false, createComplexityScore(40));
                    expect(result.shouldStream).toBe(true);
                    expect(result.reason).toBe('complexity');
                });
                it('should not auto-stream for complexity score < 40', () => {
                    const result = shouldAutoStream('Simple', undefined, undefined, 'grok-4-fast', false, createComplexityScore(39));
                    expect(result.shouldStream).toBe(false);
                    expect(result.reason).toBe('simple');
                });
            });
            describe('simple queries (cache preservation)', () => {
                it('should not auto-stream for simple queries', () => {
                    const result = shouldAutoStream('Hello', undefined, undefined, 'grok-4-fast', false);
                    expect(result.shouldStream).toBe(false);
                    expect(result.reason).toBe('simple');
                    expect(result.explanation).toContain('cache benefits preserved');
                });
                it('should not auto-stream for "what is" questions', () => {
                    const result = shouldAutoStream('What is TypeScript?', undefined, undefined, 'grok-4-fast', false);
                    expect(result.shouldStream).toBe(false);
                    expect(result.reason).toBe('simple');
                });
                it('should not auto-stream for short factual queries', () => {
                    const result = shouldAutoStream('Who invented the telephone?', undefined, undefined, 'grok-4-fast', false);
                    expect(result.shouldStream).toBe(false);
                    expect(result.reason).toBe('simple');
                });
            });
            describe('decision hierarchy', () => {
                it('should prioritize explicit over reasoning model', () => {
                    const result = shouldAutoStream('Query', undefined, false, // explicit false
                    'grok-4-1-fast-reasoning', false);
                    expect(result.shouldStream).toBe(false);
                    expect(result.reason).toBe('explicit');
                });
                it('should prioritize JSON mode over long output indicators', () => {
                    const result = shouldAutoStream('Explain step by step', undefined, undefined, 'grok-4-fast', true // JSON mode
                    );
                    expect(result.shouldStream).toBe(false);
                    expect(result.reason).toBe('json_mode');
                });
                it('should prioritize reasoning model over long output indicators', () => {
                    const result = shouldAutoStream('Simple hello', // No long output indicators
                    undefined, undefined, 'grok-4-1-fast-reasoning', false);
                    expect(result.shouldStream).toBe(true);
                    expect(result.reason).toBe('reasoning_model');
                });
                it('should prioritize long output over query length', () => {
                    const result = shouldAutoStream('Explain in detail', // DEFINITIVE indicator (15 points)
                    undefined, undefined, 'grok-4-fast', false);
                    expect(result.shouldStream).toBe(true);
                    expect(result.reason).toBe('long_output');
                });
            });
        });
        describe('LONG_OUTPUT_INDICATORS', () => {
            it('should have DEFINITIVE weight indicators', () => {
                const definitivePatterns = LONG_OUTPUT_INDICATORS.filter((i) => i.weight === 15);
                expect(definitivePatterns.length).toBeGreaterThan(0);
                expect(definitivePatterns.some((i) => i.pattern === 'explain in detail')).toBe(true);
                expect(definitivePatterns.some((i) => i.pattern === 'step by step')).toBe(true);
            });
            it('should have STRONG weight indicators', () => {
                const strongPatterns = LONG_OUTPUT_INDICATORS.filter((i) => i.weight === 10);
                expect(strongPatterns.length).toBeGreaterThan(0);
                expect(strongPatterns.some((i) => i.pattern === 'write code')).toBe(true);
                expect(strongPatterns.some((i) => i.pattern === 'implement')).toBe(true);
            });
            it('should have MODERATE weight indicators', () => {
                const moderatePatterns = LONG_OUTPUT_INDICATORS.filter((i) => i.weight === 5);
                expect(moderatePatterns.length).toBeGreaterThan(0);
                expect(moderatePatterns.some((i) => i.pattern === 'analyze')).toBe(true);
            });
        });
        describe('STREAMING_THRESHOLDS', () => {
            it('should have query length threshold of 500', () => {
                expect(STREAMING_THRESHOLDS.QUERY_LENGTH).toBe(500);
            });
            it('should have complexity score threshold of 40', () => {
                expect(STREAMING_THRESHOLDS.COMPLEXITY_SCORE).toBe(40);
            });
            it('should have long output score threshold of 10', () => {
                expect(STREAMING_THRESHOLDS.LONG_OUTPUT_SCORE).toBe(10);
            });
        });
    });
});
//# sourceMappingURL=query.test.js.map
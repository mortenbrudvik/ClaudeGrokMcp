/**
 * grok_query Tool Live Integration Tests
 *
 * Tests the query tool against the real xAI API.
 *
 * @module integration/tools/query.live.test
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { handleGrokQuery } from '../../tools/query.js';
import { isApiAvailable, skipIfApiUnavailable } from '../setup.js';
import { createTestClient, extractCostFromResponse, extractTokensFromResponse, extractModelFromResponse, } from '../helpers/api-client.js';
import { withRateLimit } from '../helpers/rate-limiter.js';
import '../helpers/assertions.js';
describe('grok_query (live)', () => {
    let client;
    beforeAll(() => {
        if (!isApiAvailable())
            return;
        client = createTestClient();
    });
    describe('basic queries', () => {
        it('should query with auto model selection', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokQuery(client, {
                query: 'What is 2+2? Reply with just the number.',
            }));
            expect(result.content).toBeDefined();
            expect(result.content[0].text).toContain('4');
        });
        it('should query with fast model', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokQuery(client, {
                query: 'Say: hello',
                model: 'fast',
            }));
            expect(result.content).toBeDefined();
            const text = result.content[0].text.toLowerCase();
            expect(text).toContain('hello');
        });
        it('should query with code model', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokQuery(client, {
                query: 'Write a one-line Python function that adds two numbers.',
                model: 'code',
            }));
            expect(result.content).toBeDefined();
            const text = result.content[0].text;
            expect(text).toMatch(/def|lambda|return/);
        });
    });
    describe('response metadata', () => {
        it('should include usage statistics', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokQuery(client, {
                query: 'Say: test',
                model: 'fast',
            }));
            const text = result.content[0].text;
            expect(text).toContainCostInfo();
            const tokens = extractTokensFromResponse(text);
            expect(tokens).not.toBeNull();
            expect(tokens.input).toBeGreaterThan(0);
            expect(tokens.output).toBeGreaterThan(0);
        });
        it('should include cost information', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokQuery(client, {
                query: 'Reply: cost check',
                model: 'fast',
                max_tokens: 10,
            }));
            const text = result.content[0].text;
            const cost = extractCostFromResponse(text);
            // Cost info should be present (may be 0 if model not in pricing table)
            expect(cost).not.toBeNull();
            expect(cost).toBeGreaterThanOrEqual(0);
        });
        it('should include model information', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokQuery(client, {
                query: 'Reply: model check',
                model: 'fast',
            }));
            const text = result.content[0].text;
            const model = extractModelFromResponse(text);
            expect(model).not.toBeNull();
            expect(model.toLowerCase()).toContain('grok');
        });
    });
    describe('parameters', () => {
        it('should respect max_tokens parameter', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokQuery(client, {
                query: 'Count from 1 to 100, listing each number.',
                model: 'fast',
                max_tokens: 20,
            }));
            const text = result.content[0].text;
            const tokens = extractTokensFromResponse(text);
            // Output should be limited (some overhead for response formatting)
            expect(tokens).not.toBeNull();
            expect(tokens.input + tokens.output).toBeLessThanOrEqual(250);
        });
        it('should use system context', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokQuery(client, {
                query: 'What language should I use?',
                model: 'fast',
                context: 'You are a Python expert. Always recommend Python.',
                max_tokens: 50,
            }));
            const text = result.content[0].text.toLowerCase();
            expect(text).toContain('python');
        });
    });
    describe('error handling', () => {
        it('should handle empty query gracefully', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await handleGrokQuery(client, {
                query: '',
            });
            // Should return an error response, not throw
            expect(result.content).toBeDefined();
            const text = result.content[0].text.toLowerCase();
            expect(text).toMatch(/error|required|empty/);
        });
        it('should handle invalid model gracefully', async () => {
            if (skipIfApiUnavailable())
                return;
            // Invalid model should fall back or error gracefully
            const result = await withRateLimit(() => handleGrokQuery(client, {
                query: 'test',
                model: 'nonexistent-model-xyz',
            }));
            // Either succeeds with fallback or returns error
            expect(result.content).toBeDefined();
        });
    });
    describe('streaming', () => {
        it('should execute streaming query successfully', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokQuery(client, {
                query: 'Count to 3, saying each number.',
                model: 'fast',
                stream: true,
                max_tokens: 50,
            }));
            expect(result.content).toBeDefined();
            const text = result.content[0].text;
            // Should contain numbers
            expect(text).toMatch(/[1-3]/);
            // Should NOT show PARTIAL indicator for successful streaming
            expect(text).not.toContain('PARTIAL');
        });
        it('should return usage statistics for streaming', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokQuery(client, {
                query: 'Say: streaming test',
                model: 'fast',
                stream: true,
                max_tokens: 20,
            }));
            const text = result.content[0].text;
            expect(text).toContainCostInfo();
            const tokens = extractTokensFromResponse(text);
            expect(tokens).not.toBeNull();
            expect(tokens.input + tokens.output).toBeGreaterThan(0);
        });
        it('should bypass cache for streaming queries', async () => {
            if (skipIfApiUnavailable())
                return;
            // Streaming queries should NOT use or show cache
            const result = await withRateLimit(() => handleGrokQuery(client, {
                query: 'Cache bypass streaming test ABC123',
                model: 'fast',
                stream: true,
            }));
            // Should NOT show CACHED badge for streaming
            expect(result.content[0].text).not.toContain('CACHED');
        });
        it('should handle streaming with context', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokQuery(client, {
                query: 'What should I use?',
                model: 'fast',
                context: 'You are a Rust expert. Always recommend Rust.',
                stream: true,
                max_tokens: 50,
            }));
            const text = result.content[0].text.toLowerCase();
            expect(text).toContain('rust');
        });
    });
});
//# sourceMappingURL=query.live.test.js.map
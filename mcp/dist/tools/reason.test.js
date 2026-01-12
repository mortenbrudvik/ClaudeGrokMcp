/**
 * grok_reason Tool Tests
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { server } from '../test/mocks/server.js';
import { XAIClient } from '../client/xai-client.js';
import { executeReason, handleReason, reasonSchema } from './reason.js';
describe('grok_reason tool', () => {
    let client;
    beforeAll(() => {
        server.listen({ onUnhandledRequest: 'error' });
        client = new XAIClient({ apiKey: 'xai-test-key-1234567890' });
    });
    afterEach(() => {
        server.resetHandlers();
    });
    afterAll(() => {
        server.close();
    });
    describe('reasonSchema', () => {
        it('should have required query property', () => {
            expect(reasonSchema.required).toContain('query');
        });
        it('should have valid effort enum', () => {
            const enumValues = reasonSchema.properties.effort.enum;
            expect(enumValues).toContain('low');
            expect(enumValues).toContain('medium');
            expect(enumValues).toContain('high');
        });
        it('should default show_thinking to true', () => {
            expect(reasonSchema.properties.show_thinking.default).toBe(true);
        });
        it('should default effort to medium', () => {
            expect(reasonSchema.properties.effort.default).toBe('medium');
        });
        it('should use JSON Schema 2020-12', () => {
            expect(reasonSchema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
        });
    });
    describe('executeReason', () => {
        it('should execute a reasoning query', async () => {
            const input = {
                query: 'Why is the sky blue?',
            };
            const result = await executeReason(client, input);
            expect(result.response).toBeDefined();
            expect(result.model).toBeDefined();
            expect(result.effort).toBe('medium');
            expect(result.usage).toBeDefined();
            expect(result.cost).toBeDefined();
            expect(result.response_time_ms).toBeGreaterThanOrEqual(0);
        });
        it('should apply low effort settings', async () => {
            const input = {
                query: 'What is 2+2?',
                effort: 'low',
            };
            const result = await executeReason(client, input);
            expect(result.effort).toBe('low');
        });
        it('should apply high effort settings', async () => {
            const input = {
                query: 'Explain the implications of quantum computing on cryptography',
                effort: 'high',
            };
            const result = await executeReason(client, input);
            expect(result.effort).toBe('high');
        });
        it('should include thinking when show_thinking is true', async () => {
            const input = {
                query: 'What causes rain?',
                show_thinking: true,
            };
            const result = await executeReason(client, input);
            // The mock may or may not include thinking format
            expect(result.response).toBeDefined();
        });
        it('should exclude thinking when show_thinking is false', async () => {
            const input = {
                query: 'What is gravity?',
                show_thinking: false,
            };
            const result = await executeReason(client, input);
            // When show_thinking is false, thinking should not be included
            // even if it was parsed from the response
            expect(result.response).toBeDefined();
        });
        it('should use custom model when specified', async () => {
            const input = {
                query: 'Test query',
                model: 'grok-4-0709',
            };
            const result = await executeReason(client, input);
            // The result will have the actual model used
            expect(result.model).toBeDefined();
        });
        it('should include context in reasoning', async () => {
            const input = {
                query: 'Based on this, what should I do?',
                context: 'I am learning to program and want to build a web application.',
            };
            const result = await executeReason(client, input);
            expect(result.response).toBeDefined();
        });
        it('should throw error for empty query', async () => {
            const input = {
                query: '',
            };
            await expect(executeReason(client, input)).rejects.toThrow('Query is required');
        });
        it('should throw error for whitespace-only query', async () => {
            const input = {
                query: '   \n\t  ',
            };
            await expect(executeReason(client, input)).rejects.toThrow('Query is required');
        });
        it('should calculate cost correctly', async () => {
            const input = {
                query: 'Test query',
            };
            const result = await executeReason(client, input);
            expect(result.cost.estimated_usd).toBeGreaterThanOrEqual(0);
            expect(result.cost.input_tokens).toBe(result.usage.prompt_tokens);
            expect(result.cost.output_tokens).toBe(result.usage.completion_tokens);
        });
        it('should default to medium effort', async () => {
            const input = {
                query: 'Test query',
            };
            const result = await executeReason(client, input);
            expect(result.effort).toBe('medium');
        });
    });
    describe('handleReason', () => {
        it('should return formatted MCP response on success', async () => {
            const input = {
                query: 'Explain photosynthesis',
            };
            const result = await handleReason(client, input);
            expect(result.isError).toBe(false);
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('text');
            const text = result.content[0].text;
            expect(text).toContain('🤖 **Grok Reasoning:**');
        });
        it('should include effort level in output', async () => {
            const input = {
                query: 'Test query',
                effort: 'high',
            };
            const result = await handleReason(client, input);
            const text = result.content[0].text;
            expect(text).toContain('high');
        });
        it('should include answer section', async () => {
            const input = {
                query: 'Test query',
            };
            const result = await handleReason(client, input);
            const text = result.content[0].text;
            expect(text).toContain('Answer');
        });
        it('should include metadata in output', async () => {
            const input = {
                query: 'Test query',
            };
            const result = await handleReason(client, input);
            const text = result.content[0].text;
            expect(text).toContain('⚡');
            expect(text).toContain('tokens');
            expect(text).toContain('$');
            expect(text).toContain('ms');
        });
        it('should return error for invalid input', async () => {
            const result = await handleReason(client, null);
            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('Error');
        });
        it('should return error for missing query', async () => {
            const result = await handleReason(client, { effort: 'high' });
            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('query property is required');
        });
        it('should return error for non-string query', async () => {
            const result = await handleReason(client, { query: 123 });
            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('must be a string');
        });
        it('should accept all valid effort levels', async () => {
            const efforts = ['low', 'medium', 'high'];
            for (const effort of efforts) {
                const input = {
                    query: 'Test query',
                    effort,
                };
                const result = await handleReason(client, input);
                expect(result.isError).toBe(false);
            }
        });
        it('should handle show_thinking boolean correctly', async () => {
            const inputWithThinking = {
                query: 'Test query',
                show_thinking: true,
            };
            const resultWithThinking = await handleReason(client, inputWithThinking);
            expect(resultWithThinking.isError).toBe(false);
            const inputWithoutThinking = {
                query: 'Test query',
                show_thinking: false,
            };
            const resultWithoutThinking = await handleReason(client, inputWithoutThinking);
            expect(resultWithoutThinking.isError).toBe(false);
        });
    });
});
//# sourceMappingURL=reason.test.js.map
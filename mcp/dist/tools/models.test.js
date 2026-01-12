/**
 * Tests for grok_models tool
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server.js';
import { XAIClient } from '../client/xai-client.js';
import { validateGrokModelsInput, executeGrokModels, handleGrokModels, grokModelsSchema, grokModelsToolDefinition, } from './models.js';
// Create a test client
const createTestClient = () => new XAIClient({
    apiKey: 'xai-test-api-key-12345678',
    baseUrl: 'https://api.x.ai/v1',
    timeout: 5000,
});
// Mock models response - matches actual xAI API model names
const mockModelsResponse = {
    object: 'list',
    data: [
        { id: 'grok-4-0709', object: 'model', created: 1704067200, owned_by: 'xai' },
        { id: 'grok-4-fast-non-reasoning', object: 'model', created: 1704067200, owned_by: 'xai' },
        { id: 'grok-code-fast-1', object: 'model', created: 1704067200, owned_by: 'xai' },
        { id: 'grok-4-1-fast-reasoning', object: 'model', created: 1704067200, owned_by: 'xai' },
        { id: 'grok-3', object: 'model', created: 1704067200, owned_by: 'xai' },
        { id: 'grok-2-vision-1212', object: 'model', created: 1704067200, owned_by: 'xai' },
    ],
};
describe('grok_models tool', () => {
    describe('grokModelsSchema', () => {
        it('should have correct JSON Schema version', () => {
            expect(grokModelsSchema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
        });
        it('should have refresh property with boolean type', () => {
            expect(grokModelsSchema.properties.refresh.type).toBe('boolean');
            expect(grokModelsSchema.properties.refresh.default).toBe(false);
        });
        it('should not require any fields', () => {
            expect(grokModelsSchema).not.toHaveProperty('required');
        });
        it('should not allow additional properties', () => {
            expect(grokModelsSchema.additionalProperties).toBe(false);
        });
    });
    describe('grokModelsToolDefinition', () => {
        it('should have correct tool name', () => {
            expect(grokModelsToolDefinition.name).toBe('grok_models');
        });
        it('should have description mentioning caching', () => {
            expect(grokModelsToolDefinition.description).toBeTruthy();
            expect(grokModelsToolDefinition.description).toContain('cache');
        });
        it('should include input schema', () => {
            expect(grokModelsToolDefinition.inputSchema).toBe(grokModelsSchema);
        });
    });
    describe('validateGrokModelsInput', () => {
        describe('valid inputs', () => {
            it('should accept null input', () => {
                const result = validateGrokModelsInput(null);
                expect(result.refresh).toBe(false);
            });
            it('should accept undefined input', () => {
                const result = validateGrokModelsInput(undefined);
                expect(result.refresh).toBe(false);
            });
            it('should accept empty object', () => {
                const result = validateGrokModelsInput({});
                expect(result.refresh).toBe(false);
            });
            it('should accept refresh: true', () => {
                const result = validateGrokModelsInput({ refresh: true });
                expect(result.refresh).toBe(true);
            });
            it('should accept refresh: false', () => {
                const result = validateGrokModelsInput({ refresh: false });
                expect(result.refresh).toBe(false);
            });
        });
        describe('invalid inputs', () => {
            it('should reject non-object input', () => {
                expect(() => validateGrokModelsInput('string')).toThrow('Input must be an object');
                expect(() => validateGrokModelsInput(123)).toThrow('Input must be an object');
            });
            it('should reject non-boolean refresh', () => {
                expect(() => validateGrokModelsInput({ refresh: 'true' })).toThrow('refresh must be a boolean');
                expect(() => validateGrokModelsInput({ refresh: 1 })).toThrow('refresh must be a boolean');
                expect(() => validateGrokModelsInput({ refresh: null })).toThrow('refresh must be a boolean');
            });
        });
    });
    describe('executeGrokModels', () => {
        let client;
        beforeEach(() => {
            client = createTestClient();
            // Reset to default handler
            server.use(http.get('https://api.x.ai/v1/models', () => {
                return HttpResponse.json(mockModelsResponse);
            }));
        });
        it('should return models list', async () => {
            const result = await executeGrokModels(client, { refresh: false });
            expect(result.models).toBeInstanceOf(Array);
            expect(result.models.length).toBeGreaterThan(0);
        });
        it('should include model details', async () => {
            const result = await executeGrokModels(client, { refresh: false });
            const grok4 = result.models.find((m) => m.id === 'grok-4-0709');
            expect(grok4).toBeDefined();
            expect(grok4.pricing.input_per_1m).toBe(3);
            expect(grok4.pricing.output_per_1m).toBe(15);
        });
        it('should include model aliases', async () => {
            const result = await executeGrokModels(client, { refresh: false });
            const grok4 = result.models.find((m) => m.id === 'grok-4-0709');
            expect(grok4?.alias).toBeDefined();
            // grok-4-0709 maps to multiple aliases, should find at least one
            expect(['auto', 'default', 'smartest']).toContain(grok4?.alias);
        });
        it('should include recommended models', async () => {
            const result = await executeGrokModels(client, { refresh: false });
            expect(result.recommended.general).toBe('grok-4-0709');
            expect(result.recommended.fast).toBe('grok-4-fast-non-reasoning');
            expect(result.recommended.code).toBe('grok-code-fast-1');
            expect(result.recommended.reasoning).toBe('grok-4-1-fast-reasoning');
        });
        it('should mark deprecated models correctly', async () => {
            const result = await executeGrokModels(client, { refresh: false });
            const visionModel = result.models.find((m) => m.id === 'grok-2-vision-1212');
            expect(visionModel?.status).toBe('deprecated');
        });
        it('should mark available models correctly', async () => {
            const result = await executeGrokModels(client, { refresh: false });
            const grok4 = result.models.find((m) => m.id === 'grok-4-0709');
            expect(grok4?.status).toBe('available');
        });
        it('should sort models by status and context window', async () => {
            const result = await executeGrokModels(client, { refresh: false });
            // Available models should come first
            const firstDeprecatedIndex = result.models.findIndex((m) => m.status === 'deprecated');
            const lastAvailableIndex = result.models.reduce((acc, m, i) => (m.status === 'available' ? i : acc), -1);
            if (firstDeprecatedIndex !== -1 && lastAvailableIndex !== -1) {
                expect(lastAvailableIndex).toBeLessThan(firstDeprecatedIndex);
            }
        });
        it('should include recommendations for models', async () => {
            const result = await executeGrokModels(client, { refresh: false });
            const grok4Fast = result.models.find((m) => m.id === 'grok-4-fast-non-reasoning');
            expect(grok4Fast?.recommended_for).toBeDefined();
            expect(grok4Fast?.recommended_for).toContain('quick queries');
        });
        it('should indicate cache status', async () => {
            // First call - not cached
            const result1 = await executeGrokModels(client, { refresh: true });
            expect(result1.cached).toBe(false);
            // Second call - cached
            const result2 = await executeGrokModels(client, { refresh: false });
            expect(result2.cached).toBe(true);
        });
        it('should force refresh when requested', async () => {
            let callCount = 0;
            server.use(http.get('https://api.x.ai/v1/models', () => {
                callCount++;
                return HttpResponse.json(mockModelsResponse);
            }));
            await executeGrokModels(client, { refresh: false });
            await executeGrokModels(client, { refresh: false });
            expect(callCount).toBe(1); // Cached
            await executeGrokModels(client, { refresh: true });
            expect(callCount).toBe(2); // Forced refresh
        });
        it('should handle unknown models gracefully', async () => {
            server.use(http.get('https://api.x.ai/v1/models', () => {
                return HttpResponse.json({
                    object: 'list',
                    data: [
                        { id: 'unknown-model-xyz', object: 'model', created: 1704067200, owned_by: 'xai' },
                    ],
                });
            }));
            const result = await executeGrokModels(client, { refresh: true });
            const unknownModel = result.models.find((m) => m.id === 'unknown-model-xyz');
            expect(unknownModel).toBeDefined();
            expect(unknownModel?.status).toBe('unknown');
            expect(unknownModel?.pricing.input_per_1m).toBe(0);
        });
    });
    describe('handleGrokModels', () => {
        let client;
        beforeEach(() => {
            client = createTestClient();
            server.use(http.get('https://api.x.ai/v1/models', () => {
                return HttpResponse.json(mockModelsResponse);
            }));
        });
        it('should return formatted MCP response', async () => {
            const result = await handleGrokModels(client, {});
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('text');
        });
        it('should include markdown table headers', async () => {
            const result = await handleGrokModels(client, {});
            const text = result.content[0].text;
            expect(text).toContain('🤖 **Grok Models:**');
            expect(text).toContain('| Model | Context | Pricing (per 1M) | Status |');
        });
        it('should include recommended models section', async () => {
            const result = await handleGrokModels(client, {});
            const text = result.content[0].text;
            expect(text).toContain('### Recommended');
            expect(text).toContain('**General**');
            expect(text).toContain('**Fast**');
            expect(text).toContain('**Code**');
            expect(text).toContain('**Reasoning**');
        });
        it('should include model aliases section', async () => {
            const result = await handleGrokModels(client, {});
            const text = result.content[0].text;
            expect(text).toContain('### Aliases');
            expect(text).toContain('| Alias | Resolves To |');
            expect(text).toContain('| auto |');
            expect(text).toContain('| fast |');
        });
        it('should show cache status', async () => {
            const result = await handleGrokModels(client, { refresh: true });
            const text = result.content[0].text;
            expect(text).toContain('⚡');
            expect(text).toMatch(/live|cached/);
        });
        it('should format context windows correctly', async () => {
            const result = await handleGrokModels(client, {});
            const text = result.content[0].text;
            // grok-4.1-fast has 2M context
            expect(text).toContain('2.0M');
            // grok-4 has 256K context
            expect(text).toContain('256K');
        });
        it('should format pricing correctly', async () => {
            const result = await handleGrokModels(client, {});
            const text = result.content[0].text;
            expect(text).toContain('$3/$15'); // grok-4 pricing
            expect(text).toContain('$0.2/$0.5'); // grok-4-fast pricing
        });
        it('should show status indicators', async () => {
            const result = await handleGrokModels(client, {});
            const text = result.content[0].text;
            expect(text).toContain('✓'); // Available
            expect(text).toContain('⚠️'); // Deprecated (grok-2-vision-1212)
        });
        it('should handle API errors gracefully', async () => {
            server.use(http.get('https://api.x.ai/v1/models', () => {
                return HttpResponse.json({ error: { message: 'Server error' } }, { status: 500 });
            }));
            const result = await handleGrokModels(client, { refresh: true });
            expect(result.content[0].text).toContain('Error:');
        });
        it('should handle invalid input gracefully', async () => {
            const result = await handleGrokModels(client, { refresh: 'invalid' });
            expect(result.content[0].text).toContain('Error:');
            expect(result.content[0].text).toContain('refresh must be a boolean');
        });
        it('should accept null input', async () => {
            const result = await handleGrokModels(client, null);
            expect(result.content[0].text).toContain('🤖 **Grok Models:**');
        });
        it('should accept undefined input', async () => {
            const result = await handleGrokModels(client, undefined);
            expect(result.content[0].text).toContain('🤖 **Grok Models:**');
        });
    });
});
//# sourceMappingURL=models.test.js.map
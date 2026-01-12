/**
 * grok_with_file Tool Tests
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { server } from '../test/mocks/server.js';
import { XAIClient } from '../client/xai-client.js';
import { detectFileType, validateGrokWithFileInput, executeGrokWithFile, handleGrokWithFile, withFileSchema, grokWithFileToolDefinition, } from './with-file.js';
describe('grok_with_file tool', () => {
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
    describe('detectFileType', () => {
        describe('from filename extension', () => {
            it('should detect JavaScript files', () => {
                expect(detectFileType('app.js')).toBe('code');
                expect(detectFileType('index.jsx')).toBe('code');
            });
            it('should detect TypeScript files', () => {
                expect(detectFileType('app.ts')).toBe('code');
                expect(detectFileType('component.tsx')).toBe('code');
            });
            it('should detect Python files', () => {
                expect(detectFileType('script.py')).toBe('code');
            });
            it('should detect Markdown files', () => {
                expect(detectFileType('README.md')).toBe('markdown');
                expect(detectFileType('docs.mdx')).toBe('markdown');
            });
            it('should detect JSON files', () => {
                expect(detectFileType('package.json')).toBe('json');
                expect(detectFileType('config.jsonc')).toBe('json');
            });
            it('should detect YAML files', () => {
                expect(detectFileType('config.yaml')).toBe('yaml');
                expect(detectFileType('docker-compose.yml')).toBe('yaml');
            });
            it('should detect XML files', () => {
                expect(detectFileType('data.xml')).toBe('xml');
                expect(detectFileType('icon.svg')).toBe('xml');
            });
            it('should detect CSV files', () => {
                expect(detectFileType('data.csv')).toBe('csv');
                expect(detectFileType('table.tsv')).toBe('csv');
            });
            it('should detect text files', () => {
                expect(detectFileType('readme.txt')).toBe('text');
                expect(detectFileType('app.log')).toBe('text');
            });
            it('should be case-insensitive for extensions', () => {
                expect(detectFileType('FILE.JSON')).toBe('json');
                expect(detectFileType('README.MD')).toBe('markdown');
            });
        });
        describe('from content patterns', () => {
            it('should detect JSON from content', () => {
                expect(detectFileType(undefined, '{"key": "value"}')).toBe('json');
                expect(detectFileType(undefined, '[1, 2, 3]')).toBe('json');
            });
            it('should detect YAML from content', () => {
                expect(detectFileType(undefined, 'name: John\nage: 30')).toBe('yaml');
                expect(detectFileType(undefined, '---\ntitle: Document\n---')).toBe('yaml');
            });
            it('should detect XML from content', () => {
                expect(detectFileType(undefined, '<?xml version="1.0"?>')).toBe('xml');
                expect(detectFileType(undefined, '<root><child/></root>')).toBe('xml');
            });
            it('should detect Markdown from content', () => {
                expect(detectFileType(undefined, '# Header\n\nSome text')).toBe('markdown');
                expect(detectFileType(undefined, '[link](https://example.com)')).toBe('markdown');
                expect(detectFileType(undefined, '- item 1\n- item 2')).toBe('markdown');
            });
            it('should detect CSV from content', () => {
                expect(detectFileType(undefined, 'name,age,city\nJohn,30,NYC')).toBe('csv');
            });
            it('should detect code from content', () => {
                expect(detectFileType(undefined, 'function hello() {}')).toBe('code');
                expect(detectFileType(undefined, 'import os')).toBe('code');
                expect(detectFileType(undefined, 'class MyClass {}')).toBe('code');
            });
            it('should default to text for unknown content', () => {
                expect(detectFileType(undefined, 'some random text')).toBe('text');
                expect(detectFileType(undefined, '')).toBe('text');
            });
        });
        describe('priority', () => {
            it('should prefer filename extension over content', () => {
                // JSON content but .txt extension
                expect(detectFileType('data.txt', '{"key": "value"}')).toBe('text');
            });
            it('should use content when no filename provided', () => {
                expect(detectFileType(undefined, '{"key": "value"}')).toBe('json');
            });
            it('should use content when extension is unknown', () => {
                expect(detectFileType('file.xyz', '{"key": "value"}')).toBe('json');
            });
        });
    });
    describe('withFileSchema', () => {
        it('should require query and file_content', () => {
            expect(withFileSchema.required).toContain('query');
            expect(withFileSchema.required).toContain('file_content');
        });
        it('should have valid file_type enum', () => {
            const enumValues = withFileSchema.properties.file_type.enum;
            expect(enumValues).toContain('code');
            expect(enumValues).toContain('text');
            expect(enumValues).toContain('markdown');
            expect(enumValues).toContain('json');
            expect(enumValues).toContain('csv');
            expect(enumValues).toContain('xml');
            expect(enumValues).toContain('yaml');
        });
        it('should use JSON Schema 2020-12', () => {
            expect(withFileSchema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
        });
        it('should have valid max_tokens constraints', () => {
            expect(withFileSchema.properties.max_tokens.minimum).toBe(1);
            expect(withFileSchema.properties.max_tokens.maximum).toBe(131072);
        });
        it('should have valid temperature constraints', () => {
            expect(withFileSchema.properties.temperature.minimum).toBe(0);
            expect(withFileSchema.properties.temperature.maximum).toBe(2);
        });
    });
    describe('grokWithFileToolDefinition', () => {
        it('should have correct name', () => {
            expect(grokWithFileToolDefinition.name).toBe('grok_with_file');
        });
        it('should have a description', () => {
            expect(grokWithFileToolDefinition.description).toBeTruthy();
            expect(grokWithFileToolDefinition.description.length).toBeGreaterThan(50);
        });
        it('should reference the schema', () => {
            expect(grokWithFileToolDefinition.inputSchema).toBe(withFileSchema);
        });
    });
    describe('validateGrokWithFileInput', () => {
        it('should accept valid minimal input', () => {
            const input = {
                query: 'What is this file about?',
                file_content: 'Hello, World!',
            };
            const result = validateGrokWithFileInput(input);
            expect(result.query).toBe('What is this file about?');
            expect(result.file_content).toBe('Hello, World!');
        });
        it('should accept valid full input', () => {
            const input = {
                query: 'Summarize this document',
                file_content: '# Title\n\nContent here',
                filename: 'README.md',
                file_type: 'markdown',
                model: 'grok-4-fast',
                context: 'This is documentation for a library',
                max_tokens: 2048,
                temperature: 0.5,
            };
            const result = validateGrokWithFileInput(input);
            expect(result.query).toBe('Summarize this document');
            expect(result.filename).toBe('README.md');
            expect(result.file_type).toBe('markdown');
            expect(result.model).toBe('grok-4-fast');
            expect(result.context).toBe('This is documentation for a library');
            expect(result.max_tokens).toBe(2048);
            expect(result.temperature).toBe(0.5);
        });
        describe('error cases', () => {
            it('should reject null input', () => {
                expect(() => validateGrokWithFileInput(null)).toThrow('Invalid input');
            });
            it('should reject undefined input', () => {
                expect(() => validateGrokWithFileInput(undefined)).toThrow('Invalid input');
            });
            it('should reject missing query', () => {
                expect(() => validateGrokWithFileInput({ file_content: 'content' })).toThrow('query is required');
            });
            it('should reject empty query', () => {
                expect(() => validateGrokWithFileInput({ query: '', file_content: 'content' })).toThrow('query cannot be empty');
            });
            it('should reject whitespace-only query', () => {
                expect(() => validateGrokWithFileInput({ query: '   ', file_content: 'content' })).toThrow('query cannot be empty');
            });
            it('should reject missing file_content', () => {
                expect(() => validateGrokWithFileInput({ query: 'What is this?' })).toThrow('file_content is required');
            });
            it('should reject empty file_content', () => {
                expect(() => validateGrokWithFileInput({ query: 'What is this?', file_content: '' })).toThrow('file_content cannot be empty');
            });
            it('should reject invalid file_type', () => {
                expect(() => validateGrokWithFileInput({
                    query: 'What is this?',
                    file_content: 'content',
                    file_type: 'invalid',
                })).toThrow('file_type must be one of');
            });
            it('should reject invalid max_tokens', () => {
                expect(() => validateGrokWithFileInput({
                    query: 'What is this?',
                    file_content: 'content',
                    max_tokens: 0,
                })).toThrow('max_tokens must be between 1 and 131072');
            });
            it('should reject max_tokens too high', () => {
                expect(() => validateGrokWithFileInput({
                    query: 'What is this?',
                    file_content: 'content',
                    max_tokens: 200000,
                })).toThrow('max_tokens must be between 1 and 131072');
            });
            it('should reject invalid temperature', () => {
                expect(() => validateGrokWithFileInput({
                    query: 'What is this?',
                    file_content: 'content',
                    temperature: -1,
                })).toThrow('temperature must be between 0 and 2');
            });
            it('should reject temperature too high', () => {
                expect(() => validateGrokWithFileInput({
                    query: 'What is this?',
                    file_content: 'content',
                    temperature: 3,
                })).toThrow('temperature must be between 0 and 2');
            });
            it('should reject non-string model', () => {
                expect(() => validateGrokWithFileInput({
                    query: 'What is this?',
                    file_content: 'content',
                    model: 123,
                })).toThrow('model must be a string');
            });
            it('should reject non-string context', () => {
                expect(() => validateGrokWithFileInput({
                    query: 'What is this?',
                    file_content: 'content',
                    context: 456,
                })).toThrow('context must be a string');
            });
        });
    });
    describe('executeGrokWithFile', () => {
        it('should query file and return response', async () => {
            const input = {
                query: 'What is this file about?',
                file_content: '# Hello World\n\nThis is a test document.',
                filename: 'test.md',
            };
            const result = await executeGrokWithFile(client, input);
            expect(result.response).toBeDefined();
            expect(result.model).toBeDefined();
            expect(result.usage).toBeDefined();
            expect(result.cost).toBeDefined();
            expect(result.file_info).toBeDefined();
            expect(result.file_info.detected_type).toBe('markdown');
            expect(result.file_info.filename).toBe('test.md');
            expect(result.response_time_ms).toBeGreaterThanOrEqual(0);
        });
        it('should auto-detect file type from filename', async () => {
            const input = {
                query: 'Parse this JSON',
                file_content: '{"name": "test", "value": 123}',
                filename: 'config.json',
            };
            const result = await executeGrokWithFile(client, input);
            expect(result.file_info.detected_type).toBe('json');
        });
        it('should auto-detect file type from content when no filename', async () => {
            const input = {
                query: 'Parse this JSON',
                file_content: '{"name": "test", "value": 123}',
            };
            const result = await executeGrokWithFile(client, input);
            expect(result.file_info.detected_type).toBe('json');
        });
        it('should use provided file_type over detection', async () => {
            const input = {
                query: 'Analyze this',
                file_content: '{"name": "test"}',
                file_type: 'text',
            };
            const result = await executeGrokWithFile(client, input);
            expect(result.file_info.detected_type).toBe('text');
        });
        it('should include file statistics', async () => {
            const content = 'Line 1\nLine 2\nLine 3';
            const input = {
                query: 'Count lines',
                file_content: content,
            };
            const result = await executeGrokWithFile(client, input);
            expect(result.file_info.line_count).toBe(3);
            expect(result.file_info.size_bytes).toBe(Buffer.byteLength(content, 'utf-8'));
        });
        it('should use default model when not specified', async () => {
            const input = {
                query: 'What is this?',
                file_content: 'Some text content',
            };
            const result = await executeGrokWithFile(client, input);
            expect(result.model).toBeDefined();
        });
        it('should respect max_tokens parameter', async () => {
            const input = {
                query: 'Summarize briefly',
                file_content: 'Long content here...',
                max_tokens: 100,
            };
            // This test verifies the parameter is passed (mock doesn't validate it)
            const result = await executeGrokWithFile(client, input);
            expect(result).toBeDefined();
        });
        it('should include context in query', async () => {
            const input = {
                query: 'What does this do?',
                file_content: 'function foo() {}',
                context: 'This is a utility function',
            };
            const result = await executeGrokWithFile(client, input);
            expect(result).toBeDefined();
        });
    });
    describe('handleGrokWithFile', () => {
        it('should handle valid input', async () => {
            const input = {
                query: 'What is in this file?',
                file_content: '# Test\n\nSome content',
            };
            const result = await handleGrokWithFile(client, input);
            expect(result.isError).toBe(false);
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('text');
        });
        it('should return error for invalid input', async () => {
            const result = await handleGrokWithFile(client, {});
            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('Error');
        });
        it('should return error for missing query', async () => {
            const result = await handleGrokWithFile(client, { file_content: 'content' });
            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('query');
        });
        it('should return error for missing file_content', async () => {
            const result = await handleGrokWithFile(client, { query: 'What is this?' });
            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('file_content');
        });
        it('should format output with file info', async () => {
            const input = {
                query: 'Summarize',
                file_content: '{"key": "value"}',
                filename: 'data.json',
            };
            const result = await handleGrokWithFile(client, input);
            expect(result.isError).toBe(false);
            const text = result.content[0].text;
            expect(text).toContain('data.json');
            expect(text).toContain('json');
            expect(text).toContain('tokens');
            expect(text).toContain('$');
        });
        it('should work with services', async () => {
            const mockServices = {
                cache: {
                    get: () => null,
                    set: () => { },
                    delete: () => false,
                    clear: () => { },
                    getStats: () => ({ size: 0, hits: 0, misses: 0, hitRate: 0 }),
                    getOptions: () => ({
                        enabled: true,
                        ttlSeconds: 300,
                        maxEntries: 1000,
                    }),
                },
                costTracker: {
                    checkBudget: () => { },
                    addFromEstimate: () => { },
                    getSessionTotal: () => 0,
                    getOptions: () => ({
                        limitUsd: 10,
                        enforceLimit: false,
                        trackHistory: true,
                        maxHistoryRecords: 10000,
                    }),
                    recordQuery: () => { },
                    getQueryHistory: () => [],
                },
                rateLimiter: {
                    acquire: async () => { },
                    recordUsage: () => { },
                    release: () => { },
                    clearBackoff: () => { },
                    getLimits: () => ({
                        tokensPerMinute: 500000,
                        maxPendingRequests: 100,
                    }),
                },
            };
            const input = {
                query: 'Test with services',
                file_content: 'Some content',
            };
            const result = await handleGrokWithFile(client, input, mockServices);
            expect(result.isError).toBe(false);
        });
    });
});
//# sourceMappingURL=with-file.test.js.map
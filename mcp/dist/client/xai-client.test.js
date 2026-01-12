/**
 * Tests for xAI Client
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server.js';
import { XAIClient, createClient, getModelTimeout, DEFAULT_TIMEOUT, SLOW_MODEL_TIMEOUT, } from './xai-client.js';
import { XAIError, MODEL_ALIASES, MODEL_FALLBACKS, MODEL_PRICING } from '../types/index.js';
describe('XAIClient', () => {
    describe('constructor', () => {
        it('should create client with API key', () => {
            const client = new XAIClient({ apiKey: 'xai-test-key-1234567890' });
            expect(client).toBeDefined();
        });
        it('should throw error without API key', () => {
            expect(() => new XAIClient({ apiKey: '' })).toThrow('XAI_API_KEY is required');
        });
        it('should throw error for invalid API key prefix', () => {
            expect(() => new XAIClient({ apiKey: 'sk-invalid-key-format-1234' })).toThrow('XAI_API_KEY must start with "xai-" prefix');
            expect(() => new XAIClient({ apiKey: 'invalid-key-1234567890' })).toThrow('XAI_API_KEY must start with "xai-" prefix');
        });
        it('should throw error for too short API key', () => {
            expect(() => new XAIClient({ apiKey: 'xai-short' })).toThrow('XAI_API_KEY appears to be invalid (too short)');
        });
        it('should accept custom baseUrl', () => {
            const client = new XAIClient({
                apiKey: 'xai-test-key-1234567890',
                baseUrl: 'https://custom.api.com',
            });
            expect(client).toBeDefined();
        });
        it('should accept custom timeout', () => {
            const client = new XAIClient({
                apiKey: 'xai-test-key-1234567890',
                timeout: 60000,
            });
            expect(client).toBeDefined();
        });
    });
    describe('resolveModel', () => {
        let client;
        beforeEach(() => {
            client = new XAIClient({ apiKey: 'xai-test-key-1234567890' });
        });
        it('should resolve model aliases (without query)', () => {
            // Without query parameter, 'auto' uses static alias
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
        it('should use intelligent selection for auto with query', () => {
            // Simple query -> fast model
            expect(client.resolveModel('auto', 'What is the weather?')).toBe('grok-4-fast-non-reasoning');
            // Code query -> code model
            expect(client.resolveModel('auto', 'Fix this bug in my function')).toBe('grok-code-fast-1');
            // Reasoning query -> reasoning model
            expect(client.resolveModel('auto', 'Step by step explain how')).toBe('grok-4-1-fast-reasoning');
            // Short complexity queries get fast model (length multiplier 0.7 reduces score)
            expect(client.resolveModel('auto', 'Analyze the architecture')).toBe('grok-4-fast-non-reasoning');
            // Very complex query with multiple DEFINITIVE indicators -> flagship
            expect(client.resolveModel('auto', 'Analyze the system design architecture and evaluate design patterns for scalability tradeoffs')).toBe('grok-4-0709');
        });
        it('should not use intelligent selection for non-auto aliases', () => {
            // Other aliases should always resolve to their static mapping
            expect(client.resolveModel('fast', 'Fix this bug')).toBe(MODEL_ALIASES.fast);
            expect(client.resolveModel('smartest', 'Hello')).toBe(MODEL_ALIASES.smartest);
        });
    });
    describe('selectAutoModel', () => {
        let client;
        beforeEach(() => {
            client = new XAIClient({ apiKey: 'xai-test-key-1234567890' });
        });
        describe('code detection', () => {
            it('should detect code keywords', () => {
                const result = client.selectAutoModel('Fix this bug in my code');
                expect(result.model).toBe('grok-code-fast-1');
                expect(result.reason).toBe('code');
                expect(result.matchedIndicators).toContain('bug');
            });
            it('should detect programming languages', () => {
                expect(client.selectAutoModel('Write typescript function').model).toBe('grok-code-fast-1');
                expect(client.selectAutoModel('Help me with python').model).toBe('grok-code-fast-1');
                expect(client.selectAutoModel('Rust memory management').model).toBe('grok-code-fast-1');
            });
            it('should detect code blocks in context', () => {
                const result = client.selectAutoModel('Review this', '```js\nconst x = 1;\n```');
                expect(result.model).toBe('grok-code-fast-1');
                expect(result.reason).toBe('code');
                expect(result.matchedIndicators).toContain('[code block detected]');
            });
            it('should detect function/class patterns in context', () => {
                const result = client.selectAutoModel('What does this do?', 'function myFunc() {}');
                expect(result.model).toBe('grok-code-fast-1');
                expect(result.matchedIndicators).toContain('[code block detected]');
            });
            it('should detect frameworks', () => {
                expect(client.selectAutoModel('Help with react hooks').model).toBe('grok-code-fast-1');
                expect(client.selectAutoModel('Django models issue').model).toBe('grok-code-fast-1');
                expect(client.selectAutoModel('Express middleware').model).toBe('grok-code-fast-1');
            });
        });
        describe('reasoning detection', () => {
            it('should detect step-by-step requests', () => {
                const result = client.selectAutoModel('Walk me through this problem step by step');
                expect(result.model).toBe('grok-4-1-fast-reasoning');
                expect(result.reason).toBe('reasoning');
                expect(result.matchedIndicators).toContain('step by step');
            });
            it('should detect logical reasoning keywords', () => {
                expect(client.selectAutoModel('Prove this theorem').model).toBe('grok-4-1-fast-reasoning');
                expect(client.selectAutoModel('Derive the formula').model).toBe('grok-4-1-fast-reasoning');
                expect(client.selectAutoModel('Why does this happen?').model).toBe('grok-4-1-fast-reasoning');
            });
            it('should detect math/calculation requests', () => {
                expect(client.selectAutoModel('Calculate the result').model).toBe('grok-4-1-fast-reasoning');
                expect(client.selectAutoModel('Solve this equation').model).toBe('grok-4-1-fast-reasoning');
            });
        });
        describe('complexity detection', () => {
            it('should detect analysis requests', () => {
                const result = client.selectAutoModel('Analyze the tradeoffs');
                // With weighted scoring: analyze (5) + tradeoffs (10) = 15
                // Score is 15, but model selection uses confidence-based routing
                expect(result.reason).toBe('complex');
                expect(result.matchedIndicators).toContain('analyze');
                expect(result.matchedIndicators).toContain('tradeoffs');
            });
            it('should detect architecture requests', () => {
                // Query must be >5 words to avoid 0.7 length penalty
                // system design (15) + evaluate (5) = 20, with 1.0 multiplier = 20 adjusted
                // 20 < 25 threshold, so still fast for moderate complexity
                const result1 = client.selectAutoModel('Evaluate the system design for our application');
                expect(result1.reason).toBe('complex');
                expect(result1.model).toBe('grok-4-fast-non-reasoning'); // 20 < 25 threshold
                // best practice (10) + scalability (10) = 20, with 1.0 multiplier
                expect(client.selectAutoModel('Best practice for scalability optimization approach').reason).toBe('complex');
            });
            it('should detect high-complexity requests with flagship model', () => {
                // Need multiple strong indicators to get flagship model
                // design pattern (15) + system design (15) = 30+
                const result = client.selectAutoModel('Design pattern for system design architecture');
                expect(result.reason).toBe('complex');
                expect(result.model).toBe('grok-4-0709');
            });
        });
        describe('simple queries (default)', () => {
            it('should default to fast model for simple queries', () => {
                const result = client.selectAutoModel('Hello');
                expect(result.model).toBe('grok-4-fast-non-reasoning');
                expect(result.reason).toBe('simple');
                expect(result.matchedIndicators).toHaveLength(0);
            });
            it('should use fast for general questions', () => {
                expect(client.selectAutoModel('What time is it?').model).toBe('grok-4-fast-non-reasoning');
                expect(client.selectAutoModel('Tell me a joke').model).toBe('grok-4-fast-non-reasoning');
                expect(client.selectAutoModel('Who is the president?').model).toBe('grok-4-fast-non-reasoning');
            });
        });
        describe('weighted scoring behavior (P4-011)', () => {
            it('should select based on highest weighted score', () => {
                // "step by step" (15 DEFINITIVE reasoning) > "function" (10 STRONG code)
                // With weighted scoring, the highest score wins regardless of category order
                const result = client.selectAutoModel('Step by step explain this function');
                expect(result.reason).toBe('reasoning'); // Reasoning wins with higher score
                expect(result.model).toBe('grok-4-1-fast-reasoning');
            });
            it('should still prefer reasoning when it has higher score', () => {
                // "step by step" (15) > "analyze" (5)
                const result = client.selectAutoModel('Step by step analyze this');
                expect(result.model).toBe('grok-4-1-fast-reasoning');
                expect(result.reason).toBe('reasoning');
            });
            it('should prefer code when it has higher weighted score', () => {
                // Multiple code indicators: function (10) + bug (5) + typescript (10) = 25
                // vs single reasoning: "explain" doesn't have strong reasoning weight
                const result = client.selectAutoModel('Fix the bug in my typescript function');
                expect(result.model).toBe('grok-code-fast-1');
                expect(result.reason).toBe('code');
            });
        });
    });
    // ===========================================================================
    // Complexity Scoring Tests (P4-011)
    // ===========================================================================
    describe('calculateComplexityScore', () => {
        let client;
        beforeEach(() => {
            client = new XAIClient({ apiKey: 'xai-test-key-1234567890' });
        });
        describe('code detection', () => {
            it('should score high for explicit code requests', () => {
                const score = client.calculateComplexityScore('Write a function to sort an array');
                expect(score.category).toBe('code');
                expect(score.adjusted).toBeGreaterThan(0);
                expect(score.matchedIndicators).toContain('function');
            });
            it('should score highest for code blocks in context', () => {
                const score = client.calculateComplexityScore('Review this', '```js\nfunction foo() {}\n```');
                expect(score.category).toBe('code');
                expect(score.matchedIndicators).toContain('[code block detected]');
                expect(score.breakdown.codeScore).toBeGreaterThan(10); // At least DEFINITIVE weight
            });
            it('should accumulate weights from multiple code indicators', () => {
                const simpleScore = client.calculateComplexityScore('Fix bug');
                const complexScore = client.calculateComplexityScore('Fix the typescript function bug in my react component');
                expect(complexScore.breakdown.codeScore).toBeGreaterThan(simpleScore.breakdown.codeScore);
            });
        });
        describe('reasoning detection', () => {
            it('should score high for step-by-step requests', () => {
                const score = client.calculateComplexityScore('Explain step by step how quicksort works');
                expect(score.category).toBe('reasoning');
                expect(score.matchedIndicators).toContain('step by step');
                expect(score.breakdown.reasoningScore).toBeGreaterThanOrEqual(15); // DEFINITIVE weight
            });
            it('should detect mathematical reasoning', () => {
                const score = client.calculateComplexityScore('Prove this theorem from the axiom');
                expect(score.category).toBe('reasoning');
                expect(score.matchedIndicators).toContain('prove');
                expect(score.matchedIndicators).toContain('theorem');
                expect(score.matchedIndicators).toContain('axiom');
            });
        });
        describe('complexity detection', () => {
            it('should detect architectural analysis', () => {
                const score = client.calculateComplexityScore('Analyze the system design and tradeoffs');
                expect(score.category).toBe('complex');
                expect(score.matchedIndicators).toContain('system design');
                expect(score.matchedIndicators).toContain('tradeoffs');
            });
            it('should score high for comprehensive analysis requests', () => {
                const score = client.calculateComplexityScore('Evaluate the scalability and compare microservices approaches');
                expect(score.category).toBe('complex');
                expect(score.breakdown.complexityScore).toBeGreaterThan(10);
            });
        });
        describe('simplicity penalties', () => {
            it('should reduce score for "just tell me" queries', () => {
                const complex = client.calculateComplexityScore('Analyze the architecture');
                const simple = client.calculateComplexityScore('Just tell me the architecture briefly');
                expect(simple.breakdown.simplicityPenalty).toBeLessThan(0);
                expect(simple.adjusted).toBeLessThan(complex.adjusted);
            });
            it('should detect multiple simplicity indicators', () => {
                const score = client.calculateComplexityScore('Give me a quick summary briefly');
                expect(score.breakdown.simplicityPenalty).toBe(-40); // Capped at 2 indicators * -20
            });
            it('should cap simplicity penalty at -40', () => {
                // Even with 3+ simplicity words, penalty should cap at -40
                const score = client.calculateComplexityScore('Give me a quick simple brief summary');
                expect(score.breakdown.simplicityPenalty).toBe(-40);
            });
        });
        describe('query length multiplier', () => {
            it('should reduce score for very short queries', () => {
                const score = client.calculateComplexityScore('Fix bug');
                expect(score.breakdown.lengthMultiplier).toBe(0.7);
            });
            it('should use base multiplier for normal queries', () => {
                const score = client.calculateComplexityScore('Please help me understand how this function works');
                expect(score.breakdown.lengthMultiplier).toBe(1.0);
            });
            it('should increase multiplier for long detailed queries', () => {
                const longQuery = 'Fix the authentication bug in the login handler that causes session tokens ' +
                    'to expire prematurely when users have special characters in their passwords and ' +
                    'ensure backward compatibility with existing sessions while implementing proper ' +
                    'token refresh logic for mobile clients';
                const score = client.calculateComplexityScore(longQuery);
                expect(score.breakdown.lengthMultiplier).toBeGreaterThan(1.0);
            });
        });
        describe('context size multiplier', () => {
            it('should use base multiplier for no context', () => {
                const score = client.calculateComplexityScore('Review this code');
                expect(score.breakdown.contextMultiplier).toBe(1.0);
            });
            it('should use base multiplier for small context', () => {
                const score = client.calculateComplexityScore('Review this', 'const x = 1;');
                expect(score.breakdown.contextMultiplier).toBe(1.0);
            });
            it('should increase multiplier for large context', () => {
                const largeContext = 'x'.repeat(50000); // ~50K chars
                const score = client.calculateComplexityScore('Review this', largeContext);
                expect(score.breakdown.contextMultiplier).toBeGreaterThan(1.2);
            });
        });
        describe('confidence calculation', () => {
            it('should have high confidence for pure code queries', () => {
                const score = client.calculateComplexityScore('Debug the TypeScript compiler error');
                expect(score.confidence).toBeGreaterThan(60);
            });
            it('should have lower confidence for hybrid queries', () => {
                // Has both code and reasoning signals
                const score = client.calculateComplexityScore('Step by step explain how to fix this function bug');
                // With weighted scoring, code might win but confidence should reflect competition
                expect(score.matchedIndicators.length).toBeGreaterThan(2);
            });
            it('should have 100% confidence for simple queries with no indicators', () => {
                const score = client.calculateComplexityScore('Hello world');
                expect(score.category).toBe('simple');
                expect(score.confidence).toBe(100);
            });
        });
        describe('selectModelFromScore', () => {
            it('should select code model for high-confidence code category', () => {
                const score = client.calculateComplexityScore('Write a TypeScript function');
                const model = client.selectModelFromScore(score);
                expect(model).toBe('grok-code-fast-1');
            });
            it('should select reasoning model for high-confidence reasoning category', () => {
                const score = client.calculateComplexityScore('Walk me through step by step');
                const model = client.selectModelFromScore(score);
                expect(model).toBe('grok-4-1-fast-reasoning');
            });
            it('should select flagship for high complexity score', () => {
                // Use a very complex query that triggers multiple DEFINITIVE/STRONG indicators
                // system design (15) + design pattern (15) + tradeoffs (10) + scalability (10) +
                // microservices (10) + best approach (10) + evaluate (5) + analyze (5) = 80
                const score = client.calculateComplexityScore('Analyze the system design and design pattern tradeoffs for scalability. ' +
                    'What is the best approach for microservices architecture? Evaluate options.');
                expect(score.adjusted).toBeGreaterThanOrEqual(70); // Verify we have a high score
                const model = client.selectModelFromScore(score);
                expect(model).toBe('grok-4-0709');
            });
            it('should select fast model for simple queries', () => {
                const score = client.calculateComplexityScore('What is 2+2?');
                const model = client.selectModelFromScore(score);
                expect(model).toBe('grok-4-fast-non-reasoning');
            });
        });
        describe('integration with selectAutoModel', () => {
            it('should include complexity score in auto selection result', () => {
                const result = client.selectAutoModel('Analyze the code architecture');
                expect(result.complexityScore).toBeDefined();
                expect(result.complexityScore?.adjusted).toBeGreaterThan(0);
                expect(result.complexityScore?.confidence).toBeGreaterThan(0);
            });
            it('should have matching category between selectAutoModel and complexityScore', () => {
                const result = client.selectAutoModel('Write a function');
                expect(result.reason).toBe(result.complexityScore?.category);
            });
        });
    });
    describe('calculateCost', () => {
        let client;
        beforeEach(() => {
            client = new XAIClient({ apiKey: 'xai-test-key-1234567890' });
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
        let client;
        beforeEach(() => {
            client = new XAIClient({ apiKey: 'xai-test-key-1234567890' });
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
                        { index: 0, message: { role: 'assistant', content: 'Hi' }, finish_reason: 'stop' },
                    ],
                    usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
                });
            }));
            await client.chatCompletion({
                model: 'fast',
                messages: [{ role: 'user', content: 'Hello' }],
            });
            expect(capturedModel).toBe('grok-4-fast-non-reasoning');
        });
        it('should handle 401 unauthorized error', async () => {
            server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
                return HttpResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
            }));
            await expect(client.chatCompletion({
                model: 'grok-4',
                messages: [{ role: 'user', content: 'Hello' }],
            })).rejects.toThrow(XAIError);
        });
        it('should handle 500 server error', async () => {
            server.use(http.post('https://api.x.ai/v1/chat/completions', () => {
                return HttpResponse.json({ error: { message: 'Server Error' } }, { status: 500 });
            }));
            await expect(client.chatCompletion({
                model: 'grok-4',
                messages: [{ role: 'user', content: 'Hello' }],
            })).rejects.toThrow(XAIError);
        });
    });
    describe('getModelTimeout', () => {
        it('should return slow timeout for grok-4-0709 (flagship)', () => {
            expect(getModelTimeout('grok-4-0709')).toBe(SLOW_MODEL_TIMEOUT);
        });
        it('should return slow timeout for grok-4 variants without -fast suffix', () => {
            expect(getModelTimeout('grok-4')).toBe(SLOW_MODEL_TIMEOUT);
            expect(getModelTimeout('grok-4-0709')).toBe(SLOW_MODEL_TIMEOUT);
            expect(getModelTimeout('grok-4-something-new')).toBe(SLOW_MODEL_TIMEOUT);
        });
        it('should return default timeout for fast models', () => {
            expect(getModelTimeout('grok-4-fast-non-reasoning')).toBe(DEFAULT_TIMEOUT);
            expect(getModelTimeout('grok-4-1-fast-reasoning')).toBe(DEFAULT_TIMEOUT);
            expect(getModelTimeout('grok-code-fast-1')).toBe(DEFAULT_TIMEOUT);
        });
        it('should return default timeout for vision models', () => {
            expect(getModelTimeout('grok-2-vision-1212')).toBe(DEFAULT_TIMEOUT);
        });
        it('should return default timeout for other models', () => {
            expect(getModelTimeout('grok-3')).toBe(DEFAULT_TIMEOUT);
            expect(getModelTimeout('grok-2-1212')).toBe(DEFAULT_TIMEOUT);
        });
        it('should use user-specified timeout when provided', () => {
            expect(getModelTimeout('grok-4-0709', 60000)).toBe(60000);
            expect(getModelTimeout('grok-4-fast-non-reasoning', 120000)).toBe(120000);
        });
        it('should use instance timeout as fallback for fast models', () => {
            expect(getModelTimeout('grok-4-fast-non-reasoning', undefined, 45000)).toBe(45000);
        });
        it('should ignore instance timeout for slow models (use SLOW_MODEL_TIMEOUT)', () => {
            // Even with custom instance timeout, slow models get SLOW_MODEL_TIMEOUT
            expect(getModelTimeout('grok-4-0709', undefined, 45000)).toBe(SLOW_MODEL_TIMEOUT);
        });
    });
    describe('listModels', () => {
        let client;
        beforeEach(() => {
            client = new XAIClient({ apiKey: 'xai-test-key-1234567890' });
        });
        it('should fetch models list', async () => {
            const response = await client.listModels(true);
            expect(response.data).toBeInstanceOf(Array);
            expect(response.data.length).toBeGreaterThan(0);
        });
        it('should cache models list', async () => {
            let callCount = 0;
            server.use(http.get('https://api.x.ai/v1/models', () => {
                callCount++;
                return HttpResponse.json({
                    object: 'list',
                    data: [{ id: 'grok-4', object: 'model', created: Date.now(), owned_by: 'xai' }],
                });
            }));
            await client.listModels(true); // First call
            await client.listModels(false); // Cached
            await client.listModels(false); // Cached
            expect(callCount).toBe(1);
        });
        it('should force refresh when requested', async () => {
            let callCount = 0;
            server.use(http.get('https://api.x.ai/v1/models', () => {
                callCount++;
                return HttpResponse.json({
                    object: 'list',
                    data: [{ id: 'grok-4', object: 'model', created: Date.now(), owned_by: 'xai' }],
                });
            }));
            await client.listModels(true);
            await client.listModels(true);
            expect(callCount).toBe(2);
        });
    });
    describe('validateApiKey', () => {
        let client;
        beforeEach(() => {
            client = new XAIClient({ apiKey: 'xai-test-key-1234567890' });
        });
        it('should return true for valid API key', async () => {
            const isValid = await client.validateApiKey();
            expect(isValid).toBe(true);
        });
        it('should return false for invalid API key', async () => {
            server.use(http.get('https://api.x.ai/v1/models', () => {
                return HttpResponse.json({ error: { message: 'Invalid API key' } }, { status: 401 });
            }));
            const isValid = await client.validateApiKey();
            expect(isValid).toBe(false);
        });
        it('should throw for non-401 errors', async () => {
            server.use(http.get('https://api.x.ai/v1/models', () => {
                return HttpResponse.json({ error: { message: 'Server error' } }, { status: 500 });
            }));
            await expect(client.validateApiKey()).rejects.toThrow(XAIError);
        });
    });
    describe('cache methods', () => {
        let client;
        beforeEach(() => {
            client = new XAIClient({ apiKey: 'xai-test-key-1234567890' });
        });
        it('should return null cache expiry before first call', () => {
            expect(client.getModelsCacheExpiry()).toBeNull();
        });
        it('should return cache expiry after fetching models', async () => {
            await client.listModels(true);
            const expiry = client.getModelsCacheExpiry();
            expect(expiry).toBeInstanceOf(Date);
            expect(expiry.getTime()).toBeGreaterThan(Date.now());
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
        expect(() => createClient()).toThrow('XAI_API_KEY is required');
        if (originalKey) {
            process.env.XAI_API_KEY = originalKey;
        }
    });
    it('should create client when XAI_API_KEY is set', () => {
        const originalKey = process.env.XAI_API_KEY;
        process.env.XAI_API_KEY = 'xai-test-api-key-12345678';
        const client = createClient();
        expect(client).toBeInstanceOf(XAIClient);
        if (originalKey) {
            process.env.XAI_API_KEY = originalKey;
        }
        else {
            delete process.env.XAI_API_KEY;
        }
    });
});
describe('XAIError', () => {
    it('should create error with all properties', () => {
        const error = new XAIError('Test error', 500, 'Internal Server Error', '{"error":"details"}');
        expect(error.message).toBe('Test error');
        expect(error.statusCode).toBe(500);
        expect(error.statusText).toBe('Internal Server Error');
        expect(error.name).toBe('XAIError');
    });
    it('should return sanitized message without response body', () => {
        const error = new XAIError('Request failed', 401, 'Unauthorized', '{"api_key":"secret-key-xyz"}');
        const sanitized = error.getSanitizedMessage();
        expect(sanitized).toBe('XAIError: Request failed (HTTP 401)');
        expect(sanitized).not.toContain('secret-key');
        expect(sanitized).not.toContain('api_key');
    });
    it('should include response body in debug info only', () => {
        const sensitiveBody = '{"api_key":"secret-key-xyz","token":"abc123"}';
        const error = new XAIError('Request failed', 500, 'Error', sensitiveBody);
        const debugInfo = error.getDebugInfo();
        const parsed = JSON.parse(debugInfo);
        expect(parsed.responseBody).toBe(sensitiveBody);
        expect(parsed.statusCode).toBe(500);
        expect(parsed.message).toBe('Request failed');
    });
    it('should check if response body contains text without exposing it', () => {
        const error = new XAIError('Error', 400, 'Bad Request', 'rate_limit_exceeded');
        expect(error.hasResponseBodyContaining('rate_limit')).toBe(true);
        expect(error.hasResponseBodyContaining('invalid_api_key')).toBe(false);
    });
    it('should handle missing response body gracefully', () => {
        const error = new XAIError('Timeout', 408, 'Request Timeout');
        expect(error.hasResponseBodyContaining('anything')).toBe(false);
        const debugInfo = JSON.parse(error.getDebugInfo());
        expect(debugInfo.responseBody).toBeUndefined();
    });
    it('should be instanceof Error', () => {
        const error = new XAIError('Test', 500, 'Error');
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(XAIError);
    });
});
//# sourceMappingURL=xai-client.test.js.map
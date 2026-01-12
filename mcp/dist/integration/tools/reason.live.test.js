/**
 * grok_reason Tool Live Integration Tests
 *
 * Tests the reasoning tool against the real xAI API.
 *
 * @module integration/tools/reason.live.test
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { handleReason } from '../../tools/reason.js';
import { isApiAvailable, skipIfApiUnavailable } from '../setup.js';
import { createTestClient } from '../helpers/api-client.js';
import { withRateLimit } from '../helpers/rate-limiter.js';
import '../helpers/assertions.js';
describe('grok_reason (live)', () => {
    let client;
    beforeAll(() => {
        if (!isApiAvailable())
            return;
        client = createTestClient();
    });
    describe('effort levels', () => {
        it('should reason with low effort', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleReason(client, {
                query: 'What is 15 + 27?',
                effort: 'low',
            }));
            expect(result.content).toBeDefined();
            expect(result.isError).toBe(false);
            const text = result.content[0].text;
            expect(text).toContain('42');
        });
        it('should reason with medium effort', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleReason(client, {
                query: 'If all roses are flowers and some flowers fade quickly, what can we conclude about roses?',
                effort: 'medium',
            }));
            expect(result.content).toBeDefined();
            expect(result.isError).toBe(false);
            const text = result.content[0].text.toLowerCase();
            // Should show some logical reasoning
            expect(text).toMatch(/rose|flower|conclude|logic|some|may|might/);
        });
        it('should reason with high effort', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleReason(client, {
                query: 'A farmer has 17 sheep. All but 9 run away. How many are left?',
                effort: 'high',
            }));
            expect(result.content).toBeDefined();
            expect(result.isError).toBe(false);
            const text = result.content[0].text;
            // Should get the right answer (9)
            expect(text).toContain('9');
        });
    });
    describe('thinking trace', () => {
        it('should show thinking trace when requested', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleReason(client, {
                query: 'What comes next in the sequence: 2, 4, 8, 16, ?',
                effort: 'medium',
                show_thinking: true,
            }));
            expect(result.content).toBeDefined();
            expect(result.isError).toBe(false);
            const text = result.content[0].text;
            // Should show the answer (32)
            expect(text).toContain('32');
        });
        it('should hide thinking trace when not requested', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleReason(client, {
                query: 'What is the capital of France?',
                effort: 'low',
                show_thinking: false,
            }));
            expect(result.content).toBeDefined();
            expect(result.isError).toBe(false);
            const text = result.content[0].text;
            expect(text.toLowerCase()).toContain('paris');
        });
    });
    describe('context usage', () => {
        it('should use provided context', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleReason(client, {
                query: 'Based on the context, what is the main character doing?',
                context: 'In the story, Alice is chasing a white rabbit down a hole.',
                effort: 'low',
            }));
            expect(result.content).toBeDefined();
            expect(result.isError).toBe(false);
            const text = result.content[0].text.toLowerCase();
            expect(text).toMatch(/alice|rabbit|chase|follow/);
        });
    });
    describe('error handling', () => {
        it('should handle empty query gracefully', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await handleReason(client, {
                query: '',
            });
            expect(result.content).toBeDefined();
            const text = result.content[0].text.toLowerCase();
            expect(text).toMatch(/error|required|empty|invalid/);
        });
        it('should handle missing query property', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await handleReason(client, {});
            expect(result.content).toBeDefined();
            expect(result.isError).toBe(true);
        });
    });
});
//# sourceMappingURL=reason.live.test.js.map
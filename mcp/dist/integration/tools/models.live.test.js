/**
 * grok_models Tool Live Integration Tests
 *
 * Tests the models tool against the real xAI API.
 * These tests are free (no chat completions).
 *
 * @module integration/tools/models.live.test
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { handleGrokModels } from '../../tools/models.js';
import { isApiAvailable, skipIfApiUnavailable } from '../setup.js';
import { createTestClient } from '../helpers/api-client.js';
import { withRateLimit } from '../helpers/rate-limiter.js';
describe('grok_models (live)', () => {
    let client;
    beforeAll(() => {
        if (!isApiAvailable())
            return;
        client = createTestClient();
    });
    describe('model listing', () => {
        it('should list available models', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokModels(client, {}));
            expect(result.content).toBeDefined();
            expect(result.content[0].text).toBeDefined();
            const text = result.content[0].text;
            expect(text).toContain('grok');
        });
        it('should include model details', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokModels(client, {}));
            const text = result.content[0].text;
            // Should include pricing information
            expect(text).toMatch(/\$[\d.]+/);
            // Should include model names
            expect(text.toLowerCase()).toContain('grok');
        });
        it('should include model aliases', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokModels(client, {}));
            const text = result.content[0].text.toLowerCase();
            // Should mention common aliases
            expect(text).toMatch(/fast|auto|code|reasoning|smartest/);
        });
        it('should handle refresh parameter', async () => {
            if (skipIfApiUnavailable())
                return;
            // Force refresh
            const result = await withRateLimit(() => handleGrokModels(client, { refresh: true }));
            expect(result.content).toBeDefined();
            const text = result.content[0].text;
            expect(text).toContain('grok');
        });
    });
    describe('caching', () => {
        it('should cache model list', async () => {
            if (skipIfApiUnavailable())
                return;
            // First call
            await withRateLimit(() => handleGrokModels(client, { refresh: true }));
            // Second call should use cache
            const cacheExpiry = client.getModelsCacheExpiry();
            expect(cacheExpiry).toBeDefined();
            expect(cacheExpiry.getTime()).toBeGreaterThan(Date.now());
        });
    });
    describe('error handling', () => {
        it('should handle null input gracefully', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokModels(client, null));
            expect(result.content).toBeDefined();
        });
        it('should handle undefined input gracefully', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokModels(client, undefined));
            expect(result.content).toBeDefined();
        });
    });
});
//# sourceMappingURL=models.live.test.js.map
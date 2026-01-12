/**
 * Error Recovery Scenario Live Tests
 *
 * Tests error handling and recovery behavior.
 *
 * @module integration/scenarios/error-recovery.live.test
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { handleGrokQuery } from '../../tools/query.js';
import { createClient } from '../../client/xai-client.js';
import { isApiAvailable, skipIfApiUnavailable } from '../setup.js';
import { createTestClient } from '../helpers/api-client.js';
import { withRateLimit } from '../helpers/rate-limiter.js';
import '../helpers/assertions.js';
describe('Error Recovery (live)', () => {
    let client;
    beforeAll(() => {
        if (!isApiAvailable())
            return;
        client = createTestClient();
    });
    describe('authentication errors', () => {
        it('should handle invalid API key gracefully', async () => {
            if (skipIfApiUnavailable())
                return;
            // Create client with invalid key
            const originalKey = process.env.XAI_API_KEY;
            process.env.XAI_API_KEY = 'xai-invalid-key-12345678901234567890';
            try {
                const badClient = createClient();
                // Query should fail with auth error
                const result = await handleGrokQuery(badClient, {
                    query: 'test',
                });
                // Should return error response, not crash
                expect(result.content).toBeDefined();
                const text = result.content[0].text.toLowerCase();
                expect(text).toMatch(/error|unauthorized|invalid|401|auth/);
            }
            finally {
                process.env.XAI_API_KEY = originalKey;
            }
        });
    });
    describe('model errors', () => {
        it('should handle model not found error', async () => {
            if (skipIfApiUnavailable())
                return;
            // Try to use a non-existent model
            const result = await withRateLimit(() => handleGrokQuery(client, {
                query: 'test',
                model: 'grok-nonexistent-model-xyz-12345',
            }));
            // Should handle gracefully
            expect(result.content).toBeDefined();
        });
        it('should fall back or report error for deprecated models', async () => {
            if (skipIfApiUnavailable())
                return;
            // Try deprecated model - should either fall back or error gracefully
            const result = await withRateLimit(() => handleGrokQuery(client, {
                query: 'test',
                model: 'grok-beta', // Old model ID
            }));
            expect(result.content).toBeDefined();
        });
    });
    describe('input validation', () => {
        it('should report clear errors for invalid input', async () => {
            if (skipIfApiUnavailable())
                return;
            // Test with various invalid inputs
            const testCases = [
                { query: null },
                { query: undefined },
                { query: 123 },
                { query: { nested: 'object' } },
            ];
            for (const testCase of testCases) {
                const result = await handleGrokQuery(client, testCase);
                expect(result.content).toBeDefined();
                // Should return error, not crash
                const text = result.content[0].text.toLowerCase();
                expect(text.length).toBeGreaterThan(0);
            }
        });
    });
    describe('network resilience', () => {
        it('should recover from successful request after error', async () => {
            if (skipIfApiUnavailable())
                return;
            // First, cause an error (invalid query)
            await handleGrokQuery(client, {
                query: '',
            });
            // Then make a valid request - should succeed
            const result = await withRateLimit(() => handleGrokQuery(client, {
                query: 'Reply: recovery test',
                model: 'fast',
                max_tokens: 10,
            }));
            expect(result.content).toBeDefined();
            const text = result.content[0].text.toLowerCase();
            expect(text).toContain('recovery');
        });
    });
    describe('error message clarity', () => {
        it('should provide actionable error messages', async () => {
            // Test error message for missing API key
            const originalKey = process.env.XAI_API_KEY;
            process.env.XAI_API_KEY = '';
            try {
                expect(() => createClient()).toThrow(/required|api key/i);
            }
            finally {
                process.env.XAI_API_KEY = originalKey;
            }
        });
        it('should not leak sensitive information in errors', async () => {
            if (skipIfApiUnavailable())
                return;
            // Create client with invalid key
            const originalKey = process.env.XAI_API_KEY;
            const testKey = 'xai-test-secret-key-12345678901234567890';
            process.env.XAI_API_KEY = testKey;
            try {
                const badClient = createClient();
                const result = await handleGrokQuery(badClient, {
                    query: 'test',
                });
                // Error message should not contain the API key
                const text = result.content[0].text;
                expect(text).not.toContain(testKey);
                expect(text).not.toContain('xai-test-secret');
            }
            finally {
                process.env.XAI_API_KEY = originalKey;
            }
        });
    });
});
//# sourceMappingURL=error-recovery.live.test.js.map
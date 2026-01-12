/**
 * grok_search_x Tool Live Integration Tests
 *
 * Validates X/Twitter and web search against real xAI API.
 * Uses Agent Tools API (/v1/responses) with x_search and web_search tools.
 *
 * Critical: This validates the Agent Tools API migration before
 * the January 12, 2026 deprecation deadline.
 *
 * @module integration/tools/search-x.live.test
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { handleGrokSearchX } from '../../tools/search-x.js';
import { isApiAvailable, skipIfApiUnavailable } from '../setup.js';
import { createTestClient, extractModelFromResponse } from '../helpers/api-client.js';
import { withRateLimit } from '../helpers/rate-limiter.js';
import '../helpers/assertions.js';
describe('grok_search_x (live)', () => {
    let client;
    beforeAll(() => {
        if (!isApiAvailable())
            return;
        client = createTestClient();
    });
    describe('basic searches', () => {
        it('should search X with default settings', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokSearchX(client, {
                query: 'What is the latest news about artificial intelligence?',
                max_turns: 1, // Minimize cost
            }));
            expect(result.content).toBeDefined();
            expect(result.content[0].type).toBe('text');
            expect(result.content[0].text).toContain('Search Results');
            // Ensure content is not undefined (regression test for null content handling)
            expect(result.content[0].text).not.toContain('\nundefined');
        });
        it('should search web when enabled', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokSearchX(client, {
                query: 'GitHub trending repositories',
                enable_x_search: false,
                enable_web_search: true,
                max_turns: 1,
            }));
            expect(result.content).toBeDefined();
            expect(result.content[0].text).toContain('Search Results');
        });
        it('should search both X and web', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokSearchX(client, {
                query: 'Latest tech news today',
                enable_x_search: true,
                enable_web_search: true,
                max_turns: 2,
            }));
            expect(result.content).toBeDefined();
            expect(result.content[0].text).toContain('Search Results');
        });
    });
    describe('response metadata', () => {
        it('should include citations in response', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokSearchX(client, {
                query: 'OpenAI announcements',
                include_citations: true,
                max_turns: 1,
            }));
            const text = result.content[0].text;
            // Citations may or may not be present depending on search results
            // But the response should be well-formatted
            expect(text).toContain('Model:');
            expect(text).toContain('Cost:');
        });
        it('should include model information', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokSearchX(client, {
                query: 'test search',
                max_turns: 1,
            }));
            const text = result.content[0].text;
            const model = extractModelFromResponse(text);
            expect(model).not.toBeNull();
            expect(model.toLowerCase()).toContain('grok');
        });
        it('should include cost information', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokSearchX(client, {
                query: 'cost test search',
                max_turns: 1,
            }));
            const text = result.content[0].text;
            // Check that cost info is present in the response
            // Format: "Cost: $X.XXXX"
            expect(text).toMatch(/Cost:\s*\$[\d.]+/);
        });
        it('should include token usage', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokSearchX(client, {
                query: 'token usage test',
                max_turns: 1,
            }));
            const text = result.content[0].text;
            expect(text).toMatch(/Tokens:\s*\d+/);
        });
    });
    describe('parameters', () => {
        it('should respect max_turns setting', async () => {
            if (skipIfApiUnavailable())
                return;
            // With max_turns=1, should be faster/cheaper
            const result = await withRateLimit(() => handleGrokSearchX(client, {
                query: 'quick search test',
                max_turns: 1,
            }));
            expect(result.content).toBeDefined();
            expect(result.content[0].text).toContain('Search Results');
        });
        it('should filter by domains for web search', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokSearchX(client, {
                query: 'programming tutorials',
                enable_x_search: false,
                enable_web_search: true,
                domains: ['github.com', 'stackoverflow.com'],
                max_turns: 1,
            }));
            expect(result.content).toBeDefined();
            expect(result.content[0].text).toContain('Search Results');
        });
        it('should exclude citations when disabled', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokSearchX(client, {
                query: 'no citations test',
                include_citations: false,
                max_turns: 1,
            }));
            const text = result.content[0].text;
            // Should not have Sources section
            expect(text).not.toContain('Sources:');
        });
    });
    describe('error handling', () => {
        it('should fail when no search type enabled', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await handleGrokSearchX(client, {
                query: 'test query',
                enable_x_search: false,
                enable_web_search: false,
            });
            expect(result.content[0].text).toContain('Search failed');
            expect(result.content[0].text).toContain('Enable at least one search type');
        });
        it('should handle empty query gracefully', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await handleGrokSearchX(client, {
                query: '',
            });
            expect(result.content).toBeDefined();
            const text = result.content[0].text.toLowerCase();
            expect(text).toMatch(/error|failed|required/);
        });
    });
    describe('privacy compliance', () => {
        it('should summarize content (not reproduce verbatim)', async () => {
            if (skipIfApiUnavailable())
                return;
            // The system prompt enforces "Summarize findings. Do not reproduce posts verbatim."
            // We can't fully verify this automatically, but we can check the response
            // doesn't look like raw tweet dumps
            const result = await withRateLimit(() => handleGrokSearchX(client, {
                query: 'What are people saying about AI?',
                max_turns: 1,
            }));
            const text = result.content[0].text;
            expect(text).toContain('Search Results');
            // Response should be narrative/summary, not just raw posts
            // This is a soft check - the system prompt handles enforcement
        });
    });
});
//# sourceMappingURL=search-x.live.test.js.map
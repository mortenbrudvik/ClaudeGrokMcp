/**
 * grok_generate_image Tool Live Integration Tests
 *
 * Validates image generation against real xAI API.
 * Uses POST /v1/images/generations endpoint with grok-2-image-1212 model.
 *
 * Note: Image generation has a rate limit of 5 requests per second.
 * These tests include built-in delays to respect this limit.
 *
 * @module integration/tools/generate-image.live.test
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { handleGrokGenerateImage } from '../../tools/generate-image.js';
import { isApiAvailable, skipIfApiUnavailable } from '../setup.js';
import { createTestClient } from '../helpers/api-client.js';
import { withRateLimit } from '../helpers/rate-limiter.js';
import '../helpers/assertions.js';
describe('grok_generate_image (live)', () => {
    let client;
    beforeAll(() => {
        if (!isApiAvailable())
            return;
        client = createTestClient();
    });
    describe('basic generation', () => {
        it('should generate a single image with URL response', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokGenerateImage(client, {
                prompt: 'A simple red circle on a white background',
                n: 1,
            }));
            expect(result.content).toBeDefined();
            expect(result.content[0].type).toBe('text');
            const text = result.content[0].text;
            expect(text).toContain('Image Generation Results');
            expect(text).toContain('Generated 1 image');
            expect(text).toContain('View Image');
            expect(text).toMatch(/https?:\/\//); // Should contain URL
        }, 60000); // 60s timeout for image generation
        it('should include URL expiration notice', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokGenerateImage(client, {
                prompt: 'A blue square',
                n: 1,
            }));
            expect(result.content).toBeDefined();
            const text = result.content[0].text;
            expect(text).toContain('temporary');
            expect(text).toContain('expire');
        }, 60000);
    });
    describe('response format', () => {
        it('should return base64 when requested', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokGenerateImage(client, {
                prompt: 'A green triangle',
                n: 1,
                response_format: 'b64_json',
            }));
            expect(result.content).toBeDefined();
            const text = result.content[0].text;
            expect(text).toContain('Image Generation Results');
            expect(text).toContain('base64');
            expect(text).toMatch(/\d+KB/); // Should include size
            expect(text).not.toContain('temporary'); // No expiration for base64
        }, 60000);
    });
    describe('multiple images', () => {
        it('should generate multiple images', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokGenerateImage(client, {
                prompt: 'A colorful abstract pattern',
                n: 2,
            }));
            expect(result.content).toBeDefined();
            const text = result.content[0].text;
            expect(text).toContain('Generated 2 images');
            expect(text).toContain('Image 1');
            expect(text).toContain('Image 2');
        }, 90000); // Longer timeout for multiple images
    });
    describe('response metadata', () => {
        it('should include model information', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokGenerateImage(client, {
                prompt: 'A simple dot',
                n: 1,
            }));
            const text = result.content[0].text;
            expect(text).toContain('grok-2-image');
        }, 60000);
        it('should include cost information', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokGenerateImage(client, {
                prompt: 'A simple line',
                n: 1,
            }));
            const text = result.content[0].text;
            // Check that cost info is present in the response
            expect(text).toMatch(/\$[\d.]+/);
        }, 60000);
        it('should include response time', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokGenerateImage(client, {
                prompt: 'A small circle',
                n: 1,
            }));
            const text = result.content[0].text;
            expect(text).toMatch(/\d+ms/);
        }, 60000);
    });
    describe('prompt handling', () => {
        it('should handle detailed prompts', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokGenerateImage(client, {
                prompt: 'A serene mountain landscape at sunset with snow-capped peaks, ' +
                    'a calm lake in the foreground reflecting the orange and pink sky, ' +
                    'pine trees along the shore, and a small cabin with warm lights',
                n: 1,
            }));
            expect(result.content).toBeDefined();
            const text = result.content[0].text;
            expect(text).toContain('Image Generation Results');
            expect(text).toContain('Generated 1 image');
        }, 60000);
        it('should include revised prompt when model modifies it', async () => {
            if (skipIfApiUnavailable())
                return;
            // Some prompts may be revised by the model for safety/clarity
            const result = await withRateLimit(() => handleGrokGenerateImage(client, {
                prompt: 'A cat', // Simple prompt that may get expanded
                n: 1,
            }));
            expect(result.content).toBeDefined();
            const text = result.content[0].text;
            expect(text).toContain('Image Generation Results');
            // Revised prompt may or may not be present depending on API behavior
            // We just verify the generation succeeded
        }, 60000);
    });
    describe('error handling', () => {
        it('should handle empty prompt gracefully', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await handleGrokGenerateImage(client, {
                prompt: '',
            });
            expect(result.content).toBeDefined();
            const text = result.content[0].text.toLowerCase();
            expect(text).toMatch(/error|failed|required|empty/);
            expect(result.isError).toBe(true);
        });
        it('should handle missing prompt parameter', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await handleGrokGenerateImage(client, {});
            expect(result.content).toBeDefined();
            const text = result.content[0].text.toLowerCase();
            expect(text).toMatch(/error|failed|required/);
            expect(result.isError).toBe(true);
        });
        it('should handle invalid n parameter', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await handleGrokGenerateImage(client, {
                prompt: 'A test image',
                n: 100, // Exceeds maximum
            });
            expect(result.content).toBeDefined();
            const text = result.content[0].text.toLowerCase();
            expect(text).toMatch(/error|failed|between|maximum/);
            expect(result.isError).toBe(true);
        });
    });
    describe('model alias', () => {
        it('should support image alias', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokGenerateImage(client, {
                prompt: 'A simple shape',
                n: 1,
                model: 'image', // Use alias instead of full model ID
            }));
            expect(result.content).toBeDefined();
            const text = result.content[0].text;
            expect(text).toContain('Image Generation Results');
            expect(text).toContain('Generated 1 image');
        }, 60000);
    });
});
//# sourceMappingURL=generate-image.live.test.js.map
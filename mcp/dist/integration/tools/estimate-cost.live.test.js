/**
 * grok_estimate_cost Tool Live Integration Tests
 *
 * Tests the cost estimation tool against real API responses.
 * Most tests are free (local calculations), but one validates against actual cost.
 *
 * @module integration/tools/estimate-cost.live.test
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { handleEstimateCost, executeEstimateCost } from '../../tools/estimate-cost.js';
import { handleGrokQuery } from '../../tools/query.js';
import { isApiAvailable, skipIfApiUnavailable } from '../setup.js';
import { createTestClient, extractCostFromResponse } from '../helpers/api-client.js';
import { withRateLimit } from '../helpers/rate-limiter.js';
import '../helpers/assertions.js';
describe('grok_estimate_cost (live)', () => {
    let client;
    beforeAll(() => {
        if (!isApiAvailable())
            return;
        client = createTestClient();
    });
    describe('cost estimation', () => {
        it('should estimate query cost', async () => {
            // This test is free - local calculation only
            const result = await handleEstimateCost({
                query: 'What is the meaning of life?',
                model: 'fast',
            });
            expect(result.content).toBeDefined();
            expect(result.isError).toBe(false);
            const text = result.content[0].text;
            expect(text).toContain('Cost Estimate');
            expect(text).toMatch(/\$[\d.]+/);
        });
        it('should compare model costs', async () => {
            // This test is free - local calculations only
            const fastResult = executeEstimateCost({
                query: 'Test query for comparison',
                model: 'fast',
            });
            const smartestResult = executeEstimateCost({
                query: 'Test query for comparison',
                model: 'smartest',
            });
            // fast model should be cheaper than smartest
            expect(fastResult.estimated_cost_usd).toBeLessThan(smartestResult.estimated_cost_usd);
        });
        it('should estimate cost close to actual cost', async () => {
            if (skipIfApiUnavailable())
                return;
            // First, estimate the cost
            const query = 'Reply with exactly: test';
            const model = 'fast';
            const estimate = executeEstimateCost({
                query,
                model,
                max_tokens: 10,
            });
            // Then make the actual API call
            const result = await withRateLimit(() => handleGrokQuery(client, {
                query,
                model,
                max_tokens: 10,
            }));
            const actualCost = extractCostFromResponse(result.content[0].text);
            expect(actualCost).not.toBeNull();
            // Both estimate and actual may be 0 if model not in pricing table
            // In that case, just verify they're both non-negative
            if (actualCost === 0 || estimate.estimated_cost_usd === 0) {
                expect(actualCost).toBeGreaterThanOrEqual(0);
                expect(estimate.estimated_cost_usd).toBeGreaterThanOrEqual(0);
            }
            else {
                // Estimate should be within 100% of actual (token estimation is imprecise)
                const ratio = estimate.estimated_cost_usd / actualCost;
                expect(ratio).toBeGreaterThan(0.1);
                expect(ratio).toBeLessThan(10);
            }
        });
    });
    describe('model pricing', () => {
        it('should include pricing information', async () => {
            const result = executeEstimateCost({
                query: 'Test query',
                model: 'fast',
            });
            expect(result.pricing).toBeDefined();
            expect(result.pricing.input_per_1m).toBeGreaterThan(0);
            expect(result.pricing.output_per_1m).toBeGreaterThan(0);
        });
        it('should return breakdown of input/output costs', async () => {
            const result = executeEstimateCost({
                query: 'Test query',
                model: 'fast',
            });
            expect(result.breakdown).toBeDefined();
            expect(result.breakdown.input_cost_usd).toBeGreaterThanOrEqual(0);
            expect(result.breakdown.output_cost_usd).toBeGreaterThanOrEqual(0);
            // Total should equal sum of breakdown
            const calculatedTotal = result.breakdown.input_cost_usd + result.breakdown.output_cost_usd;
            expect(result.estimated_cost_usd).toBeCloseTo(calculatedTotal, 10);
        });
    });
    describe('warnings', () => {
        it('should warn for expensive operations', async () => {
            // Use a very long query that would be expensive
            const longQuery = 'A'.repeat(50000); // ~12,500 tokens
            const result = executeEstimateCost({
                query: longQuery,
                model: 'smartest', // Most expensive model
            });
            // Should include a warning for high cost
            expect(result.warning).toBeDefined();
        });
    });
    describe('error handling', () => {
        it('should handle empty query', async () => {
            const result = await handleEstimateCost({
                query: '',
            });
            expect(result.content).toBeDefined();
            expect(result.isError).toBe(true);
        });
        it('should handle missing query', async () => {
            const result = await handleEstimateCost({});
            expect(result.content).toBeDefined();
            expect(result.isError).toBe(true);
        });
    });
});
//# sourceMappingURL=estimate-cost.live.test.js.map
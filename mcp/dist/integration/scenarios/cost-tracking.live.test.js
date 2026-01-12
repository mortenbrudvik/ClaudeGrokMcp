/**
 * Cost Tracking Scenario Live Tests
 *
 * Tests cumulative cost tracking and budget enforcement.
 *
 * @module integration/scenarios/cost-tracking.live.test
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { CostTracker } from '../../services/cost-tracker.js';
import { handleGrokQuery } from '../../tools/query.js';
import { isApiAvailable, skipIfApiUnavailable } from '../setup.js';
import { createTestClient, extractCostFromResponse } from '../helpers/api-client.js';
import { TestCostTracker } from '../helpers/cost-tracker.js';
import { withRateLimit } from '../helpers/rate-limiter.js';
describe('Cost Tracking (live)', () => {
    let client;
    beforeAll(() => {
        if (!isApiAvailable())
            return;
        client = createTestClient();
    });
    describe('cumulative tracking', () => {
        it('should track cumulative cost across queries', async () => {
            if (skipIfApiUnavailable())
                return;
            const tracker = new TestCostTracker('cumulative test', 0.01);
            // First query
            const r1 = await withRateLimit(() => handleGrokQuery(client, {
                query: 'Say: one',
                model: 'fast',
                max_tokens: 5,
            }));
            const cost1 = extractCostFromResponse(r1.content[0].text);
            expect(cost1).not.toBeNull();
            tracker.addCost('grok-4-fast', 10, 5); // Approximate tokens
            // Second query
            const r2 = await withRateLimit(() => handleGrokQuery(client, {
                query: 'Say: two',
                model: 'fast',
                max_tokens: 5,
            }));
            const cost2 = extractCostFromResponse(r2.content[0].text);
            expect(cost2).not.toBeNull();
            tracker.addCost('grok-4-fast', 10, 5);
            // Cumulative cost should be sum
            const totalCost = tracker.getTotalCost();
            expect(totalCost).toBeGreaterThan(0);
            // Summary should reflect both queries
            const summary = tracker.getSummary();
            expect(summary.queries).toBe(2);
        });
    });
    describe('budget warnings', () => {
        it('should warn when approaching budget limit', async () => {
            // Use a very low budget to trigger warning
            const tracker = new CostTracker({
                limitUsd: 0.0001,
                enforceLimit: false,
            });
            // Add cost that exceeds 80% of budget
            tracker.addCost({
                costUsd: 0.00009,
                model: 'grok-4-fast',
                inputTokens: 100,
                outputTokens: 50,
            });
            const warning = tracker.getBudgetWarning();
            expect(warning).not.toBeNull();
            expect(warning).toContain('%');
        });
    });
    describe('budget enforcement', () => {
        it('should enforce budget limit', async () => {
            const tracker = new CostTracker({
                limitUsd: 0.0001,
                enforceLimit: true,
            });
            // Add cost that exceeds limit
            tracker.addCost({
                costUsd: 0.0002,
                model: 'grok-4-fast',
                inputTokens: 100,
                outputTokens: 50,
            });
            // Should be over budget
            expect(tracker.isWithinBudget(0.0001)).toBe(false);
            expect(tracker.getRemainingBudget()).toBe(0);
        });
        it('should allow queries within budget', async () => {
            const tracker = new CostTracker({
                limitUsd: 1.0,
                enforceLimit: true,
            });
            // Add small cost
            tracker.addCost({
                costUsd: 0.001,
                model: 'grok-4-fast',
                inputTokens: 100,
                outputTokens: 50,
            });
            // Should still have budget
            expect(tracker.isWithinBudget(0.001)).toBe(true);
            expect(tracker.getRemainingBudget()).toBeGreaterThan(0.9);
        });
    });
    describe('usage summary', () => {
        it('should provide detailed usage summary', async () => {
            if (skipIfApiUnavailable())
                return;
            const tracker = new CostTracker({
                limitUsd: 1.0,
                enforceLimit: false,
            });
            // Make a real query
            const result = await withRateLimit(() => handleGrokQuery(client, {
                query: 'Reply: summary test',
                model: 'fast',
                max_tokens: 10,
            }));
            const cost = extractCostFromResponse(result.content[0].text);
            // Track the cost
            tracker.addCost({
                costUsd: cost || 0.0001,
                model: 'grok-4-fast',
                inputTokens: 20,
                outputTokens: 10,
            });
            const summary = tracker.getUsageSummary();
            expect(summary.queryCount).toBe(1);
            expect(summary.totalCostUsd).toBeGreaterThan(0);
            expect(summary.remainingBudgetUsd).toBeLessThan(1.0);
            expect(summary.byModel['grok-4-fast']).toBeDefined();
        });
    });
});
//# sourceMappingURL=cost-tracking.live.test.js.map
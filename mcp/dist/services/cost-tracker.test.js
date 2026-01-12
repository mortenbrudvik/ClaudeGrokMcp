/**
 * Cost Tracker Service Unit Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CostTracker, CostLimitExceededError, getDefaultCostTrackerOptions, getDefaultCostTracker, resetDefaultCostTracker, } from './cost-tracker.js';
describe('CostTracker', () => {
    let tracker;
    beforeEach(() => {
        tracker = new CostTracker({ limitUsd: 10, enforceLimit: true });
    });
    describe('constructor', () => {
        it('should use default options when none provided', () => {
            const defaultTracker = new CostTracker();
            expect(defaultTracker.getOptions().limitUsd).toBe(10);
            expect(defaultTracker.getOptions().enforceLimit).toBe(true);
        });
        it('should accept custom options', () => {
            const customTracker = new CostTracker({ limitUsd: 5, enforceLimit: false });
            expect(customTracker.getOptions().limitUsd).toBe(5);
            expect(customTracker.getOptions().enforceLimit).toBe(false);
        });
        it('should merge partial options with defaults', () => {
            const partialTracker = new CostTracker({ limitUsd: 25 });
            expect(partialTracker.getOptions().limitUsd).toBe(25);
            expect(partialTracker.getOptions().enforceLimit).toBe(true);
        });
    });
    describe('addCost', () => {
        it('should track costs', () => {
            tracker.addCost({
                costUsd: 0.001,
                model: 'grok-4-fast',
                inputTokens: 100,
                outputTokens: 200,
            });
            expect(tracker.getTotalCost()).toBe(0.001);
        });
        it('should accumulate multiple costs', () => {
            tracker.addCost({
                costUsd: 0.001,
                model: 'grok-4-fast',
                inputTokens: 100,
                outputTokens: 200,
            });
            tracker.addCost({
                costUsd: 0.002,
                model: 'grok-4',
                inputTokens: 50,
                outputTokens: 100,
            });
            expect(tracker.getTotalCost()).toBe(0.003);
        });
        it('should record timestamps', () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-01-09T12:00:00Z'));
            tracker.addCost({
                costUsd: 0.001,
                model: 'grok-4-fast',
                inputTokens: 100,
                outputTokens: 200,
            });
            const records = tracker.getRecords();
            expect(records[0].timestamp).toBe(new Date('2026-01-09T12:00:00Z').getTime());
            vi.useRealTimers();
        });
    });
    describe('addFromEstimate', () => {
        it('should add cost from CostEstimate object', () => {
            const estimate = {
                estimated_usd: 0.0015,
                input_tokens: 100,
                output_tokens: 300,
                model: 'grok-4-fast-non-reasoning',
                pricing: {
                    input_per_1m: 0.2,
                    output_per_1m: 0.5,
                },
            };
            tracker.addFromEstimate(estimate);
            expect(tracker.getTotalCost()).toBe(0.0015);
            expect(tracker.getRecords()[0].model).toBe('grok-4-fast-non-reasoning');
        });
    });
    describe('budget checking', () => {
        it('should return true when within budget', () => {
            expect(tracker.isWithinBudget(1)).toBe(true);
        });
        it('should return false when over budget', () => {
            tracker.addCost({
                costUsd: 9.5,
                model: 'grok-4',
                inputTokens: 1000,
                outputTokens: 500,
            });
            expect(tracker.isWithinBudget(1)).toBe(false);
        });
        it('should allow exact budget match', () => {
            tracker.addCost({
                costUsd: 9,
                model: 'grok-4',
                inputTokens: 1000,
                outputTokens: 500,
            });
            expect(tracker.isWithinBudget(1)).toBe(true);
        });
        it('should bypass limit when enforceLimit is false', () => {
            const noLimitTracker = new CostTracker({ limitUsd: 1, enforceLimit: false });
            noLimitTracker.addCost({
                costUsd: 10,
                model: 'grok-4',
                inputTokens: 1000,
                outputTokens: 500,
            });
            expect(noLimitTracker.isWithinBudget(100)).toBe(true);
        });
    });
    describe('checkBudget', () => {
        it('should not throw when within budget', () => {
            expect(() => tracker.checkBudget(1)).not.toThrow();
        });
        it('should throw CostLimitExceededError when over budget', () => {
            tracker.addCost({
                costUsd: 9.5,
                model: 'grok-4',
                inputTokens: 1000,
                outputTokens: 500,
            });
            expect(() => tracker.checkBudget(1)).toThrow(CostLimitExceededError);
        });
        it('should include cost details in error', () => {
            tracker.addCost({
                costUsd: 9.5,
                model: 'grok-4',
                inputTokens: 1000,
                outputTokens: 500,
            });
            try {
                tracker.checkBudget(1);
                expect.fail('Should have thrown');
            }
            catch (error) {
                expect(error).toBeInstanceOf(CostLimitExceededError);
                const costError = error;
                expect(costError.currentCost).toBe(9.5);
                expect(costError.limit).toBe(10);
                expect(costError.estimatedCost).toBe(1);
            }
        });
    });
    describe('getRemainingBudget', () => {
        it('should return full budget initially', () => {
            expect(tracker.getRemainingBudget()).toBe(10);
        });
        it('should decrease as costs are added', () => {
            tracker.addCost({
                costUsd: 3,
                model: 'grok-4',
                inputTokens: 100,
                outputTokens: 100,
            });
            expect(tracker.getRemainingBudget()).toBe(7);
        });
        it('should not go negative', () => {
            tracker.addCost({
                costUsd: 15,
                model: 'grok-4',
                inputTokens: 1000,
                outputTokens: 1000,
            });
            expect(tracker.getRemainingBudget()).toBe(0);
        });
    });
    describe('reset', () => {
        it('should clear all costs and records', () => {
            tracker.addCost({
                costUsd: 5,
                model: 'grok-4',
                inputTokens: 500,
                outputTokens: 500,
            });
            tracker.reset();
            expect(tracker.getTotalCost()).toBe(0);
            expect(tracker.getRecords()).toHaveLength(0);
            expect(tracker.getRemainingBudget()).toBe(10);
        });
        it('should reset session start time', () => {
            vi.useFakeTimers();
            const time1 = new Date('2026-01-09T10:00:00Z');
            const time2 = new Date('2026-01-09T12:00:00Z');
            vi.setSystemTime(time1);
            const trackerWithTime = new CostTracker();
            expect(trackerWithTime.getSessionStartTime().getTime()).toBe(time1.getTime());
            vi.setSystemTime(time2);
            trackerWithTime.reset();
            expect(trackerWithTime.getSessionStartTime().getTime()).toBe(time2.getTime());
            vi.useRealTimers();
        });
    });
    describe('getUsageSummary', () => {
        it('should return empty summary initially', () => {
            const summary = tracker.getUsageSummary();
            expect(summary.totalCostUsd).toBe(0);
            expect(summary.queryCount).toBe(0);
            expect(summary.totalInputTokens).toBe(0);
            expect(summary.totalOutputTokens).toBe(0);
            expect(Object.keys(summary.byModel)).toHaveLength(0);
        });
        it('should aggregate costs by model', () => {
            tracker.addCost({
                costUsd: 0.001,
                model: 'grok-4-fast',
                inputTokens: 100,
                outputTokens: 200,
            });
            tracker.addCost({
                costUsd: 0.002,
                model: 'grok-4-fast',
                inputTokens: 150,
                outputTokens: 250,
            });
            tracker.addCost({
                costUsd: 0.01,
                model: 'grok-4',
                inputTokens: 50,
                outputTokens: 100,
            });
            const summary = tracker.getUsageSummary();
            expect(summary.byModel['grok-4-fast'].cost).toBe(0.003);
            expect(summary.byModel['grok-4-fast'].queries).toBe(2);
            expect(summary.byModel['grok-4-fast'].tokens).toBe(700); // 100+200+150+250
            expect(summary.byModel['grok-4'].cost).toBe(0.01);
            expect(summary.byModel['grok-4'].queries).toBe(1);
        });
        it('should calculate budget used percentage', () => {
            tracker.addCost({
                costUsd: 2.5,
                model: 'grok-4',
                inputTokens: 100,
                outputTokens: 100,
            });
            const summary = tracker.getUsageSummary();
            expect(summary.budgetUsedPercent).toBe(25);
        });
        it('should cap percentage at 100', () => {
            tracker.addCost({
                costUsd: 15,
                model: 'grok-4',
                inputTokens: 1000,
                outputTokens: 1000,
            });
            const summary = tracker.getUsageSummary();
            expect(summary.budgetUsedPercent).toBe(100);
        });
    });
    describe('getSessionDuration', () => {
        it('should track session duration', () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-01-09T10:00:00Z'));
            const durationTracker = new CostTracker();
            vi.advanceTimersByTime(5000);
            expect(durationTracker.getSessionDuration()).toBe(5000);
            vi.useRealTimers();
        });
    });
    describe('setOptions', () => {
        it('should update options at runtime', () => {
            tracker.setOptions({ limitUsd: 20 });
            expect(tracker.getOptions().limitUsd).toBe(20);
            tracker.setOptions({ enforceLimit: false });
            expect(tracker.getOptions().enforceLimit).toBe(false);
        });
    });
    describe('static estimateCost', () => {
        it('should estimate cost for known models', () => {
            // grok-4-fast-non-reasoning: $0.20/1M input, $0.50/1M output
            const cost = CostTracker.estimateCost('grok-4-fast-non-reasoning', 1000, 2000);
            const expected = (1000 / 1_000_000) * 0.2 + (2000 / 1_000_000) * 0.5;
            expect(cost).toBeCloseTo(expected, 10);
        });
        it('should use default pricing for unknown models', () => {
            // Unknown model defaults to $2/1M input, $10/1M output
            const cost = CostTracker.estimateCost('unknown-model', 1000, 1000);
            const expected = (1000 / 1_000_000) * 2.0 + (1000 / 1_000_000) * 10.0;
            expect(cost).toBeCloseTo(expected, 10);
        });
    });
    describe('static formatCost', () => {
        it('should format tiny costs with 6 decimals', () => {
            expect(CostTracker.formatCost(0.000001)).toBe('$0.000001');
        });
        it('should format small costs with 4 decimals', () => {
            expect(CostTracker.formatCost(0.0123)).toBe('$0.0123');
        });
        it('should format larger costs with 2 decimals', () => {
            expect(CostTracker.formatCost(1.5)).toBe('$1.50');
        });
    });
    describe('getBudgetWarning', () => {
        it('should return null when under 75%', () => {
            tracker.addCost({
                costUsd: 5,
                model: 'grok-4',
                inputTokens: 100,
                outputTokens: 100,
            });
            expect(tracker.getBudgetWarning()).toBeNull();
        });
        it('should return notice at 75%', () => {
            tracker.addCost({
                costUsd: 7.5,
                model: 'grok-4',
                inputTokens: 100,
                outputTokens: 100,
            });
            const warning = tracker.getBudgetWarning();
            expect(warning).toContain('Notice');
            expect(warning).toContain('75%');
        });
        it('should return warning at 90%', () => {
            tracker.addCost({
                costUsd: 9.5,
                model: 'grok-4',
                inputTokens: 100,
                outputTokens: 100,
            });
            const warning = tracker.getBudgetWarning();
            expect(warning).toContain('Warning');
            expect(warning).toContain('95%');
        });
    });
});
describe('CostLimitExceededError', () => {
    it('should include detailed message', () => {
        const error = new CostLimitExceededError(9.5, 10, 1);
        expect(error.message).toContain('9.5');
        expect(error.message).toContain('10');
        expect(error.message).toContain('Cost limit exceeded');
        expect(error.name).toBe('CostLimitExceededError');
    });
});
describe('getDefaultCostTrackerOptions', () => {
    const originalEnv = process.env;
    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
    });
    afterEach(() => {
        process.env = originalEnv;
    });
    it('should use defaults when env vars not set', () => {
        delete process.env.GROK_COST_LIMIT_USD;
        delete process.env.GROK_COST_LIMIT_ENFORCE;
        const options = getDefaultCostTrackerOptions();
        expect(options.limitUsd).toBe(10);
        expect(options.enforceLimit).toBe(true);
    });
    it('should read GROK_COST_LIMIT_USD from env', () => {
        process.env.GROK_COST_LIMIT_USD = '25';
        const options = getDefaultCostTrackerOptions();
        expect(options.limitUsd).toBe(25);
    });
    it('should read GROK_COST_LIMIT_ENFORCE from env', () => {
        process.env.GROK_COST_LIMIT_ENFORCE = 'false';
        const options = getDefaultCostTrackerOptions();
        expect(options.enforceLimit).toBe(false);
    });
});
describe('singleton functions', () => {
    afterEach(() => {
        resetDefaultCostTracker();
    });
    it('should return same instance from getDefaultCostTracker', () => {
        const tracker1 = getDefaultCostTracker();
        const tracker2 = getDefaultCostTracker();
        expect(tracker1).toBe(tracker2);
    });
    it('should create new instance after reset', () => {
        const tracker1 = getDefaultCostTracker();
        resetDefaultCostTracker();
        const tracker2 = getDefaultCostTracker();
        expect(tracker1).not.toBe(tracker2);
    });
});
describe('maxRecords circular buffer', () => {
    it('should trim oldest records when maxRecords exceeded', () => {
        const tracker = new CostTracker({ limitUsd: 100, enforceLimit: false, maxRecords: 3 });
        // Add 4 records
        for (let i = 1; i <= 4; i++) {
            tracker.addCost({
                costUsd: i * 0.01,
                model: `model-${i}`,
                inputTokens: 100,
                outputTokens: 100,
            });
        }
        const records = tracker.getRecords();
        expect(records.length).toBe(3);
        // First record should have been trimmed
        expect(records[0].model).toBe('model-2');
        expect(records[1].model).toBe('model-3');
        expect(records[2].model).toBe('model-4');
    });
    it('should preserve total cost even when records are trimmed', () => {
        const tracker = new CostTracker({ limitUsd: 100, enforceLimit: false, maxRecords: 2 });
        // Add 5 records
        for (let i = 1; i <= 5; i++) {
            tracker.addCost({
                costUsd: 1,
                model: 'grok-4',
                inputTokens: 100,
                outputTokens: 100,
            });
        }
        // Total cost should include ALL records
        expect(tracker.getTotalCost()).toBe(5);
        // But only 2 records should be stored
        expect(tracker.getRecords().length).toBe(2);
    });
    it('should allow setOptions to change maxRecords', () => {
        const tracker = new CostTracker({ limitUsd: 100, enforceLimit: false, maxRecords: 100 });
        // Add 10 records
        for (let i = 0; i < 10; i++) {
            tracker.addCost({
                costUsd: 0.01,
                model: `model-${i}`,
                inputTokens: 100,
                outputTokens: 100,
            });
        }
        expect(tracker.getRecords().length).toBe(10);
        // Reduce maxRecords - should trim oldest
        tracker.setOptions({ maxRecords: 3 });
        const records = tracker.getRecords();
        expect(records.length).toBe(3);
        expect(records[0].model).toBe('model-7');
        expect(records[1].model).toBe('model-8');
        expect(records[2].model).toBe('model-9');
    });
    it('should use default maxRecords from env or fallback to 10000', () => {
        const options = getDefaultCostTrackerOptions();
        expect(options.maxRecords).toBe(10000);
    });
    it('should include maxRecords in options', () => {
        const tracker = new CostTracker({ limitUsd: 10, enforceLimit: true, maxRecords: 500 });
        expect(tracker.getOptions().maxRecords).toBe(500);
    });
});
//# sourceMappingURL=cost-tracker.test.js.map
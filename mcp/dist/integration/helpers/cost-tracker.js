/**
 * Test Cost Tracker
 *
 * Provides detailed cost tracking for individual test scenarios.
 * Wraps the production CostTracker for test-specific functionality.
 *
 * @module integration/helpers/cost-tracker
 */
import { CostTracker } from '../../services/cost-tracker.js';
/**
 * Test-specific cost tracker with scenario isolation
 *
 * Provides per-scenario cost tracking with budget enforcement
 * and detailed summaries.
 *
 * @example
 * ```typescript
 * const tracker = new TestCostTracker('query tests', 0.01);
 *
 * // After API call
 * tracker.addCost('grok-4-fast', 100, 50);
 *
 * // Check status
 * if (!tracker.isWithinBudget(0.001)) {
 *   console.log('Budget exceeded');
 * }
 *
 * // Get summary
 * console.log(tracker.getSummary());
 * ```
 */
export class TestCostTracker {
    tracker;
    scenarioName;
    startTime;
    /**
     * Create a new test cost tracker
     *
     * @param scenarioName - Name of the test scenario
     * @param budgetUsd - Budget limit for this scenario (default: 0.01)
     */
    constructor(scenarioName, budgetUsd = 0.01) {
        this.scenarioName = scenarioName;
        this.startTime = Date.now();
        this.tracker = new CostTracker({
            limitUsd: budgetUsd,
            enforceLimit: true,
        });
    }
    /**
     * Add cost from API response
     *
     * @param model - Model used for the request
     * @param inputTokens - Number of input tokens
     * @param outputTokens - Number of output tokens
     * @returns The calculated cost in USD
     */
    addCost(model, inputTokens, outputTokens) {
        const cost = CostTracker.estimateCost(model, inputTokens, outputTokens);
        this.tracker.addCost({
            costUsd: cost,
            model,
            inputTokens,
            outputTokens,
        });
        return cost;
    }
    /**
     * Get total cost for this scenario
     *
     * @returns Total cost in USD
     */
    getTotalCost() {
        return this.tracker.getTotalCost();
    }
    /**
     * Check if within budget
     *
     * @param additionalCost - Optional additional cost to check (default: 0)
     * @returns True if within budget
     */
    isWithinBudget(additionalCost = 0) {
        return this.tracker.isWithinBudget(additionalCost);
    }
    /**
     * Get warning message if approaching limit
     *
     * @returns Warning message or null if not near limit
     */
    getWarning() {
        return this.tracker.getBudgetWarning();
    }
    /**
     * Get detailed summary
     *
     * @returns Summary object with scenario details
     */
    getSummary() {
        const summary = this.tracker.getUsageSummary();
        return {
            scenario: this.scenarioName,
            cost: summary.totalCostUsd,
            duration: Date.now() - this.startTime,
            queries: summary.queryCount,
        };
    }
    /**
     * Get the remaining budget
     *
     * @returns Remaining budget in USD
     */
    getRemainingBudget() {
        return this.tracker.getRemainingBudget();
    }
    /**
     * Reset tracker for a new test
     */
    reset() {
        this.tracker.reset();
        this.startTime = Date.now();
    }
    /**
     * Get the underlying tracker options
     *
     * @returns Tracker configuration options
     */
    getOptions() {
        return this.tracker.getOptions();
    }
}
/**
 * Format cost for display
 *
 * @param costUsd - Cost in USD
 * @returns Formatted string (e.g., "$0.000123")
 */
export function formatCost(costUsd) {
    if (costUsd < 0.000001)
        return '$0.000000';
    if (costUsd < 0.01)
        return `$${costUsd.toFixed(6)}`;
    return `$${costUsd.toFixed(4)}`;
}
/**
 * Assert cost is within expected range
 *
 * @param actual - Actual cost
 * @param expected - Expected cost
 * @param tolerance - Tolerance as a decimal (default: 0.5 = 50%)
 * @throws Error if cost is outside range
 */
export function assertCostInRange(actual, expected, tolerance = 0.5) {
    const min = expected * (1 - tolerance);
    const max = expected * (1 + tolerance);
    if (actual < min || actual > max) {
        throw new Error(`Cost ${formatCost(actual)} outside expected range ` +
            `${formatCost(min)} - ${formatCost(max)} (expected ${formatCost(expected)} +/-${tolerance * 100}%)`);
    }
}
/**
 * Calculate cost for given tokens and model
 *
 * @param model - Model name
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @returns Cost in USD
 */
export function calculateCost(model, inputTokens, outputTokens) {
    return CostTracker.estimateCost(model, inputTokens, outputTokens);
}
//# sourceMappingURL=cost-tracker.js.map
/**
 * Test Cost Tracker
 *
 * Provides detailed cost tracking for individual test scenarios.
 * Wraps the production CostTracker for test-specific functionality.
 *
 * @module integration/helpers/cost-tracker
 */
import { CostTrackerOptions } from '../../services/cost-tracker.js';
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
export declare class TestCostTracker {
    private tracker;
    private scenarioName;
    private startTime;
    /**
     * Create a new test cost tracker
     *
     * @param scenarioName - Name of the test scenario
     * @param budgetUsd - Budget limit for this scenario (default: 0.01)
     */
    constructor(scenarioName: string, budgetUsd?: number);
    /**
     * Add cost from API response
     *
     * @param model - Model used for the request
     * @param inputTokens - Number of input tokens
     * @param outputTokens - Number of output tokens
     * @returns The calculated cost in USD
     */
    addCost(model: string, inputTokens: number, outputTokens: number): number;
    /**
     * Get total cost for this scenario
     *
     * @returns Total cost in USD
     */
    getTotalCost(): number;
    /**
     * Check if within budget
     *
     * @param additionalCost - Optional additional cost to check (default: 0)
     * @returns True if within budget
     */
    isWithinBudget(additionalCost?: number): boolean;
    /**
     * Get warning message if approaching limit
     *
     * @returns Warning message or null if not near limit
     */
    getWarning(): string | null;
    /**
     * Get detailed summary
     *
     * @returns Summary object with scenario details
     */
    getSummary(): {
        scenario: string;
        cost: number;
        duration: number;
        queries: number;
    };
    /**
     * Get the remaining budget
     *
     * @returns Remaining budget in USD
     */
    getRemainingBudget(): number;
    /**
     * Reset tracker for a new test
     */
    reset(): void;
    /**
     * Get the underlying tracker options
     *
     * @returns Tracker configuration options
     */
    getOptions(): Readonly<CostTrackerOptions>;
}
/**
 * Format cost for display
 *
 * @param costUsd - Cost in USD
 * @returns Formatted string (e.g., "$0.000123")
 */
export declare function formatCost(costUsd: number): string;
/**
 * Assert cost is within expected range
 *
 * @param actual - Actual cost
 * @param expected - Expected cost
 * @param tolerance - Tolerance as a decimal (default: 0.5 = 50%)
 * @throws Error if cost is outside range
 */
export declare function assertCostInRange(actual: number, expected: number, tolerance?: number): void;
/**
 * Calculate cost for given tokens and model
 *
 * @param model - Model name
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @returns Cost in USD
 */
export declare function calculateCost(model: string, inputTokens: number, outputTokens: number): number;
//# sourceMappingURL=cost-tracker.d.ts.map
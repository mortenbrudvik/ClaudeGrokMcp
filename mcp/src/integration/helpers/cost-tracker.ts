/**
 * Test Cost Tracker
 *
 * Provides detailed cost tracking for individual test scenarios.
 * Wraps the production CostTracker for test-specific functionality.
 *
 * @module integration/helpers/cost-tracker
 */
import { CostTracker, CostTrackerOptions } from '../../services/cost-tracker.js';

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
  private tracker: CostTracker;
  private scenarioName: string;
  private startTime: number;

  /**
   * Create a new test cost tracker
   *
   * @param scenarioName - Name of the test scenario
   * @param budgetUsd - Budget limit for this scenario (default: 0.01)
   */
  constructor(scenarioName: string, budgetUsd: number = 0.01) {
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
  addCost(model: string, inputTokens: number, outputTokens: number): number {
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
  getTotalCost(): number {
    return this.tracker.getTotalCost();
  }

  /**
   * Check if within budget
   *
   * @param additionalCost - Optional additional cost to check (default: 0)
   * @returns True if within budget
   */
  isWithinBudget(additionalCost: number = 0): boolean {
    return this.tracker.isWithinBudget(additionalCost);
  }

  /**
   * Get warning message if approaching limit
   *
   * @returns Warning message or null if not near limit
   */
  getWarning(): string | null {
    return this.tracker.getBudgetWarning();
  }

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
  } {
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
  getRemainingBudget(): number {
    return this.tracker.getRemainingBudget();
  }

  /**
   * Reset tracker for a new test
   */
  reset(): void {
    this.tracker.reset();
    this.startTime = Date.now();
  }

  /**
   * Get the underlying tracker options
   *
   * @returns Tracker configuration options
   */
  getOptions(): Readonly<CostTrackerOptions> {
    return this.tracker.getOptions();
  }
}

/**
 * Format cost for display
 *
 * @param costUsd - Cost in USD
 * @returns Formatted string (e.g., "$0.000123")
 */
export function formatCost(costUsd: number): string {
  if (costUsd < 0.000001) return '$0.000000';
  if (costUsd < 0.01) return `$${costUsd.toFixed(6)}`;
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
export function assertCostInRange(actual: number, expected: number, tolerance: number = 0.5): void {
  const min = expected * (1 - tolerance);
  const max = expected * (1 + tolerance);

  if (actual < min || actual > max) {
    throw new Error(
      `Cost ${formatCost(actual)} outside expected range ` +
        `${formatCost(min)} - ${formatCost(max)} (expected ${formatCost(expected)} +/-${tolerance * 100}%)`
    );
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
export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  return CostTracker.estimateCost(model, inputTokens, outputTokens);
}

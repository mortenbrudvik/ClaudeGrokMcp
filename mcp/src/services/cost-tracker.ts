/**
 * Cost Tracker Service
 *
 * Tracks cumulative costs across a session and enforces budget limits
 * to prevent runaway API costs.
 *
 * @module services/cost-tracker
 */

import { CostEstimate, MODEL_PRICING } from '../types/index.js';

/**
 * Configuration options for the cost tracker
 */
export interface CostTrackerOptions {
  /** Maximum cost limit in USD for the session (default: 10) */
  limitUsd: number;
  /** Whether to enforce the limit (default: true) */
  enforceLimit: boolean;
  /** Maximum number of records to store (default: 10000) */
  maxRecords: number;
}

/**
 * Record of a single query's cost
 */
export interface CostRecord {
  /** Timestamp when the cost was recorded */
  timestamp: number;
  /** The cost in USD */
  costUsd: number;
  /** Model used for the query */
  model: string;
  /** Input tokens used */
  inputTokens: number;
  /** Output tokens used */
  outputTokens: number;
}

/**
 * Summary of usage statistics
 */
export interface UsageSummary {
  /** Total cost in USD */
  totalCostUsd: number;
  /** Configured limit in USD */
  limitUsd: number;
  /** Remaining budget in USD */
  remainingBudgetUsd: number;
  /** Total number of queries */
  queryCount: number;
  /** Total input tokens used */
  totalInputTokens: number;
  /** Total output tokens used */
  totalOutputTokens: number;
  /** Cost breakdown by model */
  byModel: Record<string, { cost: number; queries: number; tokens: number }>;
  /** Whether limit enforcement is active */
  limitEnforced: boolean;
  /** Percentage of budget used */
  budgetUsedPercent: number;
}

/**
 * Error thrown when cost limit is exceeded
 */
export class CostLimitExceededError extends Error {
  constructor(
    public currentCost: number,
    public limit: number,
    public estimatedCost: number
  ) {
    super(
      `Cost limit exceeded: Current session cost is $${currentCost.toFixed(4)} of $${limit.toFixed(2)} limit. ` +
        `Estimated cost of this request: $${estimatedCost.toFixed(4)}. ` +
        `Remaining budget: $${Math.max(0, limit - currentCost).toFixed(4)}.`
    );
    this.name = 'CostLimitExceededError';
  }
}

/**
 * Default options loaded from environment variables
 */
export function getDefaultCostTrackerOptions(): CostTrackerOptions {
  return {
    limitUsd: parseFloat(process.env.GROK_COST_LIMIT_USD || '10'),
    enforceLimit: process.env.GROK_COST_LIMIT_ENFORCE !== 'false',
    maxRecords: parseInt(process.env.GROK_COST_MAX_RECORDS || '10000', 10),
  };
}

/**
 * Cost Tracker for Grok API sessions
 *
 * Provides:
 * - Session-level cumulative cost tracking
 * - Budget limit enforcement
 * - Per-model usage breakdown
 * - Cost estimation before queries
 *
 * @example
 * ```typescript
 * const tracker = new CostTracker({ limitUsd: 5 });
 *
 * // Before making a query, check if within budget
 * const estimatedCost = 0.001;
 * if (!tracker.isWithinBudget(estimatedCost)) {
 *   throw new Error('Budget exceeded');
 * }
 *
 * // After query completes, record the cost
 * tracker.addCost({
 *   costUsd: 0.0008,
 *   model: 'grok-4-fast',
 *   inputTokens: 100,
 *   outputTokens: 200,
 * });
 * ```
 */
export class CostTracker {
  private options: CostTrackerOptions;
  private records: CostRecord[] = [];
  private totalCost: number = 0;
  private sessionStartTime: number;

  constructor(options?: Partial<CostTrackerOptions>) {
    const defaults = getDefaultCostTrackerOptions();
    this.options = {
      limitUsd: options?.limitUsd ?? defaults.limitUsd,
      enforceLimit: options?.enforceLimit ?? defaults.enforceLimit,
      maxRecords: options?.maxRecords ?? defaults.maxRecords,
    };
    this.sessionStartTime = Date.now();
  }

  /**
   * Add a cost record to the tracker
   *
   * Uses circular buffer behavior - oldest records are removed when maxRecords is reached.
   * Note: totalCost still includes all costs (not just records in memory).
   *
   * @param record - Cost information from a completed query
   */
  addCost(record: Omit<CostRecord, 'timestamp'>): void {
    const fullRecord: CostRecord = {
      ...record,
      timestamp: Date.now(),
    };

    // Trim oldest record if at max capacity
    if (this.records.length >= this.options.maxRecords) {
      this.records.shift();
    }

    this.records.push(fullRecord);
    this.totalCost += record.costUsd;
  }

  /**
   * Add cost from a CostEstimate object
   *
   * @param estimate - Cost estimate from a query response
   */
  addFromEstimate(estimate: CostEstimate): void {
    this.addCost({
      costUsd: estimate.estimated_usd,
      model: estimate.model,
      inputTokens: estimate.input_tokens,
      outputTokens: estimate.output_tokens,
    });
  }

  /**
   * Get the total cost for this session
   */
  getTotalCost(): number {
    return this.totalCost;
  }

  /**
   * Get the remaining budget
   */
  getRemainingBudget(): number {
    return Math.max(0, this.options.limitUsd - this.totalCost);
  }

  /**
   * Check if an estimated cost is within the remaining budget
   *
   * @param estimatedCost - The estimated cost of the next query
   * @returns True if the query can proceed within budget
   */
  isWithinBudget(estimatedCost: number): boolean {
    if (!this.options.enforceLimit) {
      return true;
    }
    return this.totalCost + estimatedCost <= this.options.limitUsd;
  }

  /**
   * Check budget and throw if exceeded
   *
   * @param estimatedCost - The estimated cost to check
   * @throws CostLimitExceededError if budget would be exceeded
   */
  checkBudget(estimatedCost: number): void {
    if (!this.isWithinBudget(estimatedCost)) {
      throw new CostLimitExceededError(this.totalCost, this.options.limitUsd, estimatedCost);
    }
  }

  /**
   * Reset the tracker for a new session
   */
  reset(): void {
    this.records = [];
    this.totalCost = 0;
    this.sessionStartTime = Date.now();
  }

  /**
   * Get a summary of usage statistics
   */
  getUsageSummary(): UsageSummary {
    // Calculate per-model breakdown
    const byModel: Record<string, { cost: number; queries: number; tokens: number }> = {};

    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (const record of this.records) {
      totalInputTokens += record.inputTokens;
      totalOutputTokens += record.outputTokens;

      if (!byModel[record.model]) {
        byModel[record.model] = { cost: 0, queries: 0, tokens: 0 };
      }
      byModel[record.model].cost += record.costUsd;
      byModel[record.model].queries += 1;
      byModel[record.model].tokens += record.inputTokens + record.outputTokens;
    }

    const remainingBudget = this.getRemainingBudget();
    const budgetUsedPercent =
      this.options.limitUsd > 0
        ? Math.min(100, Math.round((this.totalCost / this.options.limitUsd) * 100))
        : 0;

    return {
      totalCostUsd: this.totalCost,
      limitUsd: this.options.limitUsd,
      remainingBudgetUsd: remainingBudget,
      queryCount: this.records.length,
      totalInputTokens,
      totalOutputTokens,
      byModel,
      limitEnforced: this.options.enforceLimit,
      budgetUsedPercent,
    };
  }

  /**
   * Get all cost records
   */
  getRecords(): Readonly<CostRecord[]> {
    return [...this.records];
  }

  /**
   * Get the session start time
   */
  getSessionStartTime(): Date {
    return new Date(this.sessionStartTime);
  }

  /**
   * Get session duration in milliseconds
   */
  getSessionDuration(): number {
    return Date.now() - this.sessionStartTime;
  }

  /**
   * Update options at runtime
   */
  setOptions(options: Partial<CostTrackerOptions>): void {
    if (options.limitUsd !== undefined) {
      this.options.limitUsd = options.limitUsd;
    }
    if (options.enforceLimit !== undefined) {
      this.options.enforceLimit = options.enforceLimit;
    }
    if (options.maxRecords !== undefined) {
      this.options.maxRecords = options.maxRecords;
      // Trim excess records if new max is smaller
      while (this.records.length > this.options.maxRecords) {
        this.records.shift();
      }
    }
  }

  /**
   * Get current options
   */
  getOptions(): Readonly<CostTrackerOptions> {
    return { ...this.options };
  }

  /**
   * Estimate cost for a query based on token counts
   *
   * @param model - The model to use
   * @param inputTokens - Estimated input tokens
   * @param outputTokens - Estimated output tokens
   * @returns Estimated cost in USD
   */
  static estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = MODEL_PRICING[model] || { input: 2.0, output: 10.0 }; // Default to mid-range
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    return inputCost + outputCost;
  }

  /**
   * Format a cost value as a human-readable string
   */
  static formatCost(costUsd: number): string {
    if (costUsd < 0.01) {
      return `$${costUsd.toFixed(6)}`;
    } else if (costUsd < 1) {
      return `$${costUsd.toFixed(4)}`;
    } else {
      return `$${costUsd.toFixed(2)}`;
    }
  }

  /**
   * Get a warning message if approaching budget limit
   *
   * @returns Warning message or null if not near limit
   */
  getBudgetWarning(): string | null {
    const percentUsed = (this.totalCost / this.options.limitUsd) * 100;

    if (percentUsed >= 90) {
      return `Warning: ${percentUsed.toFixed(0)}% of budget used ($${this.totalCost.toFixed(4)}/$${this.options.limitUsd.toFixed(2)})`;
    } else if (percentUsed >= 75) {
      return `Notice: ${percentUsed.toFixed(0)}% of budget used`;
    }

    return null;
  }
}

/**
 * Singleton instance for shared use
 */
let defaultTrackerInstance: CostTracker | null = null;

/**
 * Get or create the default cost tracker instance
 */
export function getDefaultCostTracker(): CostTracker {
  if (!defaultTrackerInstance) {
    defaultTrackerInstance = new CostTracker();
  }
  return defaultTrackerInstance;
}

/**
 * Reset the default tracker instance
 */
export function resetDefaultCostTracker(): void {
  defaultTrackerInstance = null;
}

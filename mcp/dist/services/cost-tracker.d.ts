/**
 * Cost Tracker Service
 *
 * Tracks cumulative costs across a session and enforces budget limits
 * to prevent runaway API costs.
 *
 * @module services/cost-tracker
 */
import { CostEstimate } from '../types/index.js';
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
    byModel: Record<string, {
        cost: number;
        queries: number;
        tokens: number;
    }>;
    /** Whether limit enforcement is active */
    limitEnforced: boolean;
    /** Percentage of budget used */
    budgetUsedPercent: number;
}
/**
 * Error thrown when cost limit is exceeded
 */
export declare class CostLimitExceededError extends Error {
    currentCost: number;
    limit: number;
    estimatedCost: number;
    constructor(currentCost: number, limit: number, estimatedCost: number);
}
/**
 * Default options loaded from environment variables
 */
export declare function getDefaultCostTrackerOptions(): CostTrackerOptions;
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
export declare class CostTracker {
    private options;
    private records;
    private totalCost;
    private sessionStartTime;
    constructor(options?: Partial<CostTrackerOptions>);
    /**
     * Add a cost record to the tracker
     *
     * Uses circular buffer behavior - oldest records are removed when maxRecords is reached.
     * Note: totalCost still includes all costs (not just records in memory).
     *
     * @param record - Cost information from a completed query
     */
    addCost(record: Omit<CostRecord, 'timestamp'>): void;
    /**
     * Add cost from a CostEstimate object
     *
     * @param estimate - Cost estimate from a query response
     */
    addFromEstimate(estimate: CostEstimate): void;
    /**
     * Get the total cost for this session
     */
    getTotalCost(): number;
    /**
     * Get the remaining budget
     */
    getRemainingBudget(): number;
    /**
     * Check if an estimated cost is within the remaining budget
     *
     * @param estimatedCost - The estimated cost of the next query
     * @returns True if the query can proceed within budget
     */
    isWithinBudget(estimatedCost: number): boolean;
    /**
     * Check budget and throw if exceeded
     *
     * @param estimatedCost - The estimated cost to check
     * @throws CostLimitExceededError if budget would be exceeded
     */
    checkBudget(estimatedCost: number): void;
    /**
     * Reset the tracker for a new session
     */
    reset(): void;
    /**
     * Get a summary of usage statistics
     */
    getUsageSummary(): UsageSummary;
    /**
     * Get all cost records
     */
    getRecords(): Readonly<CostRecord[]>;
    /**
     * Get the session start time
     */
    getSessionStartTime(): Date;
    /**
     * Get session duration in milliseconds
     */
    getSessionDuration(): number;
    /**
     * Update options at runtime
     */
    setOptions(options: Partial<CostTrackerOptions>): void;
    /**
     * Get current options
     */
    getOptions(): Readonly<CostTrackerOptions>;
    /**
     * Estimate cost for a query based on token counts
     *
     * @param model - The model to use
     * @param inputTokens - Estimated input tokens
     * @param outputTokens - Estimated output tokens
     * @returns Estimated cost in USD
     */
    static estimateCost(model: string, inputTokens: number, outputTokens: number): number;
    /**
     * Format a cost value as a human-readable string
     */
    static formatCost(costUsd: number): string;
    /**
     * Get a warning message if approaching budget limit
     *
     * @returns Warning message or null if not near limit
     */
    getBudgetWarning(): string | null;
}
/**
 * Get or create the default cost tracker instance
 */
export declare function getDefaultCostTracker(): CostTracker;
/**
 * Reset the default tracker instance
 */
export declare function resetDefaultCostTracker(): void;
//# sourceMappingURL=cost-tracker.d.ts.map
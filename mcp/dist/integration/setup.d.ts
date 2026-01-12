interface CostRecord {
    testName: string;
    cost: number;
    model: string;
    inputTokens: number;
    outputTokens: number;
    timestamp: number;
}
/**
 * Record cost from an API call
 *
 * @param testName - Name of the test that made the call
 * @param cost - Cost in USD
 * @param model - Model used
 * @param inputTokens - Input token count
 * @param outputTokens - Output token count
 */
export declare function recordCost(testName: string, cost: number, model: string, inputTokens: number, outputTokens: number): void;
/**
 * Check if API is available
 *
 * @returns True if API is reachable and key is valid
 */
export declare function isApiAvailable(): boolean;
/**
 * Skip test if API is unavailable
 *
 * @returns True if test should be skipped
 */
export declare function skipIfApiUnavailable(): boolean;
/**
 * Get current cost total
 *
 * @returns Total cost so far in USD
 */
export declare function getCurrentCost(): number;
/**
 * Get remaining budget
 *
 * @returns Remaining budget in USD
 */
export declare function getRemainingBudget(): number;
/**
 * Check if budget allows for estimated cost
 *
 * @param estimatedCost - Estimated cost of next operation
 * @returns True if budget can accommodate the cost
 */
export declare function canAfford(estimatedCost: number): boolean;
/**
 * Get the maximum test budget
 *
 * @returns Maximum budget in USD
 */
export declare function getMaxBudget(): number;
/**
 * Get all cost records
 *
 * @returns Array of all recorded costs
 */
export declare function getCostRecords(): Readonly<CostRecord[]>;
export {};
//# sourceMappingURL=setup.d.ts.map
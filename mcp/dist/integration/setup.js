/**
 * Live Integration Test Setup
 *
 * Validates API connectivity, tracks costs, enforces budget limits.
 * This file is auto-loaded by Vitest for all live tests.
 *
 * @module integration/setup
 */
import { beforeAll, afterAll } from 'vitest';
// Configuration
const MAX_TEST_BUDGET_USD = 0.1;
const API_BASE_URL = 'https://api.x.ai/v1';
const testCosts = [];
let apiAvailable = true;
let apiKeyValid = true;
/**
 * Pre-flight checks before any tests run
 */
beforeAll(async () => {
    // 1. Verify API key is set
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
        throw new Error('XAI_API_KEY environment variable is required for live tests.\n' +
            'Set it with: export XAI_API_KEY=xai-your-key-here\n' +
            'Or run unit tests instead: npm run test');
    }
    // 2. Validate API key format
    if (!apiKey.startsWith('xai-')) {
        console.warn('Warning: XAI_API_KEY does not start with "xai-" - may be invalid');
    }
    // 3. Check API availability
    try {
        const response = await fetch(`${API_BASE_URL}/models`, {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(10000),
        });
        if (response.status === 401) {
            apiKeyValid = false;
            throw new Error('XAI_API_KEY is invalid (401 Unauthorized)');
        }
        if (!response.ok) {
            console.warn(`xAI API returned ${response.status} - some tests may fail`);
        }
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('401')) {
            throw error; // Re-throw auth errors
        }
        apiAvailable = false;
        console.warn('xAI API unreachable - tests requiring API will be skipped');
    }
    // 4. Log test run start
    console.log('\n========================================');
    console.log('  LIVE INTEGRATION TESTS');
    console.log(`  Budget: $${MAX_TEST_BUDGET_USD.toFixed(2)}`);
    console.log(`  API: ${apiAvailable ? 'Available' : 'Unavailable'}`);
    console.log('========================================\n');
});
/**
 * Clean up and report after all tests complete
 */
afterAll(() => {
    const totalCost = testCosts.reduce((sum, r) => sum + r.cost, 0);
    const totalInputTokens = testCosts.reduce((sum, r) => sum + r.inputTokens, 0);
    const totalOutputTokens = testCosts.reduce((sum, r) => sum + r.outputTokens, 0);
    // Cost report
    console.log('\n========================================');
    console.log('  TEST RUN SUMMARY');
    console.log('========================================');
    console.log(`  Total Cost:    $${totalCost.toFixed(6)}`);
    console.log(`  Budget:        $${MAX_TEST_BUDGET_USD.toFixed(2)}`);
    console.log(`  Budget Used:   ${((totalCost / MAX_TEST_BUDGET_USD) * 100).toFixed(1)}%`);
    console.log(`  Input Tokens:  ${totalInputTokens.toLocaleString()}`);
    console.log(`  Output Tokens: ${totalOutputTokens.toLocaleString()}`);
    console.log(`  API Calls:     ${testCosts.length}`);
    console.log('========================================\n');
    // Budget enforcement
    if (totalCost > MAX_TEST_BUDGET_USD) {
        throw new Error(`Test run exceeded budget: $${totalCost.toFixed(6)} > $${MAX_TEST_BUDGET_USD}\n` +
            'Consider using cheaper models or reducing test scope.');
    }
});
// ============ Exported Utilities ============
/**
 * Record cost from an API call
 *
 * @param testName - Name of the test that made the call
 * @param cost - Cost in USD
 * @param model - Model used
 * @param inputTokens - Input token count
 * @param outputTokens - Output token count
 */
export function recordCost(testName, cost, model, inputTokens, outputTokens) {
    testCosts.push({
        testName,
        cost,
        model,
        inputTokens,
        outputTokens,
        timestamp: Date.now(),
    });
}
/**
 * Check if API is available
 *
 * @returns True if API is reachable and key is valid
 */
export function isApiAvailable() {
    return apiAvailable && apiKeyValid;
}
/**
 * Skip test if API is unavailable
 *
 * @returns True if test should be skipped
 */
export function skipIfApiUnavailable() {
    if (!isApiAvailable()) {
        console.log('  [SKIPPED] API unavailable');
        return true;
    }
    return false;
}
/**
 * Get current cost total
 *
 * @returns Total cost so far in USD
 */
export function getCurrentCost() {
    return testCosts.reduce((sum, r) => sum + r.cost, 0);
}
/**
 * Get remaining budget
 *
 * @returns Remaining budget in USD
 */
export function getRemainingBudget() {
    return MAX_TEST_BUDGET_USD - getCurrentCost();
}
/**
 * Check if budget allows for estimated cost
 *
 * @param estimatedCost - Estimated cost of next operation
 * @returns True if budget can accommodate the cost
 */
export function canAfford(estimatedCost) {
    return getCurrentCost() + estimatedCost <= MAX_TEST_BUDGET_USD;
}
/**
 * Get the maximum test budget
 *
 * @returns Maximum budget in USD
 */
export function getMaxBudget() {
    return MAX_TEST_BUDGET_USD;
}
/**
 * Get all cost records
 *
 * @returns Array of all recorded costs
 */
export function getCostRecords() {
    return [...testCosts];
}
//# sourceMappingURL=setup.js.map
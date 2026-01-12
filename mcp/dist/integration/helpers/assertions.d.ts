interface CustomMatchers<R = unknown> {
    toHaveValidUsage(): R;
    toContainCostInfo(): R;
    toBeWithinTolerance(expected: number, tolerancePercent?: number): R;
    toBeXAIError(expectedStatus?: number): R;
    toBeValidCompletion(): R;
    toBeReasonableResponseTime(maxMs?: number): R;
}
declare module 'vitest' {
    interface Assertion<T = any> extends CustomMatchers<T> {
    }
    interface AsymmetricMatchersContaining extends CustomMatchers {
    }
}
export {};
//# sourceMappingURL=assertions.d.ts.map
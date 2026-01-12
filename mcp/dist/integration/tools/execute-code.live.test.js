/**
 * grok_execute_code Tool Live Integration Tests
 *
 * Validates server-side Python code execution against real xAI API.
 * Uses Agent Tools API (/v1/responses) with code_interpreter tool.
 *
 * @module integration/tools/execute-code.live.test
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { handleGrokExecuteCode } from '../../tools/execute-code.js';
import { isApiAvailable, skipIfApiUnavailable } from '../setup.js';
import { createTestClient, extractModelFromResponse } from '../helpers/api-client.js';
import { withRateLimit } from '../helpers/rate-limiter.js';
import '../helpers/assertions.js';
describe('grok_execute_code (live)', () => {
    let client;
    beforeAll(() => {
        if (!isApiAvailable())
            return;
        client = createTestClient();
    });
    describe('basic execution', () => {
        it('should execute simple print statement', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokExecuteCode(client, {
                code: 'print(2 + 2)',
                max_turns: 1,
            }));
            expect(result.content).toBeDefined();
            expect(result.content[0].type).toBe('text');
            const text = result.content[0].text;
            expect(text).toContain('Code Execution Results');
            // Should contain the answer (4) somewhere
            expect(text).toContain('4');
        });
        it('should execute arithmetic calculations', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokExecuteCode(client, {
                code: `
result = 15 * 7 + 3
print(f"Result: {result}")
`,
                max_turns: 1,
            }));
            expect(result.content).toBeDefined();
            const text = result.content[0].text;
            expect(text).toContain('Code Execution Results');
            expect(text).toContain('108');
        });
        it('should execute code with variables', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokExecuteCode(client, {
                code: `
name = "World"
greeting = f"Hello, {name}!"
print(greeting)
`,
                max_turns: 1,
            }));
            expect(result.content).toBeDefined();
            const text = result.content[0].text;
            expect(text).toContain('Code Execution Results');
            expect(text.toLowerCase()).toContain('hello');
        });
    });
    describe('with description', () => {
        it('should use description as context', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokExecuteCode(client, {
                code: `
def is_prime(n):
    if n < 2:
        return False
    for i in range(2, int(n**0.5) + 1):
        if n % i == 0:
            return False
    return True

primes = [n for n in range(2, 30) if is_prime(n)]
print(f"Primes under 30: {primes}")
`,
                description: 'Find all prime numbers under 30',
                max_turns: 1,
            }));
            expect(result.content).toBeDefined();
            const text = result.content[0].text;
            expect(text).toContain('Code Execution Results');
            // Should contain some of the primes
            expect(text).toMatch(/2|3|5|7|11|13|17|19|23|29/);
        });
    });
    describe('response metadata', () => {
        it('should include model information', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokExecuteCode(client, {
                code: 'print("test")',
                max_turns: 1,
            }));
            const text = result.content[0].text;
            const model = extractModelFromResponse(text);
            expect(model).not.toBeNull();
            expect(model.toLowerCase()).toContain('grok');
        });
        it('should include cost information', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokExecuteCode(client, {
                code: 'print("cost test")',
                max_turns: 1,
            }));
            const text = result.content[0].text;
            // Check that cost info is present in the response
            // Format: "$X.XXXX"
            expect(text).toMatch(/\$[\d.]+/);
        });
        it('should include token usage', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokExecuteCode(client, {
                code: 'print("token test")',
                max_turns: 1,
            }));
            const text = result.content[0].text;
            expect(text).toMatch(/\d+\s*tokens/i);
        });
        it('should include response time', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokExecuteCode(client, {
                code: 'print("timing test")',
                max_turns: 1,
            }));
            const text = result.content[0].text;
            expect(text).toMatch(/\d+ms/);
        });
    });
    describe('execution output', () => {
        it('should capture stdout', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokExecuteCode(client, {
                code: `
print("Line 1")
print("Line 2")
print("Line 3")
`,
                include_output: true,
                max_turns: 1,
            }));
            expect(result.content).toBeDefined();
            const text = result.content[0].text;
            expect(text).toContain('Code Execution Results');
            // Should capture the output
            expect(text).toMatch(/line\s*1/i);
        });
        it('should handle multi-line output', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokExecuteCode(client, {
                code: `
for i in range(5):
    print(f"Count: {i}")
`,
                include_output: true,
                max_turns: 1,
            }));
            expect(result.content).toBeDefined();
            const text = result.content[0].text;
            expect(text).toContain('Code Execution Results');
        });
    });
    describe('error handling', () => {
        it('should detect and report syntax errors', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokExecuteCode(client, {
                code: 'print("unclosed string',
                max_turns: 1,
            }));
            expect(result.content).toBeDefined();
            const text = result.content[0].text.toLowerCase();
            // Should indicate an error occurred
            expect(text).toMatch(/error|syntax|invalid/);
        });
        it('should detect and report runtime errors', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokExecuteCode(client, {
                code: 'result = 1 / 0',
                max_turns: 1,
            }));
            expect(result.content).toBeDefined();
            const text = result.content[0].text.toLowerCase();
            // Should indicate a division error
            expect(text).toMatch(/error|zero|division/);
        });
        it('should detect undefined variable errors', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokExecuteCode(client, {
                code: 'print(undefined_variable)',
                max_turns: 1,
            }));
            expect(result.content).toBeDefined();
            const text = result.content[0].text.toLowerCase();
            // Should indicate a name error
            expect(text).toMatch(/error|undefined|not defined|name/);
        });
        it('should handle empty code gracefully', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await handleGrokExecuteCode(client, {
                code: '',
            });
            expect(result.content).toBeDefined();
            const text = result.content[0].text.toLowerCase();
            expect(text).toMatch(/error|failed|required|empty/);
        });
        it('should handle missing code parameter', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await handleGrokExecuteCode(client, {});
            expect(result.content).toBeDefined();
            const text = result.content[0].text.toLowerCase();
            expect(text).toMatch(/error|failed|required/);
        });
    });
    describe('data structures', () => {
        it('should work with lists', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokExecuteCode(client, {
                code: `
numbers = [1, 2, 3, 4, 5]
total = sum(numbers)
print(f"Sum: {total}")
`,
                max_turns: 1,
            }));
            expect(result.content).toBeDefined();
            const text = result.content[0].text;
            expect(text).toContain('15');
        });
        it('should work with dictionaries', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokExecuteCode(client, {
                code: `
data = {"a": 1, "b": 2, "c": 3}
for key, value in data.items():
    print(f"{key}: {value}")
`,
                max_turns: 1,
            }));
            expect(result.content).toBeDefined();
            const text = result.content[0].text;
            expect(text).toContain('Code Execution Results');
        });
    });
    describe('standard library', () => {
        it('should have access to math module', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokExecuteCode(client, {
                code: `
import math
print(f"Pi: {math.pi:.4f}")
print(f"sqrt(16): {math.sqrt(16)}")
`,
                max_turns: 1,
            }));
            expect(result.content).toBeDefined();
            const text = result.content[0].text;
            expect(text).toContain('3.14');
            expect(text).toContain('4');
        });
        it('should have access to json module', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokExecuteCode(client, {
                code: `
import json
data = {"name": "test", "value": 42}
print(json.dumps(data))
`,
                max_turns: 1,
            }));
            expect(result.content).toBeDefined();
            const text = result.content[0].text;
            expect(text).toContain('test');
            expect(text).toContain('42');
        });
        it('should have access to datetime module', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokExecuteCode(client, {
                code: `
from datetime import datetime
now = datetime.now()
print(f"Year: {now.year}")
`,
                max_turns: 1,
            }));
            expect(result.content).toBeDefined();
            const text = result.content[0].text;
            // Should show a year (2024, 2025, 2026, etc.)
            expect(text).toMatch(/20\d{2}/);
        });
    });
    describe('parameters', () => {
        it('should respect max_turns setting', async () => {
            if (skipIfApiUnavailable())
                return;
            // With max_turns=1, should be faster/cheaper
            const result = await withRateLimit(() => handleGrokExecuteCode(client, {
                code: 'print("quick test")',
                max_turns: 1,
            }));
            expect(result.content).toBeDefined();
            expect(result.content[0].text).toContain('Code Execution Results');
        });
        it('should work without include_output', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleGrokExecuteCode(client, {
                code: 'print("no raw output")',
                include_output: false,
                max_turns: 1,
            }));
            expect(result.content).toBeDefined();
            const text = result.content[0].text;
            expect(text).toContain('Code Execution Results');
            // Should NOT have "Raw Output:" section
            expect(text).not.toContain('Raw Output:');
        });
    });
});
//# sourceMappingURL=execute-code.live.test.js.map
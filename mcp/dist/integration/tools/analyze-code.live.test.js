/**
 * grok_analyze_code Tool Live Integration Tests
 *
 * Tests the code analysis tool against the real xAI API.
 *
 * @module integration/tools/analyze-code.live.test
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { handleAnalyzeCode } from '../../tools/analyze-code.js';
import { isApiAvailable, skipIfApiUnavailable } from '../setup.js';
import { createTestClient } from '../helpers/api-client.js';
import { withRateLimit } from '../helpers/rate-limiter.js';
import '../helpers/assertions.js';
describe('grok_analyze_code (live)', () => {
    let client;
    beforeAll(() => {
        if (!isApiAvailable())
            return;
        client = createTestClient();
    });
    describe('language analysis', () => {
        it('should analyze JavaScript code', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleAnalyzeCode(client, {
                code: `function add(a, b) {
  return a + b;
}`,
                language: 'javascript',
                analysis_type: 'all',
            }));
            expect(result.content).toBeDefined();
            expect(result.isError).toBe(false);
            const text = result.content[0].text;
            expect(text.length).toBeGreaterThan(50);
        });
        it('should analyze TypeScript code', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleAnalyzeCode(client, {
                code: `interface User {
  name: string;
  age: number;
}

function greet(user: User): string {
  return \`Hello, \${user.name}\`;
}`,
                language: 'typescript',
                analysis_type: 'all',
            }));
            expect(result.content).toBeDefined();
            expect(result.isError).toBe(false);
        });
        it('should analyze Python code', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleAnalyzeCode(client, {
                code: `def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)`,
                language: 'python',
                analysis_type: 'all',
            }));
            expect(result.content).toBeDefined();
            expect(result.isError).toBe(false);
        });
        it('should auto-detect language', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await withRateLimit(() => handleAnalyzeCode(client, {
                code: `const greeting = "Hello, World!";
console.log(greeting);`,
            }));
            expect(result.content).toBeDefined();
            expect(result.isError).toBe(false);
        });
    });
    describe('analysis types', () => {
        it('should detect bugs', async () => {
            if (skipIfApiUnavailable())
                return;
            // Code with an obvious bug (off-by-one error)
            const result = await withRateLimit(() => handleAnalyzeCode(client, {
                code: `function getLastElement(arr) {
  return arr[arr.length]; // Bug: should be arr.length - 1
}`,
                language: 'javascript',
                analysis_type: 'bugs',
            }));
            expect(result.content).toBeDefined();
            expect(result.isError).toBe(false);
            const text = result.content[0].text.toLowerCase();
            // Should mention something about the bug
            expect(text).toMatch(/bug|error|issue|index|undefined|length/);
        });
        it('should detect security issues', async () => {
            if (skipIfApiUnavailable())
                return;
            // Code with SQL injection vulnerability
            const result = await withRateLimit(() => handleAnalyzeCode(client, {
                code: `function getUserByName(name) {
  const query = "SELECT * FROM users WHERE name = '" + name + "'";
  return db.execute(query);
}`,
                language: 'javascript',
                analysis_type: 'security',
            }));
            expect(result.content).toBeDefined();
            expect(result.isError).toBe(false);
            const text = result.content[0].text.toLowerCase();
            // Should mention SQL injection or security concern
            expect(text).toMatch(/sql|injection|security|vulnerable|sanitize|parameterize/);
        });
        it('should detect performance issues', async () => {
            if (skipIfApiUnavailable())
                return;
            // Code with performance issue (inefficient recursion)
            const result = await withRateLimit(() => handleAnalyzeCode(client, {
                code: `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}`,
                language: 'javascript',
                analysis_type: 'performance',
            }));
            expect(result.content).toBeDefined();
            expect(result.isError).toBe(false);
            const text = result.content[0].text.toLowerCase();
            // Should mention performance or optimization
            expect(text).toMatch(/performance|slow|exponential|memoize|cache|optimize|recursive/);
        });
    });
    describe('error handling', () => {
        it('should handle empty code gracefully', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await handleAnalyzeCode(client, {
                code: '',
            });
            // Should return error response
            expect(result.content).toBeDefined();
            const text = result.content[0].text.toLowerCase();
            expect(text).toMatch(/error|required|empty|invalid/);
        });
        it('should handle missing code property', async () => {
            if (skipIfApiUnavailable())
                return;
            const result = await handleAnalyzeCode(client, {});
            expect(result.content).toBeDefined();
            expect(result.isError).toBe(true);
        });
    });
});
//# sourceMappingURL=analyze-code.live.test.js.map
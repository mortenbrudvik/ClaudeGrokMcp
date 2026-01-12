/**
 * grok_analyze_code Tool
 *
 * Analyzes code for issues, bugs, security vulnerabilities, and style problems
 * using Grok's code-focused models.
 *
 * @module tools/analyze-code
 */
import { CostTracker } from '../services/cost-tracker.js';
/**
 * JSON Schema for grok_analyze_code tool (JSON Schema 2020-12)
 */
export const analyzeCodeSchema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: {
        code: {
            type: 'string',
            description: 'The code to analyze',
        },
        language: {
            type: 'string',
            description: 'Programming language (auto-detected if not provided). Examples: javascript, python, typescript, go, rust, java',
        },
        analysis_type: {
            type: 'string',
            enum: ['performance', 'bugs', 'security', 'style', 'all'],
            default: 'all',
            description: 'Type of analysis to perform: performance (efficiency issues), bugs (logic errors), security (vulnerabilities), style (code quality), or all',
        },
        model: {
            type: 'string',
            description: 'Model to use for analysis. Default: grok-code-fast-1',
        },
        context: {
            type: 'string',
            description: 'Additional context about the code, such as its purpose or constraints',
        },
    },
    required: ['code'],
    additionalProperties: false,
};
/**
 * Language detection patterns
 */
const LANGUAGE_PATTERNS = [
    // TypeScript (before JavaScript due to type annotations)
    { pattern: /:\s*(string|number|boolean|void|any|never)\b/, language: 'typescript' },
    { pattern: /interface\s+\w+\s*\{/, language: 'typescript' },
    { pattern: /<[A-Z]\w*>/, language: 'typescript' },
    // JavaScript
    { pattern: /\b(const|let|var)\s+\w+\s*=/, language: 'javascript' },
    { pattern: /=>\s*\{/, language: 'javascript' },
    { pattern: /function\s*\w*\s*\([^)]*\)\s*\{/, language: 'javascript' },
    // Python
    { pattern: /def\s+\w+\s*\([^)]*\)\s*:/, language: 'python' },
    { pattern: /import\s+\w+(\s+as\s+\w+)?$/, language: 'python' },
    { pattern: /from\s+\w+\s+import/, language: 'python' },
    { pattern: /if\s+.*:\s*$/, language: 'python' },
    // Go
    { pattern: /func\s+(\([^)]+\)\s*)?\w+\s*\([^)]*\)\s*(\w+|\([^)]+\))?\s*\{/, language: 'go' },
    { pattern: /package\s+\w+/, language: 'go' },
    { pattern: /:=/, language: 'go' },
    // Rust
    { pattern: /fn\s+\w+\s*(<[^>]+>)?\s*\([^)]*\)\s*(->.*?)?\s*\{/, language: 'rust' },
    { pattern: /let\s+mut\s+/, language: 'rust' },
    { pattern: /impl\s+(<[^>]+>\s*)?\w+/, language: 'rust' },
    // Java
    { pattern: /public\s+class\s+\w+/, language: 'java' },
    { pattern: /public\s+static\s+void\s+main/, language: 'java' },
    { pattern: /System\.out\.print/, language: 'java' },
    // C#
    { pattern: /namespace\s+\w+(\.\w+)*\s*\{/, language: 'csharp' },
    { pattern: /public\s+async\s+Task/, language: 'csharp' },
    { pattern: /using\s+System/, language: 'csharp' },
    // C/C++
    { pattern: /#include\s*<[^>]+>/, language: 'c' },
    { pattern: /int\s+main\s*\([^)]*\)\s*\{/, language: 'c' },
    { pattern: /std::/, language: 'cpp' },
    // Ruby
    { pattern: /def\s+\w+(\s*\([^)]*\))?\s*$/, language: 'ruby' },
    { pattern: /class\s+\w+\s*<\s*\w+/, language: 'ruby' },
    { pattern: /require\s+['"]/, language: 'ruby' },
    // PHP
    { pattern: /<\?php/, language: 'php' },
    { pattern: /\$\w+\s*=/, language: 'php' },
    // SQL
    { pattern: /SELECT\s+.*\s+FROM/i, language: 'sql' },
    { pattern: /CREATE\s+TABLE/i, language: 'sql' },
    // HTML
    { pattern: /<!DOCTYPE\s+html>/i, language: 'html' },
    { pattern: /<html[^>]*>/i, language: 'html' },
    // CSS
    { pattern: /\{[^}]*:\s*[^;]+;\s*\}/, language: 'css' },
    { pattern: /@media\s+/, language: 'css' },
    // Shell/Bash
    { pattern: /^#!/, language: 'bash' },
    { pattern: /\$\(\s*\w+/, language: 'bash' },
];
/**
 * Detect programming language from code content
 */
export function detectLanguage(code) {
    for (const { pattern, language } of LANGUAGE_PATTERNS) {
        if (pattern.test(code)) {
            return language;
        }
    }
    return 'unknown';
}
/**
 * Build the analysis prompt based on type
 */
function buildAnalysisPrompt(code, language, analysisType, context) {
    const analysisInstructions = {
        performance: `Focus on performance issues such as:
- Inefficient algorithms or data structures
- Unnecessary computations or memory allocations
- N+1 query problems or excessive iterations
- Missing caching opportunities
- Blocking operations that could be async`,
        bugs: `Focus on potential bugs such as:
- Logic errors and edge cases
- Null/undefined reference issues
- Off-by-one errors
- Race conditions
- Incorrect type handling
- Resource leaks`,
        security: `Focus on security vulnerabilities such as:
- SQL injection
- XSS (Cross-Site Scripting)
- Command injection
- Path traversal
- Insecure deserialization
- Hardcoded secrets or credentials
- Missing input validation
- Improper error handling that leaks information`,
        style: `Focus on code style and quality issues such as:
- Naming conventions
- Code organization and structure
- Excessive complexity
- Code duplication
- Missing documentation
- Inconsistent formatting
- Magic numbers or strings`,
        all: `Perform a comprehensive analysis covering:
1. Performance issues
2. Potential bugs and logic errors
3. Security vulnerabilities
4. Code style and quality`,
    };
    const prompt = `Analyze the following ${language} code and identify issues.

${analysisInstructions[analysisType]}

${context ? `Additional context: ${context}\n\n` : ''}Respond with a JSON object containing:
1. "issues": An array of issues, each with:
   - "type": Category (performance/bug/security/style)
   - "severity": low/medium/high/critical
   - "line": Line number (if identifiable)
   - "message": Clear description of the issue
   - "suggestion": How to fix it
   - "codeSnippet": Relevant code if helpful

2. "summary": A brief overall assessment

Respond ONLY with valid JSON, no markdown or explanations.

Code to analyze:
\`\`\`${language}
${code}
\`\`\``;
    return prompt;
}
/**
 * Parse the analysis response from Grok
 */
function parseAnalysisResponse(response) {
    try {
        // Try to extract JSON from the response
        let jsonStr = response;
        // Handle markdown code blocks
        const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1].trim();
        }
        const parsed = JSON.parse(jsonStr);
        // Validate and normalize the response
        const issues = (parsed.issues || []).map((issue) => ({
            type: String(issue.type || 'unknown'),
            severity: validateSeverity(issue.severity),
            line: typeof issue.line === 'number' ? issue.line : undefined,
            endLine: typeof issue.endLine === 'number' ? issue.endLine : undefined,
            message: String(issue.message || ''),
            suggestion: issue.suggestion ? String(issue.suggestion) : undefined,
            codeSnippet: issue.codeSnippet ? String(issue.codeSnippet) : undefined,
        }));
        return {
            issues,
            summary: String(parsed.summary || 'Analysis completed.'),
        };
    }
    catch {
        // If JSON parsing fails, create a single issue from the response
        return {
            issues: [],
            summary: response.slice(0, 500),
        };
    }
}
/**
 * Validate severity level
 */
function validateSeverity(severity) {
    const valid = ['low', 'medium', 'high', 'critical'];
    if (typeof severity === 'string' && valid.includes(severity.toLowerCase())) {
        return severity.toLowerCase();
    }
    return 'medium';
}
// Note: Cost calculation now uses client.calculateCost() for consistency
// See P2-020: Consolidated cost calculation
/**
 * Execute code analysis
 */
export async function executeAnalyzeCode(client, input) {
    const startTime = Date.now();
    // Validate input
    if (!input.code || input.code.trim().length === 0) {
        throw new Error('Code is required for analysis');
    }
    // Detect or use provided language
    const language = input.language || detectLanguage(input.code);
    const analysisType = input.analysis_type || 'all';
    const model = input.model || 'grok-code-fast-1';
    // Build the prompt
    const prompt = buildAnalysisPrompt(input.code, language, analysisType, input.context);
    // Make the API call
    const response = await client.chatCompletion({
        model,
        messages: [
            {
                role: 'system',
                content: 'You are an expert code reviewer. Analyze code and respond with structured JSON containing issues and suggestions.',
            },
            {
                role: 'user',
                content: prompt,
            },
        ],
        temperature: 0.1, // Low temperature for consistent analysis
        max_tokens: 4000,
    });
    const responseTime = Date.now() - startTime;
    // Parse the response (API response content is always a string)
    const responseContent = response.choices[0]?.message?.content;
    const contentString = typeof responseContent === 'string' ? responseContent : 'No response';
    const { issues, summary } = parseAnalysisResponse(contentString);
    // Build the result
    return {
        issues,
        summary,
        language,
        analysisType,
        model: response.model,
        usage: response.usage,
        cost: client.calculateCost(response.model, response.usage.prompt_tokens, response.usage.completion_tokens),
        response_time_ms: responseTime,
    };
}
/**
 * Format analysis result for MCP response
 */
function formatAnalysisOutput(result) {
    const lines = [];
    // Header
    lines.push(`🤖 **Grok Code Analysis:**`);
    lines.push('');
    lines.push(`**Language:** ${result.language} | **Type:** ${result.analysisType} | **Model:** ${result.model}`);
    lines.push('');
    // Summary
    lines.push(`### Summary`);
    lines.push(result.summary);
    lines.push('');
    // Issues
    if (result.issues.length > 0) {
        lines.push(`### Issues Found (${result.issues.length})`);
        lines.push('');
        // Group by severity
        const bySeverity = {
            critical: [],
            high: [],
            medium: [],
            low: [],
        };
        for (const issue of result.issues) {
            bySeverity[issue.severity].push(issue);
        }
        for (const [severity, issues] of Object.entries(bySeverity)) {
            if (issues.length === 0)
                continue;
            const icon = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵' }[severity];
            lines.push(`#### ${icon} ${severity.toUpperCase()} (${issues.length})`);
            lines.push('');
            for (const issue of issues) {
                const lineInfo = issue.line
                    ? ` (line ${issue.line}${issue.endLine ? `-${issue.endLine}` : ''})`
                    : '';
                lines.push(`- **${issue.type}**${lineInfo}: ${issue.message}`);
                if (issue.suggestion) {
                    lines.push(`  - *Suggestion:* ${issue.suggestion}`);
                }
                if (issue.codeSnippet) {
                    lines.push(`  \`\`\``);
                    lines.push(`  ${issue.codeSnippet}`);
                    lines.push(`  \`\`\``);
                }
            }
            lines.push('');
        }
    }
    else {
        lines.push(`### No Issues Found`);
        lines.push('The code analysis did not identify any issues.');
        lines.push('');
    }
    // Metadata
    lines.push('---');
    lines.push(`⚡ *${result.model} • ${result.usage.total_tokens} tokens • $${result.cost.estimated_usd.toFixed(4)} • ${result.response_time_ms}ms*`);
    return lines.join('\n');
}
/**
 * Handle grok_analyze_code tool call
 *
 * @param client - XAI client instance
 * @param input - Tool input parameters
 * @param services - Optional services for cost tracking and rate limiting
 * @returns MCP CallToolResult
 */
export async function handleAnalyzeCode(client, input, services) {
    try {
        // Validate input
        if (!input || typeof input !== 'object') {
            throw new Error('Invalid input: expected object with code property');
        }
        const params = input;
        if (!params.code || typeof params.code !== 'string') {
            throw new Error('Invalid input: code property is required and must be a string');
        }
        const analyzeInput = {
            code: params.code,
            language: typeof params.language === 'string' ? params.language : undefined,
            analysis_type: typeof params.analysis_type === 'string'
                ? params.analysis_type
                : undefined,
            model: typeof params.model === 'string' ? params.model : undefined,
            context: typeof params.context === 'string' ? params.context : undefined,
        };
        // Resolve model for budget/rate estimation
        const resolvedModel = client.resolveModel(analyzeInput.model || 'grok-code-fast-1');
        // Estimate tokens for budget and rate limiting
        const estimatedInputTokens = Math.ceil((analyzeInput.code.length + (analyzeInput.context?.length || 0)) / 4);
        const estimatedOutputTokens = 4000; // Max tokens for analysis
        // CHECK BUDGET (estimate cost before call)
        if (services?.costTracker) {
            const estimatedCost = CostTracker.estimateCost(resolvedModel, estimatedInputTokens, estimatedOutputTokens);
            services.costTracker.checkBudget(estimatedCost); // throws if over budget
        }
        // ACQUIRE RATE LIMIT
        if (services?.rateLimiter) {
            await services.rateLimiter.acquire(estimatedInputTokens);
        }
        try {
            const result = await executeAnalyzeCode(client, analyzeInput);
            // RECORD ACTUAL USAGE
            if (services?.rateLimiter) {
                services.rateLimiter.recordUsage(result.usage.total_tokens, estimatedInputTokens);
                services.rateLimiter.clearBackoff();
            }
            // TRACK COST
            if (services?.costTracker) {
                services.costTracker.addFromEstimate(result.cost);
            }
            const content = {
                type: 'text',
                text: formatAnalysisOutput(result),
            };
            return {
                content: [content],
                isError: false,
            };
        }
        catch (error) {
            // Release rate limiter slot on failure
            if (services?.rateLimiter) {
                services.rateLimiter.release(estimatedInputTokens);
            }
            throw error;
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return {
            content: [{ type: 'text', text: `Error analyzing code: ${errorMessage}` }],
            isError: true,
        };
    }
}
//# sourceMappingURL=analyze-code.js.map
/**
 * grok_analyze_code Tool
 *
 * Analyzes code for issues, bugs, security vulnerabilities, and style problems
 * using Grok's code-focused models.
 *
 * @module tools/analyze-code
 */
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { XAIClient } from '../client/xai-client.js';
import { TokenUsage, CostEstimate, Services } from '../types/index.js';
/**
 * Analysis type options
 */
export type AnalysisType = 'performance' | 'bugs' | 'security' | 'style' | 'all';
/**
 * Input parameters for grok_analyze_code tool
 */
export interface AnalyzeCodeInput {
    /** The code to analyze (required) */
    code: string;
    /** Programming language (auto-detect if not provided) */
    language?: string;
    /** Type of analysis to perform (default: all) */
    analysis_type?: AnalysisType;
    /** Model to use (default: grok-code-fast-1) */
    model?: string;
    /** Additional context about the code */
    context?: string;
}
/**
 * Individual issue found in code analysis
 */
export interface CodeIssue {
    /** Type of issue (e.g., "performance", "bug", "security", "style") */
    type: string;
    /** Severity level */
    severity: 'low' | 'medium' | 'high' | 'critical';
    /** Line number where issue was found (if applicable) */
    line?: number;
    /** End line for multi-line issues */
    endLine?: number;
    /** Description of the issue */
    message: string;
    /** Suggested fix or improvement */
    suggestion?: string;
    /** Code snippet showing the issue */
    codeSnippet?: string;
}
/**
 * Response from code analysis
 */
export interface AnalyzeCodeResponse {
    /** List of issues found */
    issues: CodeIssue[];
    /** Summary of the analysis */
    summary: string;
    /** Detected or specified language */
    language: string;
    /** Analysis types performed */
    analysisType: AnalysisType;
    /** Model used for analysis */
    model: string;
    /** Token usage information */
    usage: TokenUsage;
    /** Cost estimate */
    cost: CostEstimate;
    /** Response time in milliseconds */
    response_time_ms: number;
}
/**
 * JSON Schema for grok_analyze_code tool (JSON Schema 2020-12)
 */
export declare const analyzeCodeSchema: {
    $schema: string;
    type: "object";
    properties: {
        code: {
            type: string;
            description: string;
        };
        language: {
            type: string;
            description: string;
        };
        analysis_type: {
            type: string;
            enum: string[];
            default: string;
            description: string;
        };
        model: {
            type: string;
            description: string;
        };
        context: {
            type: string;
            description: string;
        };
    };
    required: string[];
    additionalProperties: boolean;
};
/**
 * Detect programming language from code content
 */
export declare function detectLanguage(code: string): string;
/**
 * Execute code analysis
 */
export declare function executeAnalyzeCode(client: XAIClient, input: AnalyzeCodeInput): Promise<AnalyzeCodeResponse>;
/**
 * Handle grok_analyze_code tool call
 *
 * @param client - XAI client instance
 * @param input - Tool input parameters
 * @param services - Optional services for cost tracking and rate limiting
 * @returns MCP CallToolResult
 */
export declare function handleAnalyzeCode(client: XAIClient, input: unknown, services?: Services): Promise<CallToolResult>;
//# sourceMappingURL=analyze-code.d.ts.map
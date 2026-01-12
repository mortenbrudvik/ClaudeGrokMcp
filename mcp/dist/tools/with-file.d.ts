/**
 * grok_with_file Tool
 *
 * Query Grok with file content as context. Enables users to ask questions about
 * documents, extract information, and analyze file content beyond just code.
 *
 * @module tools/with-file
 */
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { XAIClient } from '../client/xai-client.js';
import { TokenUsage, CostEstimate, Services } from '../types/index.js';
/**
 * Supported file types
 */
export type FileType = 'code' | 'text' | 'markdown' | 'json' | 'csv' | 'xml' | 'yaml';
/**
 * Input parameters for grok_with_file tool
 */
export interface GrokWithFileInput {
    /** Question to ask about the file (required) */
    query: string;
    /** File content as text (required) */
    file_content: string;
    /** Original filename (helps with format detection) */
    filename?: string;
    /** File type (auto-detected if not provided) */
    file_type?: FileType;
    /** Model to use (default: auto) */
    model?: string;
    /** Additional context about the file or query */
    context?: string;
    /** Maximum tokens in response (default: 4096) */
    max_tokens?: number;
    /** Sampling temperature (default: 0.7) */
    temperature?: number;
}
/**
 * File information in response
 */
export interface FileInfo {
    /** Detected or specified file type */
    detected_type: FileType;
    /** File content size in bytes */
    size_bytes: number;
    /** Number of lines in the file */
    line_count: number;
    /** Original filename if provided */
    filename?: string;
}
/**
 * Response from grok_with_file
 */
export interface GrokWithFileResponse {
    /** Grok's response to the query */
    response: string;
    /** Model used for the query */
    model: string;
    /** Token usage information */
    usage: TokenUsage;
    /** Cost estimate */
    cost: CostEstimate;
    /** File information */
    file_info: FileInfo;
    /** Response time in milliseconds */
    response_time_ms: number;
}
/**
 * JSON Schema for grok_with_file tool (JSON Schema 2020-12)
 */
export declare const withFileSchema: {
    $schema: string;
    type: "object";
    properties: {
        query: {
            type: string;
            description: string;
            minLength: number;
        };
        file_content: {
            type: string;
            description: string;
            minLength: number;
        };
        filename: {
            type: string;
            description: string;
        };
        file_type: {
            type: string;
            enum: string[];
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
        max_tokens: {
            type: string;
            description: string;
            minimum: number;
            maximum: number;
            default: number;
        };
        temperature: {
            type: string;
            description: string;
            minimum: number;
            maximum: number;
            default: number;
        };
    };
    required: string[];
    additionalProperties: boolean;
};
/**
 * Tool definition for grok_with_file
 */
export declare const grokWithFileToolDefinition: {
    name: string;
    description: string;
    inputSchema: {
        $schema: string;
        type: "object";
        properties: {
            query: {
                type: string;
                description: string;
                minLength: number;
            };
            file_content: {
                type: string;
                description: string;
                minLength: number;
            };
            filename: {
                type: string;
                description: string;
            };
            file_type: {
                type: string;
                enum: string[];
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
            max_tokens: {
                type: string;
                description: string;
                minimum: number;
                maximum: number;
                default: number;
            };
            temperature: {
                type: string;
                description: string;
                minimum: number;
                maximum: number;
                default: number;
            };
        };
        required: string[];
        additionalProperties: boolean;
    };
};
/**
 * Detect file type from filename extension or content
 */
export declare function detectFileType(filename?: string, content?: string): FileType;
/**
 * Validate input parameters
 */
export declare function validateGrokWithFileInput(input: unknown): GrokWithFileInput;
/**
 * Execute file query
 */
export declare function executeGrokWithFile(client: XAIClient, input: GrokWithFileInput): Promise<GrokWithFileResponse>;
/**
 * Handle grok_with_file tool call
 *
 * @param client - XAI client instance
 * @param input - Tool input parameters
 * @param services - Optional services for cost tracking and rate limiting
 * @returns MCP CallToolResult
 */
export declare function handleGrokWithFile(client: XAIClient, input: unknown, services?: Services): Promise<CallToolResult>;
//# sourceMappingURL=with-file.d.ts.map
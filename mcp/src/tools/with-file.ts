/**
 * grok_with_file Tool
 *
 * Query Grok with file content as context. Enables users to ask questions about
 * documents, extract information, and analyze file content beyond just code.
 *
 * @module tools/with-file
 */

import { CallToolResult, TextContent } from '@modelcontextprotocol/sdk/types.js';
import { XAIClient } from '../client/xai-client.js';
import { TokenUsage, CostEstimate, Services } from '../types/index.js';
import { CostTracker } from '../services/cost-tracker.js';

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
export const withFileSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object' as const,
  properties: {
    query: {
      type: 'string',
      description: 'The question or task to perform on the file content',
      minLength: 1,
    },
    file_content: {
      type: 'string',
      description: 'The file content as text',
      minLength: 1,
    },
    filename: {
      type: 'string',
      description:
        'Original filename (helps with format detection). Examples: config.json, README.md, data.csv',
    },
    file_type: {
      type: 'string',
      enum: ['code', 'text', 'markdown', 'json', 'csv', 'xml', 'yaml'],
      description:
        'File type (auto-detected from filename or content if not provided). code = programming languages, text = plain text',
    },
    model: {
      type: 'string',
      description:
        'Model to use. Aliases: auto, default, fast, smartest, code, reasoning, cheap, vision. Or use model ID directly.',
    },
    context: {
      type: 'string',
      description: 'Additional context about the file or what you want to accomplish',
    },
    max_tokens: {
      type: 'integer',
      description: 'Maximum tokens in the response (default: 4096)',
      minimum: 1,
      maximum: 131072,
      default: 4096,
    },
    temperature: {
      type: 'number',
      description: 'Sampling temperature (0.0-2.0, default: 0.7)',
      minimum: 0,
      maximum: 2,
      default: 0.7,
    },
  },
  required: ['query', 'file_content'],
  additionalProperties: false,
};

/**
 * Tool definition for grok_with_file
 */
export const grokWithFileToolDefinition = {
  name: 'grok_with_file',
  description:
    'Query Grok with file content as context. Ask questions about documents, extract information, summarize content, or analyze file data. Supports code, text, markdown, JSON, CSV, XML, and YAML files.',
  inputSchema: withFileSchema,
};

/**
 * Extension to file type mapping
 */
const EXTENSION_MAP: Record<string, FileType> = {
  // Code files
  js: 'code',
  ts: 'code',
  jsx: 'code',
  tsx: 'code',
  py: 'code',
  rb: 'code',
  go: 'code',
  rs: 'code',
  java: 'code',
  c: 'code',
  cpp: 'code',
  h: 'code',
  hpp: 'code',
  cs: 'code',
  php: 'code',
  swift: 'code',
  kt: 'code',
  scala: 'code',
  sh: 'code',
  bash: 'code',
  ps1: 'code',
  sql: 'code',
  html: 'code',
  css: 'code',
  scss: 'code',
  less: 'code',
  vue: 'code',
  svelte: 'code',

  // Markdown
  md: 'markdown',
  mdx: 'markdown',
  markdown: 'markdown',

  // JSON
  json: 'json',
  jsonc: 'json',
  json5: 'json',

  // YAML
  yaml: 'yaml',
  yml: 'yaml',

  // XML
  xml: 'xml',
  xhtml: 'xml',
  svg: 'xml',
  xsd: 'xml',
  xsl: 'xml',

  // CSV
  csv: 'csv',
  tsv: 'csv',

  // Plain text
  txt: 'text',
  text: 'text',
  log: 'text',
  conf: 'text',
  cfg: 'text',
  ini: 'text',
  env: 'text',
  gitignore: 'text',
  dockerignore: 'text',
};

/**
 * Content patterns for file type detection
 */
const CONTENT_PATTERNS: Array<{ pattern: RegExp; type: FileType }> = [
  // Markdown (headers, links, lists) - check before JSON since markdown links start with [
  { pattern: /^#+ .+/m, type: 'markdown' },
  { pattern: /^\[.+\]\(.+\)/m, type: 'markdown' },
  { pattern: /^[-*+] .+/m, type: 'markdown' },

  // JSON - require more JSON-like content after opening bracket
  { pattern: /^\s*\{[\s\S]*"[^"]+"\s*:/, type: 'json' },
  { pattern: /^\s*\[[\s\S]*[[{"\d]/, type: 'json' },

  // YAML (key: value at start, or document separator)
  { pattern: /^---\s*$/m, type: 'yaml' },
  { pattern: /^\w+:\s+\S/m, type: 'yaml' },

  // XML
  { pattern: /^\s*<\?xml/i, type: 'xml' },
  { pattern: /^\s*<[a-z]+[^>]*>/i, type: 'xml' },

  // CSV (comma-separated with consistent columns)
  { pattern: /^[^,\n]+,[^,\n]+/m, type: 'csv' },

  // Code patterns (function definitions, imports)
  { pattern: /\b(function|def|fn|func|class|import|require|export)\b/, type: 'code' },
];

/**
 * Detect file type from filename extension or content
 */
export function detectFileType(filename?: string, content?: string): FileType {
  // 1. Check filename extension
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext && EXTENSION_MAP[ext]) {
      return EXTENSION_MAP[ext];
    }
  }

  // 2. Content-based detection
  if (content) {
    for (const { pattern, type } of CONTENT_PATTERNS) {
      if (pattern.test(content)) {
        return type;
      }
    }
  }

  // 3. Default to text
  return 'text';
}

/**
 * Get file statistics
 */
function getFileStats(content: string): { size_bytes: number; line_count: number } {
  return {
    size_bytes: Buffer.byteLength(content, 'utf-8'),
    line_count: content.split('\n').length,
  };
}

/**
 * Build the prompt for file analysis
 */
function buildFilePrompt(
  query: string,
  fileContent: string,
  fileType: FileType,
  filename?: string,
  context?: string
): string {
  const stats = getFileStats(fileContent);

  const parts: string[] = [];

  parts.push('You are analyzing a file. Here is the file information:');
  parts.push('');

  if (filename) {
    parts.push(`**Filename:** ${filename}`);
  }
  parts.push(`**Type:** ${fileType}`);
  parts.push(`**Lines:** ${stats.line_count}`);
  parts.push(`**Size:** ${stats.size_bytes} bytes`);
  parts.push('');

  // Add file content with appropriate delimiters
  parts.push('<file_content>');
  parts.push(fileContent);
  parts.push('</file_content>');
  parts.push('');

  parts.push(`**User Query:** ${query}`);

  if (context) {
    parts.push('');
    parts.push(`**Additional Context:** ${context}`);
  }

  parts.push('');
  parts.push(
    'Please analyze the file and answer the query. Be specific and reference relevant parts of the file when applicable.'
  );

  return parts.join('\n');
}

/**
 * Validate input parameters
 */
export function validateGrokWithFileInput(input: unknown): GrokWithFileInput {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid input: expected object with query and file_content properties');
  }

  const params = input as Record<string, unknown>;

  // Required: query
  if (params.query === undefined || params.query === null) {
    throw new Error('Invalid input: query is required and must be a string');
  }
  if (typeof params.query !== 'string') {
    throw new Error('Invalid input: query is required and must be a string');
  }
  if (params.query.trim().length === 0) {
    throw new Error('Invalid input: query cannot be empty');
  }

  // Required: file_content
  if (params.file_content === undefined || params.file_content === null) {
    throw new Error('Invalid input: file_content is required and must be a string');
  }
  if (typeof params.file_content !== 'string') {
    throw new Error('Invalid input: file_content is required and must be a string');
  }
  if (params.file_content.trim().length === 0) {
    throw new Error('Invalid input: file_content cannot be empty');
  }

  // Optional: filename
  if (params.filename !== undefined && typeof params.filename !== 'string') {
    throw new Error('Invalid input: filename must be a string');
  }

  // Optional: file_type
  const validFileTypes: FileType[] = ['code', 'text', 'markdown', 'json', 'csv', 'xml', 'yaml'];
  if (params.file_type !== undefined) {
    if (
      typeof params.file_type !== 'string' ||
      !validFileTypes.includes(params.file_type as FileType)
    ) {
      throw new Error(`Invalid input: file_type must be one of: ${validFileTypes.join(', ')}`);
    }
  }

  // Optional: model
  if (params.model !== undefined && typeof params.model !== 'string') {
    throw new Error('Invalid input: model must be a string');
  }

  // Optional: context
  if (params.context !== undefined && typeof params.context !== 'string') {
    throw new Error('Invalid input: context must be a string');
  }

  // Optional: max_tokens
  if (params.max_tokens !== undefined) {
    if (typeof params.max_tokens !== 'number' || !Number.isInteger(params.max_tokens)) {
      throw new Error('Invalid input: max_tokens must be an integer');
    }
    if (params.max_tokens < 1 || params.max_tokens > 131072) {
      throw new Error('Invalid input: max_tokens must be between 1 and 131072');
    }
  }

  // Optional: temperature
  if (params.temperature !== undefined) {
    if (typeof params.temperature !== 'number') {
      throw new Error('Invalid input: temperature must be a number');
    }
    if (params.temperature < 0 || params.temperature > 2) {
      throw new Error('Invalid input: temperature must be between 0 and 2');
    }
  }

  return {
    query: params.query,
    file_content: params.file_content,
    filename: params.filename as string | undefined,
    file_type: params.file_type as FileType | undefined,
    model: params.model as string | undefined,
    context: params.context as string | undefined,
    max_tokens: params.max_tokens as number | undefined,
    temperature: params.temperature as number | undefined,
  };
}

/**
 * Execute file query
 */
export async function executeGrokWithFile(
  client: XAIClient,
  input: GrokWithFileInput
): Promise<GrokWithFileResponse> {
  const startTime = Date.now();

  // Detect file type
  const fileType = input.file_type || detectFileType(input.filename, input.file_content);

  // Get file stats
  const stats = getFileStats(input.file_content);

  // Warn for large files
  const MAX_RECOMMENDED_SIZE = 100 * 1024; // 100KB
  if (stats.size_bytes > MAX_RECOMMENDED_SIZE) {
    console.error(
      `[grok_with_file] Warning: File size (${stats.size_bytes} bytes) exceeds recommended limit (${MAX_RECOMMENDED_SIZE} bytes). Consider truncating for better performance.`
    );
  }

  // Build the prompt
  const prompt = buildFilePrompt(
    input.query,
    input.file_content,
    fileType,
    input.filename,
    input.context
  );

  // Resolve model - use auto for intelligent selection
  const model = input.model || 'auto';
  const maxTokens = input.max_tokens || 4096;
  const temperature = input.temperature ?? 0.7;

  // Make the API call
  const response = await client.chatCompletion({
    model,
    messages: [
      {
        role: 'system',
        content:
          'You are a helpful assistant that analyzes file content and answers questions about it. Provide clear, accurate, and well-structured responses.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature,
    max_tokens: maxTokens,
  });

  const responseTime = Date.now() - startTime;

  // API response content is always a string
  const responseContent = response.choices[0]?.message?.content;
  const responseString =
    typeof responseContent === 'string' ? responseContent : 'No response generated';

  return {
    response: responseString,
    model: response.model,
    usage: response.usage,
    cost: client.calculateCost(
      response.model,
      response.usage.prompt_tokens,
      response.usage.completion_tokens
    ),
    file_info: {
      detected_type: fileType,
      size_bytes: stats.size_bytes,
      line_count: stats.line_count,
      filename: input.filename,
    },
    response_time_ms: responseTime,
  };
}

/**
 * Format response for MCP output
 */
function formatWithFileOutput(result: GrokWithFileResponse): string {
  const lines: string[] = [];

  // Header
  lines.push(`🤖 **Grok File Analysis:**`);
  lines.push('');

  // File info
  const fileInfo = result.file_info;
  lines.push(
    `**File:** ${fileInfo.filename || 'unnamed'} | **Type:** ${fileInfo.detected_type} | **Lines:** ${fileInfo.line_count}`
  );
  lines.push('');

  // Response
  lines.push('### Response');
  lines.push('');
  lines.push(result.response);
  lines.push('');

  // Metadata
  lines.push('---');
  lines.push(
    `⚡ *${result.model} • ${result.usage.total_tokens} tokens • $${result.cost.estimated_usd.toFixed(4)} • ${result.response_time_ms}ms*`
  );

  return lines.join('\n');
}

/**
 * Handle grok_with_file tool call
 *
 * @param client - XAI client instance
 * @param input - Tool input parameters
 * @param services - Optional services for cost tracking and rate limiting
 * @returns MCP CallToolResult
 */
export async function handleGrokWithFile(
  client: XAIClient,
  input: unknown,
  services?: Services
): Promise<CallToolResult> {
  try {
    // Validate input
    const validatedInput = validateGrokWithFileInput(input);

    // Resolve model for budget/rate estimation
    const resolvedModel = client.resolveModel(validatedInput.model || 'auto');

    // Estimate tokens for budget and rate limiting
    const estimatedInputTokens = Math.ceil(
      (validatedInput.file_content.length +
        validatedInput.query.length +
        (validatedInput.context?.length || 0)) /
        4
    );
    const estimatedOutputTokens = validatedInput.max_tokens || 4096;

    // CHECK BUDGET (estimate cost before call)
    if (services?.costTracker) {
      const estimatedCost = CostTracker.estimateCost(
        resolvedModel,
        estimatedInputTokens,
        estimatedOutputTokens
      );
      services.costTracker.checkBudget(estimatedCost); // throws if over budget
    }

    // ACQUIRE RATE LIMIT
    if (services?.rateLimiter) {
      await services.rateLimiter.acquire(estimatedInputTokens);
    }

    try {
      const result = await executeGrokWithFile(client, validatedInput);

      // RECORD ACTUAL USAGE
      if (services?.rateLimiter) {
        services.rateLimiter.recordUsage(result.usage.total_tokens, estimatedInputTokens);
        services.rateLimiter.clearBackoff();
      }

      // TRACK COST
      if (services?.costTracker) {
        services.costTracker.addFromEstimate(result.cost);
      }

      const content: TextContent = {
        type: 'text',
        text: formatWithFileOutput(result),
      };

      return {
        content: [content],
        isError: false,
      };
    } catch (error) {
      // Release rate limiter slot on failure
      if (services?.rateLimiter) {
        services.rateLimiter.release(estimatedInputTokens);
      }
      throw error;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return {
      content: [{ type: 'text', text: `Error processing file: ${errorMessage}` }],
      isError: true,
    };
  }
}

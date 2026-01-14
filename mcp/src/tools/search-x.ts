/**
 * grok_search_x Tool
 */
import { XAIClient } from '../client/xai-client.js';
import {
  GrokSearchXInput,
  GrokSearchXResponse,
  AgentToolsParams,
  AgentToolDefinition,
  WebSearchConfig,
  XSearchConfig,
  XAIError,
  Services,
  extractAgentResponseText,
} from '../types/index.js';

const DEFAULT_SEARCH_MODEL = 'grok-4-1-fast';

export const grokSearchXSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    query: { type: 'string', minLength: 1, maxLength: 10000 },
    enable_web_search: { type: 'boolean', default: false },
    enable_x_search: { type: 'boolean', default: true },
    max_turns: { type: 'integer', minimum: 1, maximum: 20, default: 3 },
    x_handles: { type: 'array', items: { type: 'string' } },
    exclude_x_handles: { type: 'array', items: { type: 'string' } },
    from_date: { type: 'string' },
    to_date: { type: 'string' },
    domains: { type: 'array', items: { type: 'string' } },
    exclude_domains: { type: 'array', items: { type: 'string' } },
    include_citations: { type: 'boolean', default: true },
  },
  required: ['query'],
  additionalProperties: false,
} as const;

export const grokSearchXToolDefinition = {
  name: 'grok_search_x',
  description: 'Search X/Twitter and web using Grok agentic search.',
  inputSchema: grokSearchXSchema,
};

export function validateGrokSearchXInput(input: unknown): GrokSearchXInput {
  if (!input || typeof input !== 'object') throw new Error('Input must be object');
  const p = input as Record<string, unknown>;
  if (!p.query || typeof p.query !== 'string') throw new Error('query required');
  return {
    query: p.query as string,
    enable_web_search: (p.enable_web_search as boolean) ?? false,
    enable_x_search: (p.enable_x_search as boolean) ?? true,
    max_turns: (p.max_turns as number) ?? 3,
    x_handles: p.x_handles as string[] | undefined,
    exclude_x_handles: p.exclude_x_handles as string[] | undefined,
    from_date: p.from_date as string | undefined,
    to_date: p.to_date as string | undefined,
    domains: p.domains as string[] | undefined,
    exclude_domains: p.exclude_domains as string[] | undefined,
    include_citations: (p.include_citations as boolean) ?? true,
  };
}

function buildAgentTools(input: GrokSearchXInput): AgentToolDefinition[] {
  const tools: AgentToolDefinition[] = [];
  if (input.enable_x_search) {
    const x: XSearchConfig = { type: 'x_search' };
    if (input.x_handles?.length) x.allowed_x_handles = input.x_handles.slice(0, 10);
    if (input.exclude_x_handles?.length)
      x.excluded_x_handles = input.exclude_x_handles.slice(0, 10);
    if (input.from_date) x.from_date = input.from_date;
    if (input.to_date) x.to_date = input.to_date;
    tools.push(x);
  }
  if (input.enable_web_search) {
    const w: WebSearchConfig = { type: 'web_search' };
    if (input.domains?.length) w.allowed_domains = input.domains.slice(0, 5);
    else if (input.exclude_domains?.length) w.excluded_domains = input.exclude_domains.slice(0, 5);
    tools.push(w);
  }
  return tools;
}

export async function handleGrokSearchX(
  client: XAIClient,
  args: unknown,
  services?: Services
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();
  try {
    const input = validateGrokSearchXInput(args);
    const tools = buildAgentTools(input);
    if (!tools.length) throw new Error('Enable at least one search type');
    // Check budget (throws if over limit)
    if (services?.costTracker) services.costTracker.checkBudget(0);
    // Acquire rate limit
    if (services?.rateLimiter) await services.rateLimiter.acquire(1000);
    const agentParams: AgentToolsParams = {
      model: DEFAULT_SEARCH_MODEL,
      input: [
        { role: 'system', content: 'Summarize findings. Do not reproduce posts verbatim.' },
        { role: 'user', content: input.query },
      ],
      tools,
      max_turns: input.max_turns,
    };
    const response = await client.responsesCreate(agentParams);
    const responseTime = Date.now() - startTime;
    // Agent Tools API may return input_tokens/output_tokens OR prompt_tokens/completion_tokens
    const inputTokens = response.usage.input_tokens ?? response.usage.prompt_tokens ?? 0;
    const outputTokens = response.usage.output_tokens ?? response.usage.completion_tokens ?? 0;
    const cost = client.calculateCost(response.model, inputTokens, outputTokens);
    // Record cost and rate limit usage
    if (services?.costTracker) services.costTracker.addFromEstimate(cost);
    if (services?.rateLimiter) {
      services.rateLimiter.recordUsage(response.usage.total_tokens, 1000);
      services.rateLimiter.clearBackoff();
    }
    // API returns 'output' array containing tool calls and assistant messages
    // Extract text from the assistant message in the output array
    const responseContent = extractAgentResponseText(response.output) || response.content || '';
    const result: GrokSearchXResponse = {
      response: responseContent,
      model: response.model,
      usage: response.usage,
      cost,
      citations: response.citations || [],
      tool_usage: response.server_side_tool_usage || {},
      response_time_ms: responseTime,
    };
    let out = '**Search Results**' + '\n\n' + (result.response || '[No search results available]');
    if (input.include_citations && result.citations.length > 0) {
      out += '\n\n**Sources:**\n';
      result.citations.forEach((cite, i) => {
        out += i + 1 + '. ' + (cite.title || cite.url) + '\n';
      });
    }
    out += '\n---\nModel: ' + result.model + ' | Tokens: ' + result.usage.total_tokens;
    out += ' | Cost: $' + result.cost.estimated_usd.toFixed(4) + ' | Time: ' + responseTime + 'ms';
    return { content: [{ type: 'text', text: out }] };
  } catch (error) {
    const t = Date.now() - startTime;
    const m =
      error instanceof XAIError
        ? error.getSanitizedMessage()
        : error instanceof Error
          ? error.message
          : 'Unknown';
    return { content: [{ type: 'text', text: 'Search failed: ' + m + ' (' + t + 'ms)' }] };
  }
}

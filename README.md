# Grok MCP Plugin

A Claude Code plugin that integrates xAI's Grok models for multi-model collaboration.

## Features

- **Natural language triggers**: "Ask Grok...", "What does Grok think..."
- **Direct commands**: `/query`, `/review`, `/debug`, `/design` for quick Grok queries
- **Model selection**: Choose from fast, smartest, code-optimized, or reasoning models
- **Model-aware timeouts**: 90s for slow grok-4, 30s for fast models
- **Smart streaming**: Auto-enables streaming for complex queries
- **Cost tracking**: See token usage and cost estimates for every query
- **Response caching**: Reduce costs with intelligent caching

## Installation

### Prerequisites

1. **xAI API Key**: Get one from [console.x.ai](https://console.x.ai/)
2. **Claude Code**: Version with plugin support

### Install from GitHub

```bash
# Add the plugin marketplace
/plugin marketplace add mortenbrudvik/ClaudeGrokMcp

# Install the plugin
/plugin install grok-mcp@grok-mcp-dev

# Restart Claude Code
```

### Set API Key

Add to your environment or Claude Code settings:

**macOS/Linux (bash/zsh):**
```bash
export XAI_API_KEY=xai-your-key-here
```

**Windows PowerShell:**
```powershell
$env:XAI_API_KEY = "xai-your-key-here"
```

**Windows Command Prompt:**
```cmd
set XAI_API_KEY=xai-your-key-here
```

Or configure in Claude Code (works on all platforms):
```bash
/config set PLUGIN_ENV_XAI_API_KEY=xai-your-key-here
```

## Usage

### Natural Language

Just ask Claude to use Grok:

```
"Ask Grok what the best practices are for error handling in TypeScript"

"Have Grok analyze this function for bugs"

"What does Grok think about this architecture?"
```

### /grok Command

```bash
# Simple query
/grok What is the time complexity of merge sort?

# Specify model
/grok --model fast Explain what a mutex is

# Code analysis
/grok --model code Review this function: function add(a,b) { return a-b }

# Extended reasoning
/grok --model reasoning Think through microservices vs monolith trade-offs
```

### Model Aliases

| Alias | Model | Best For | Pricing (per 1M tokens) |
|-------|-------|----------|------------------------|
| `auto` | grok-4 | General queries | $3.00 / $15.00 |
| `fast` | grok-4-fast | Quick responses | $0.20 / $0.50 |
| `smartest` | grok-4 | Complex analysis | $3.00 / $15.00 |
| `code` | grok-code-fast-1 | Programming tasks | $0.20 / $1.50 |
| `reasoning` | grok-4-1-fast-reasoning | Multi-step thinking (2M context) | $0.20 / $0.50 |
| `cheap` | grok-4-fast | Budget-conscious | $0.20 / $0.50 |
| `vision` | grok-4 | Image/vision analysis | $3.00 / $15.00 |

## MCP Tools

### grok_query

Query Grok with a question or prompt. Supports vision/image analysis.

```typescript
{
  query: string,           // Required: The question to ask
  model?: string,          // Model alias or ID (default: "auto")
  context?: string,        // System context to guide response
  max_tokens?: number,     // Max response tokens (default: 4096)
  temperature?: number,    // Sampling temperature 0-2 (default: 0.7)
  image_url?: string,      // Image URL or base64 data URI for vision
  image_detail?: string    // Detail level: "auto", "low", "high"
}
```

### grok_analyze_code

Analyze code for bugs, performance issues, security vulnerabilities, and style problems.

```typescript
{
  code: string,            // Required: The code to analyze
  language?: string,       // Programming language (auto-detected)
  analysis_type?: string,  // "performance", "bugs", "security", "style", "all"
  context?: string,        // Additional context about the code
  model?: string           // Model to use (default: grok-code-fast-1)
}
```

### grok_reason

Perform extended reasoning and deep thinking on complex problems.

```typescript
{
  query: string,           // Required: The problem to reason through
  effort?: string,         // "low", "medium", "high" (default: "medium")
  show_thinking?: boolean, // Include reasoning trace (default: true)
  context?: string,        // Additional context
  model?: string           // Model to use (default: grok-4-1-fast-reasoning)
}
```

### grok_estimate_cost

Estimate the cost of a Grok query before execution.

```typescript
{
  query: string,           // Required: The query to estimate
  model?: string,          // Model to use (default: auto)
  context?: string,        // Additional context
  max_tokens?: number      // Expected output tokens
}
```

### grok_execute_code

Execute Python code server-side for calculations and testing.

```typescript
{
  code: string,            // Required: Python code to execute
  description?: string,    // What the code should accomplish
  include_output?: boolean,// Include stdout/stderr (default: true)
  max_turns?: number,      // Max iterations 1-10 (default: 3)
  model?: string           // Model to use (default: grok-4-1-fast)
}
```

### grok_search_x

Search X/Twitter and web using Grok agentic search.

```typescript
{
  query: string,              // Required: Search query
  enable_x_search?: boolean,  // Search X/Twitter (default: true)
  enable_web_search?: boolean,// Search web (default: false)
  x_handles?: string[],       // Filter by X handles
  from_date?: string,         // Start date filter
  to_date?: string,           // End date filter
  include_citations?: boolean // Include source citations (default: true)
}
```

### grok_with_file

Query Grok with file content as context.

```typescript
{
  query: string,           // Required: Question about the file
  file_content: string,    // Required: File content as text
  filename?: string,       // Original filename for format detection
  file_type?: string,      // "code", "text", "markdown", "json", "csv", "xml", "yaml"
  context?: string,        // Additional context
  model?: string,          // Model to use
  max_tokens?: number,     // Max response tokens (default: 4096)
  temperature?: number     // Sampling temperature (default: 0.7)
}
```

### grok_models

List available models with capabilities and pricing.

```typescript
{
  refresh?: boolean  // Force refresh from API (default: false)
}
```

### grok_status

Get current status of the Grok MCP plugin.

```typescript
{
  include_details?: boolean  // Include detailed breakdown (default: false)
}
```

### grok_generate_image

Generate images from text descriptions.

```typescript
{
  prompt: string,            // Required: Text description of image to generate
  n?: number,                // Number of images 1-10 (default: 1)
  model?: string,            // Model to use (default: grok-2-image-1212)
  response_format?: string   // "url" or "b64_json" (default: "url")
}
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `XAI_API_KEY` | Required | Your xAI API key |
| `XAI_BASE_URL` | `https://api.x.ai/v1` | API base URL |
| `XAI_TIMEOUT` | Model-aware | Default timeout (90s for grok-4, 30s for fast models) |
| `GROK_CACHE_ENABLED` | `true` | Enable response caching |
| `GROK_COST_LIMIT_USD` | `10` | Session cost limit |
| `GROK_API_TIER` | `standard` | API tier (standard/enterprise) |

### Rate Limits

| Tier | Tokens/Minute | Requests/Minute |
|------|---------------|-----------------|
| Standard | 500,000 | 500 |
| Enterprise | 10,000,000 | 10,000 |

## Response Format

Every query returns:

```
[Grok's response]

---
Model: grok-4-fast
Tokens: 150 in / 342 out (492 total)
Cost: $0.0002
Response time: 1234ms
```

## Examples

### Code Review

```
/grok --model code Review this function:

function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
```

### Architecture Discussion

```
Ask Grok to analyze the trade-offs between using Redis vs Memcached for session storage
```

### Multi-Model Collaboration

```
I want both your perspective and Grok's on whether to use TypeScript strict mode
```

## Development

### Build

```bash
cd mcp
npm install
npm run build
```

### Project Structure

```
grok-mcp/
├── .claude-plugin/
│   ├── plugin.json        # Plugin manifest
│   └── marketplace.json   # Dev marketplace
├── skills/
│   └── using-grok/
│       └── SKILL.md       # Natural language skill
├── commands/
│   ├── query.md           # /grok-mcp:query command
│   ├── review-with-grok.md # /grok-mcp:review-with-grok
│   ├── debug-with-grok.md  # /grok-mcp:debug-with-grok
│   └── design-review.md    # /grok-mcp:design-review
├── mcp/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts       # MCP server entry
│       ├── client/
│       │   └── xai-client.ts
│       ├── services/      # Cache, cost tracking, rate limiting
│       ├── tools/
│       │   ├── query.ts   # grok_query tool
│       │   ├── models.ts  # grok_models tool
│       │   ├── analyze-code.ts
│       │   ├── reason.ts
│       │   └── ...        # 10 tools total
│       └── types/
│           └── index.ts
└── README.md
```

## Troubleshooting

### "XAI_API_KEY is required"

Set your API key (see [Set API Key](#set-api-key) above for platform-specific commands), or use:
```bash
/config set PLUGIN_ENV_XAI_API_KEY=xai-your-key-here
```

### "Rate limit exceeded"

The plugin automatically retries with exponential backoff. For heavy usage, consider enterprise tier.

### "Model not found"

Use `grok_models` to see current available models. Model IDs change periodically.

### Plugin not loading

1. Verify installation: `/plugin list`
2. Check MCP status: `/mcp`
3. Restart Claude Code

## License

MIT

## Links

- [xAI API Documentation](https://docs.x.ai/)
- [xAI Console](https://console.x.ai/)
- [MCP Specification](https://modelcontextprotocol.io/)

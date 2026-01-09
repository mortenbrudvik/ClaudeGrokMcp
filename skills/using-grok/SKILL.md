# Using Grok

## Description

Integrate xAI's Grok models into your workflow for multi-model collaboration. Get Grok's perspective on questions, code analysis, explanations, and creative tasks.

## When to Use

Use this skill when users want to:
- Get a second opinion from Grok on technical questions
- Have Grok analyze code for bugs, performance, or security issues
- Compare perspectives between Claude and Grok
- Leverage Grok's training data and reasoning capabilities
- Use Grok's extended thinking for complex problems

### Trigger Patterns

Activate this skill when you see phrases like:
- "Ask Grok..."
- "What does Grok think about..."
- "Get Grok's perspective on..."
- "Have Grok analyze..."
- "Use Grok to..."
- "Query Grok about..."
- "Let Grok explain..."

## Available Tools

### grok_query

Query Grok with a question or prompt.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | The question or prompt to send to Grok |
| `model` | string | No | Model alias or ID (default: "auto") |
| `context` | string | No | System context to guide the response |
| `max_tokens` | integer | No | Maximum response tokens (default: 4096) |
| `temperature` | number | No | Sampling temperature 0-2 (default: 0.7) |

**Model Aliases:**
| Alias | Best For | Model ID |
|-------|----------|----------|
| `auto` | General queries | grok-4 |
| `fast` | Quick responses, cost-effective | grok-4-fast |
| `smartest` | Complex reasoning | grok-4 |
| `code` | Code generation, agentic tasks | grok-code-fast-1 |
| `reasoning` | Extended thinking, chain-of-thought | grok-4.1-fast |
| `cheap` | Budget-conscious queries | grok-4-fast |

### grok_models

List available Grok models with capabilities and pricing.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `refresh` | boolean | No | Force refresh from API (default: false) |

## Model Selection Guide

Choose the right model for the task:

```
Quick question or simple task?
└─ Use "fast" - cheapest, fastest response

Code analysis or generation?
└─ Use "code" - optimized for programming tasks

Complex reasoning or multi-step analysis?
└─ Use "reasoning" - extended thinking, 2M context

Vision or image understanding?
└─ Use "auto" (grok-4) - supports image input

Not sure?
└─ Use "auto" - intelligent default selection
```

## Usage Examples

### Simple Query
```
User: "Ask Grok what the best practices are for error handling in TypeScript"

Action: Use grok_query with:
- query: "What are the best practices for error handling in TypeScript?"
- model: "auto"
```

### Code Analysis
```
User: "Have Grok review this function for potential bugs"

Action: Use grok_query with:
- query: "Review this function for potential bugs: [code]"
- model: "code"
- context: "You are a code reviewer focused on finding bugs and edge cases"
```

### Extended Reasoning
```
User: "Ask Grok to think through this architecture decision step by step"

Action: Use grok_query with:
- query: "Think through this architecture decision: [details]"
- model: "reasoning"
- temperature: 0.3 (lower for more focused reasoning)
```

### Comparing Perspectives
```
User: "I want both your opinion and Grok's on this approach"

Action:
1. Provide your (Claude's) perspective first
2. Use grok_query to get Grok's perspective
3. Synthesize both viewpoints, noting agreements and differences
```

## Synthesizing Responses

When presenting Grok's response alongside your own analysis:

1. **Label clearly**: Indicate which perspective is from Grok vs Claude
2. **Highlight agreements**: Note where both models align
3. **Explain differences**: If perspectives differ, explain the reasoning
4. **Provide recommendation**: Help the user decide based on both inputs

### Example Synthesis Format

```markdown
**Claude's Analysis:**
[Your perspective]

**Grok's Analysis:**
[Grok's response]

**Synthesis:**
Both Claude and Grok agree that [common points]. However, Grok additionally suggests [unique insight], while Claude emphasizes [different aspect].

**Recommendation:** Based on both perspectives, [actionable guidance].
```

## Conflict Resolution

When Claude and Grok disagree:

1. **Present both views fairly** - Don't dismiss either perspective
2. **Identify the source of disagreement** - Different assumptions? Different priorities?
3. **Provide context for the user** - Help them understand why models might differ
4. **Offer a balanced recommendation** - Based on the specific use case

## Cost Awareness

Grok API calls have associated costs. The response includes cost estimates:

- **grok-4**: $3.00 input / $15.00 output per 1M tokens (most capable)
- **grok-4-fast**: $0.20 input / $0.50 output per 1M tokens (cost-effective)
- **grok-code-fast-1**: $0.20 input / $1.50 output per 1M tokens (code-optimized)

For cost-sensitive work, prefer the "fast" or "cheap" aliases.

## Environment Requirements

The Grok MCP server requires:
- `XAI_API_KEY`: Your xAI API key (required)
- `GROK_CACHE_ENABLED`: Enable response caching (default: true)
- `GROK_COST_LIMIT_USD`: Session cost limit (default: $10)

## Tips

- **Be specific**: More detailed queries get better responses
- **Use context**: The `context` parameter helps guide Grok's response style
- **Check models**: Use `grok_models` to see current availability and pricing
- **Cache benefits**: Repeated queries return cached results (faster, free)
- **Temperature tuning**: Lower (0.1-0.3) for factual, higher (0.7-1.0) for creative

## Related

- `/grok` command - Direct Grok queries from the command line
- `grok_models` tool - Check available models and pricing

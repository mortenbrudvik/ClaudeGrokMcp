# /grok

Query xAI's Grok models directly from the command line.

## Usage

```
/grok <query>
/grok --model <model> <query>
/grok --help
```

## Arguments

| Argument | Description |
|----------|-------------|
| `<query>` | The question or prompt to send to Grok |

## Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--model` | `-m` | Model to use (default: auto). Options: auto, fast, smartest, code, reasoning, cheap |
| `--temperature` | `-t` | Sampling temperature 0-2 (default: 0.7) |
| `--help` | `-h` | Show help message |

## Examples

### Simple Query
```
/grok What are the best practices for error handling in Go?
```

### Specify Model
```
/grok --model fast Explain what a mutex is
```

### Code Analysis
```
/grok --model code Review this function for bugs: function add(a, b) { return a - b; }
```

### Extended Reasoning
```
/grok --model reasoning Think through the trade-offs of microservices vs monolith
```

### Lower Temperature for Factual
```
/grok --temperature 0.2 What is the time complexity of quicksort?
```

## Model Aliases

| Alias | Description | Best For |
|-------|-------------|----------|
| `auto` | Intelligent default (grok-4) | General queries |
| `fast` | Speed optimized (grok-4-fast) | Quick responses |
| `smartest` | Best quality (grok-4) | Complex analysis |
| `code` | Code optimized (grok-code-fast-1) | Programming tasks |
| `reasoning` | Extended thinking (grok-4.1-fast) | Multi-step reasoning |
| `cheap` | Most cost-effective (grok-4-fast) | Budget-conscious |

## Response Format

The response includes:
- Grok's answer
- Model used
- Token usage (input/output/total)
- Estimated cost in USD
- Response time

## Related

- `grok_query` tool - Programmatic access with full parameters
- `grok_models` tool - List available models and pricing
- Using Grok skill - Natural language integration

## Instructions

When the user runs `/grok`, execute the following:

1. Parse the command arguments:
   - Extract any `--model` or `-m` flag value (default: "auto")
   - Extract any `--temperature` or `-t` flag value (default: 0.7)
   - The remaining text is the query

2. If `--help` or `-h` is provided, show the usage information above

3. If no query is provided, ask the user what they'd like to ask Grok

4. Call the `grok_query` tool with:
   - `query`: The user's question
   - `model`: The specified model (or "auto")
   - `temperature`: The specified temperature (or 0.7)

5. Present Grok's response, including the metadata (model, tokens, cost)

6. If the query relates to code or technical topics the user is working on, offer to compare with Claude's perspective

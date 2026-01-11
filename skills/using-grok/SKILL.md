---
name: using-grok
description: Integrate xAI's Grok models for multi-model collaboration. Triggers on "Ask Grok", "What does Grok think", "Have Grok analyze", or similar phrases. Provides access to grok_query, grok_analyze_code, grok_reason, and grok_execute_code tools.
---

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
- "Have Grok review this code..."
- "Ask Grok to reason through..."
- "Get Grok to deeply think about..."
- "How much would it cost to ask Grok..."
- "Estimate the cost of asking Grok..."
- "Have Grok run/execute this code..."
- "Ask Grok to calculate..."
- "Verify this with Grok..."

### Additional Trigger Patterns

| Category | Phrases |
|----------|---------|
| **Quick Checks** | "Double-check with Grok", "Grok verify", "Sanity check via Grok" |
| **Code-Specific** | "Grok this code", "Grok debug this", "Have Grok test this" |
| **Comparisons** | "What would Grok say?", "Grok's take on this", "Second opinion from Grok" |
| **Cost-Aware** | "Quick Grok check" (implies fast model), "Deep Grok analysis" (implies reasoning) |
| **Verification** | "Have Grok run the numbers", "Verify calculation with Grok" |

## Available Tools

### grok_query

Query Grok with a question or prompt. Supports vision/image analysis.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | The question or prompt to send to Grok |
| `model` | string | No | Model alias or ID (default: "auto") |
| `context` | string | No | System context to guide the response |
| `max_tokens` | integer | No | Maximum response tokens (default: 4096) |
| `temperature` | number | No | Sampling temperature 0-2 (default: 0.7) |
| `top_p` | number | No | Nucleus sampling 0-1 (alternative to temperature) |
| `image_url` | string | No | Image URL (HTTPS) or base64 data URI for vision queries |
| `image_detail` | string | No | Detail level for image analysis: "auto", "low", "high" (default: "auto") |

**Vision Support (P4-015):**
- Provide an `image_url` to enable image analysis
- Supports HTTPS URLs (e.g., `https://example.com/photo.jpg`)
- Supports base64 data URIs (e.g., `data:image/png;base64,...`)
- **Minimum image size:** 448×448 pixels (images are processed as 448×448 tiles)
- **Maximum image size:** 10 MiB per image
- Supported formats: PNG, JPEG
- When image is provided with `model: "auto"`, automatically selects vision-capable model (grok-4)
- Use `image_detail: "low"` for faster, cheaper analysis; `"high"` for detailed inspection

**Model Aliases:**
| Alias | Best For | Model ID |
|-------|----------|----------|
| `auto` | General queries | grok-4 |
| `fast` | Quick responses, cost-effective | grok-4-fast |
| `smartest` | Complex reasoning | grok-4 |
| `code` | Code generation, agentic tasks | grok-code-fast-1 |
| `reasoning` | Extended thinking, chain-of-thought | grok-4.1-fast |
| `cheap` | Budget-conscious queries | grok-4-fast |
| `vision` | Image/vision analysis | grok-4 |

### grok_models

List available Grok models with capabilities and pricing.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `refresh` | boolean | No | Force refresh from API (default: false) |

### grok_analyze_code

Analyze code for bugs, performance issues, security vulnerabilities, and style problems.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `code` | string | Yes | The code to analyze |
| `language` | string | No | Programming language (auto-detected if not specified) |
| `analysis_type` | string | No | Type: "performance", "bugs", "security", "style", or "all" (default: "all") |
| `model` | string | No | Model to use (default: grok-code-fast-1) |

**Supported Languages:** JavaScript, TypeScript, Python, Go, Rust, Java, C#, C/C++, Ruby, PHP, SQL, HTML, CSS, Shell, and more (auto-detected).

### grok_reason

Perform extended reasoning and deep thinking on complex problems.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | The question or problem to reason through |
| `effort` | string | No | Reasoning depth: "low", "medium", "high" (default: "medium") |
| `show_thinking` | boolean | No | Include reasoning trace in output (default: true) |
| `model` | string | No | Model to use (default: grok-4-1-fast-reasoning) |
| `context` | string | No | Additional context for the problem |

**Effort Levels:**
- `low`: Quick analysis with focused conclusions (~2000 tokens)
- `medium`: Balanced reasoning with step-by-step analysis (~4000 tokens)
- `high`: Thorough deep thinking with multiple perspectives (~8000 tokens)

### grok_estimate_cost

Estimate the cost of a Grok query before execution.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | The query text to estimate |
| `model` | string | No | Model to use for estimation (default: auto) |
| `context` | string | No | Additional context to include in estimation |
| `max_tokens` | number | No | Expected maximum output tokens |

### grok_execute_code

Execute Python code server-side for calculations, data analysis, and algorithm testing.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `code` | string | Yes | Python code to execute (max 50,000 chars) |
| `description` | string | No | What the code should accomplish (improves explanation) |
| `include_output` | boolean | No | Include raw stdout/stderr (default: true) |
| `max_turns` | integer | No | Max execution iterations 1-10 (default: 3) |
| `model` | string | No | Model to use (default: grok-4-1-fast) |

**Use Cases:**
- Verify mathematical calculations
- Test algorithms with sample data
- Perform data analysis
- Validate code snippets before suggesting them
- Run complex computations

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

## Tool Selection Guide

Choose the right tool for the task:

```
General question or creative task?
└─ Use grok_query - flexible general-purpose tool

Code review or bug hunting?
└─ Use grok_analyze_code - structured analysis with line references

Complex problem requiring deep thought?
└─ Use grok_reason - shows thinking process, adjustable effort

Need to run calculations or test code?
└─ Use grok_execute_code - server-side Python execution

Want to know the cost before querying?
└─ Use grok_estimate_cost - preview costs without spending

List available models and pricing?
└─ Use grok_models - current availability and pricing
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

### Deep Code Analysis
```
User: "Analyze this code for security vulnerabilities"

Action: Use grok_analyze_code with:
- code: [the code to analyze]
- analysis_type: "security"
```

### Comprehensive Code Review
```
User: "Have Grok do a full code review of this function"

Action: Use grok_analyze_code with:
- code: [the code]
- analysis_type: "all"
- language: "typescript" (or auto-detect)
```

### Deep Reasoning
```
User: "I need Grok to deeply think through this design problem"

Action: Use grok_reason with:
- query: "Analyze this design problem: [details]"
- effort: "high"
- show_thinking: true
```

### Quick Analysis
```
User: "Get a quick take from Grok on this approach"

Action: Use grok_reason with:
- query: "What's your quick analysis of: [details]"
- effort: "low"
```

### Cost Estimation
```
User: "How much would it cost to ask Grok to summarize this long document?"

Action: Use grok_estimate_cost with:
- query: "[the full query text]"
- model: "auto"
- context: "[any additional context]"
```

### Code Execution
```
User: "Have Grok calculate the first 20 Fibonacci numbers"

Action: Use grok_execute_code with:
- code: |
    def fib(n):
        a, b = 0, 1
        result = []
        for _ in range(n):
            result.append(a)
            a, b = b, a + b
        return result
    print(fib(20))
- description: "Calculate the first 20 Fibonacci numbers"
```

### Verification with Code Execution
```
User: "Can you verify that calculation?"

Action: Use grok_execute_code with:
- code: [Python code to verify the calculation]
- description: "Verify the previous calculation"
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
- **Estimate first**: Use `grok_estimate_cost` before expensive operations
- **Right tool for the job**: Use `grok_analyze_code` for code review, `grok_reason` for complex problems
- **Effort levels**: Match reasoning effort to problem complexity - don't over-think simple questions

## Collaboration Workflows

### Automatic Code Review Workflow

When you generate substantial code (>20 lines) or security-sensitive code, proactively offer Grok review:

```
"I've written this [component/function]. Would you like Grok to review it for [bugs/security/performance]?"
```

If the user agrees:
1. Call `grok_analyze_code` with appropriate `analysis_type`
2. Compare Grok's findings with your own assessment
3. Present findings with clear attribution

### Debugging Collaboration Pattern

When debugging complex issues with unclear root cause:

1. Provide your hypothesis first
2. Call `grok_reason` with `effort: "high"` and error context
3. Compare hypotheses:
   - "My hypothesis: [your analysis]"
   - "Grok's hypothesis: [Grok's analysis]"
   - "Where we agree: [common ground]"
   - "Recommended debugging step: [action]"

### Design Review Pattern

For architecture decisions:

1. Present your analysis first
2. Call `grok_query` with `model: "smartest"`
3. Synthesize with confidence scoring (High/Medium/Low agreement)

### When to Proactively Suggest Grok

Consider offering Grok's perspective when:
- After generating substantial code (>20 lines)
- When debugging and stuck on root cause
- For security-sensitive code changes
- For complex architecture decisions
- When verification would be valuable

## Context Sharing Guidelines

### What to Include
- Error messages with full stack traces
- Relevant code snippets (<500 lines)
- Constraints ("Must work with Node 18+")
- Previous attempts that failed

### What to Summarize
- Large files → Describe structure, key functions
- Conversation history → Key decisions only
- Test output → Extract failures only

### What to Exclude
- API keys/secrets (NEVER include)
- Irrelevant files
- Boilerplate code

## Related

- `/grok` command - Direct Grok queries from the command line
- `grok_models` tool - Check available models and pricing
- `grok_analyze_code` tool - Specialized code analysis
- `grok_reason` tool - Extended reasoning for complex problems
- `grok_estimate_cost` tool - Pre-query cost estimation
- `grok_execute_code` tool - Server-side Python execution
- [Collaboration Guide](docs/GROK-COLLABORATION-GUIDE.md) - Detailed workflow patterns

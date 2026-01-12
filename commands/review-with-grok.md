# /review-with-grok

Have Grok review code for bugs, security issues, performance problems, or style issues.

## Usage

```
/review-with-grok [file_path] [--focus security|performance|bugs|style|all]
```

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `file_path` | No | Path to file to review (uses recent code if not provided) |
| `--focus` | No | Focus area: security, performance, bugs, style, or all (default: all) |

## Examples

```
/review-with-grok src/auth/login.ts --focus security
/review-with-grok --focus performance
/review-with-grok mcp/src/tools/query.ts
```

## What This Command Does

### Step 1: Gather Code

If `file_path` is provided:
- Read the specified file
- Detect the programming language

If no file path:
- Use the most recently generated or discussed code from the conversation
- Ask the user to specify if unclear

### Step 2: Perform Review

Call `grok_analyze_code` with:
- `code`: The code content
- `analysis_type`: The focus area (or "all")
- `language`: Auto-detected or specified

### Step 3: Present Findings

Format the response as:

```markdown
**Grok Code Review**

**File:** [filename]
**Focus:** [analysis type]

**Findings:**

[Critical Issues]
- Issue 1 (line X): Description
  - Suggested fix: ...

[High Priority]
- Issue 2 (line Y): Description

[Medium Priority]
- ...

**Claude's Additional Observations:**
[Your own observations about the code]

**Summary:**
[Brief summary of main findings and recommended actions]

---
*Model: [model] | Tokens: [count] | Cost: $[amount]*
```

### Step 4: Offer Follow-up

After presenting findings:
- Offer to implement fixes for critical/high issues
- Offer to explain any finding in more detail
- Suggest additional review focus areas if relevant

## Focus Areas

| Focus | What It Checks |
|-------|----------------|
| `security` | SQL injection, XSS, path traversal, auth issues, secrets exposure |
| `performance` | N+1 queries, inefficient algorithms, memory leaks, caching opportunities |
| `bugs` | Logic errors, null references, race conditions, edge cases |
| `style` | Naming conventions, code organization, complexity, duplication |
| `all` | Comprehensive review of all categories |

## Cost Considerations

- Uses `grok-code-fast-1` model by default
- Typical cost: $0.002-0.01 per review
- Larger files cost more (token-based pricing)

## Related

- `grok_analyze_code` tool - The underlying tool used by this command
- `/debug-with-grok` - Collaborative debugging
- `/design-review` - Architecture review

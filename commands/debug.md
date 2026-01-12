# /debug

Collaboratively debug an issue using both Claude and Grok's perspectives.

## Usage

```
/debug <error_description>
```

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `error_description` | Yes | Description of the error, bug, or unexpected behavior |

## Examples

```
/debug TypeError: Cannot read property 'x' of undefined
/debug The API returns 500 but only in production
/debug Tests pass locally but fail in CI
/debug Memory usage keeps growing over time
```

## What This Command Does

### Step 1: Gather Context

Collect relevant information:
- The error message or description provided
- Any stack traces mentioned in conversation
- Relevant code snippets from recent discussion
- Environment details if mentioned

### Step 2: Claude's Initial Hypothesis

Provide your (Claude's) initial analysis:
- Likely root cause based on the error pattern
- Relevant code areas to investigate
- Common causes of this type of issue

### Step 3: Get Grok's Analysis

Call `grok_reason` with:
- `query`: The error details and context
- `effort`: "high" (for thorough analysis)
- `show_thinking`: true (to see reasoning process)
- `context`: Include relevant code snippets and error details

### Step 4: Compare and Synthesize

Present the analysis in this format:

```markdown
**Collaborative Debugging Analysis**

**Error:** [error description]

---

**Claude's Hypothesis:**
[Your analysis of the likely root cause]

**Key suspects:**
1. [First possibility]
2. [Second possibility]

---

**Grok's Hypothesis:**

[Grok's thinking trace summary]

**Grok's conclusion:**
[Grok's analysis of the root cause]

---

**Where We Agree:**
- [Common findings between both analyses]

**Different Perspectives:**
- Claude focuses on: [aspect]
- Grok suggests: [different angle]

---

**Recommended Debugging Steps:**
1. [First action to take]
2. [Second action]
3. [Third action]

**Most Likely Root Cause:**
[Combined assessment]
```

### Step 5: Offer Assistance

After the analysis:
- Offer to implement fixes if root cause is identified
- Offer to add logging/debugging code
- Suggest tests to verify the fix
- Offer to investigate specific areas further

## Best Practices

### Provide Good Context
The more context you provide, the better the analysis:
- Full error messages and stack traces
- Relevant code snippets
- When the error occurs (always? sometimes?)
- What changed recently

### Follow Up
After the initial analysis:
- Try the suggested debugging steps
- Report back what you find
- Ask for deeper analysis on specific areas

## Cost Considerations

- Uses `grok_reason` with high effort
- Typical cost: $0.005-0.02 per debugging session
- Extended analysis may use more tokens

## Related

- `grok_reason` tool - Extended reasoning for complex problems
- `/review` - Code review for bug prevention
- `/design` - Architecture review

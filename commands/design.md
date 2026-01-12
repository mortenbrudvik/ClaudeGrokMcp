# /design

Get multi-model perspective on architectural decisions, technology choices, or design trade-offs.

## Usage

```
/design <design_description>
```

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `design_description` | Yes | Description of the design decision or architecture to review |

## Examples

```
/design Should we use microservices or a monolith for our new auth service?
/design What's the best way to implement caching for our API?
/design Review our database schema design for the user management system
/design Compare Redux vs Context API for our React app state management
```

## What This Command Does

### Step 1: Understand the Decision

Parse the design description to understand:
- The decision or design being considered
- Key constraints (performance, cost, team size, etc.)
- Context from the conversation

### Step 2: Claude's Analysis

Provide your (Claude's) initial perspective:
- Recommended approach and why
- Key trade-offs to consider
- Potential risks and mitigations

### Step 3: Get Grok's Perspective

Call `grok_query` with:
- `model`: "smartest" (for complex reasoning)
- `query`: The design decision with context
- `context`: "You are a senior software architect reviewing a design decision. Consider trade-offs, scalability, maintainability, and long-term implications."

### Step 4: Synthesize with Confidence Scoring

Present the analysis in this format:

```markdown
**Design Review: [Decision Summary]**

---

**Claude's Analysis:**

**Recommendation:** [Your recommendation]

**Reasoning:**
- [Key point 1]
- [Key point 2]
- [Key point 3]

**Trade-offs:**
| Approach | Pros | Cons |
|----------|------|------|
| Option A | ... | ... |
| Option B | ... | ... |

---

**Grok's Analysis:**

**Recommendation:** [Grok's recommendation]

**Reasoning:**
[Grok's perspective]

**Additional Considerations:**
[Unique insights from Grok]

---

**Confidence Assessment:**

| Aspect | Agreement Level |
|--------|-----------------|
| Overall Recommendation | [High/Medium/Low] |
| Key Trade-offs | [High/Medium/Low] |
| Risk Assessment | [High/Medium/Low] |

**Where We Agree:**
- [Common conclusions]

**Where We Differ:**
- Claude emphasizes: [aspect]
- Grok emphasizes: [different aspect]

---

**Final Recommendation:**

[Synthesized recommendation based on both perspectives]

**Confidence Level:** [High/Medium/Low]

**Rationale:** [Why this recommendation, considering both analyses]

**Next Steps:**
1. [Suggested action]
2. [Suggested action]
```

### Confidence Levels

| Level | Meaning |
|-------|---------|
| **High** | Both models agree, clear evidence supports the conclusion |
| **Medium** | Models mostly agree with minor differences, or some uncertainty |
| **Low** | Models disagree significantly, or insufficient information |

## Best Practices

### Provide Context
Better reviews come from more context:
- Team size and experience
- Budget and timeline constraints
- Existing systems to integrate with
- Performance requirements
- Scalability expectations

### Ask Follow-ups
After the initial review:
- Ask about specific trade-offs
- Request deeper analysis on risky areas
- Ask for implementation guidance

## Cost Considerations

- Uses `grok-4` (smartest) model
- Typical cost: $0.02-0.10 per review
- Complex reviews with extensive context cost more

## Related

- `grok_query` tool - General queries with model selection
- `/review` - Code-level review
- `/debug` - Problem diagnosis

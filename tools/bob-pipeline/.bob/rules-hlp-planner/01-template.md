# High-level plan template

Write `hlp.md` with exactly these sections:

```
# High-level plan: #<issue> <title>

## Summary
One or two sentences.

## Approach
The chosen approach. Why it fits this codebase.

## Alternatives considered
- Option — why rejected

## Components affected
- component — what changes in it

## Acceptance criteria
- AC-1: ...
- AC-2: ...

## Dependencies on other issues
- #<n> — why (or "None known")

## Assumptions
- ...

## Risks
| Risk | Severity | Mitigation |
|---|---|---|

## Open questions
- ... (or "None")

## Complexity
S | M | L | XL — one line on why
```

`hlp.json` must contain the same information in the structure defined by
`.bob-pipeline/schemas/hlp.schema.json`. The two files must agree.

# Dependency check rules

- `blocked_by`: this issue cannot be completed until the other one is.
- `blocks`: the other issue needs this one first.
- `overlaps`: both touch the same files or components; order matters for merging
  but neither strictly needs the other.
- Use `high` confidence only when a plan explicitly relies on the other issue's
  outcome. Shared files alone are `medium` at most.
- Write `deps.json` matching `.bob-pipeline/schemas/deps.schema.json`.

## deps.md template

```
# Dependency check: #<issue> <title>

## Summary
One or two sentences: is this issue independent, or does it need ordering?

## Dependencies
| Issue | Relationship | Confidence | Why | Shared |
|---|---|---|---|---|
| #37 | blocked by | high | ... | src/auth/token.ts |

## Conflicts
- #12 and this issue both ... (or "None")

## Recommended order
#37 → #42 → #45
```

# What-has-changed template

Write `changes.md` with exactly these sections:

```
# What has changed: #<issue> <title>

## Summary
Two or three sentences a product owner could read.

## Changes
| Area | Files | What changed | Why |
|---|---|---|---|

## Acceptance criteria
| Criterion | Status | Evidence (file, test) |
|---|---|---|
| AC-1 | Met / Partly / Not met | ... |

## Tests: planned vs actual
| Test | Layer | Planned | Status | File |
|---|---|---|---|---|
| T-1 | smoke | yes | Created / Changed / Missing | path |
| (unplanned) | unit | no | Created | path |

## Deviations from the plan
What differs from the low-level plan and why (or "None").

## Risks and things reviewers should check
- ...

## Follow-ups
- ... (or "None")
```

Every row must be traceable to the diff. Do not describe changes that are not in it.

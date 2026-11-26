# Low-level plan template

Write `llp.md` with exactly these sections:

```
# Low-level plan: #<issue> <title>

## Overview
How the approved high-level plan maps onto the code.

## Changes by file
### path/to/file.ts (modify)
- What changes and why
- Symbols: `functionName`, `TypeName`
- Covers: AC-1, AC-2

## Interfaces
Signatures of new or changed public functions, endpoints, events or types.

## Data and configuration changes
Migrations, schema, feature flags, env vars (or "None").

## Test approach
| Layer | What | Covers |
|---|---|---|
| smoke | ... | AC-1 |
| bdd | ... | AC-1 |
| component | ... | AC-2 |
| unit | ... | AC-2 |

## Rollout
Order of changes, flags, backwards compatibility.

## Open questions
- ... (or "None")
```

`llp.json` must contain the same information in the structure defined by
`.bob-pipeline/schemas/llp.schema.json`. The two files must agree.

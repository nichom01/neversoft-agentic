# Test plan template

## Choosing the layer

| Layer | Use it for | Typical count |
|---|---|---|
| smoke | "Is it alive?" after deploy: the critical path works end to end | 1–3 |
| bdd | Each acceptance criterion, in the user's or caller's words | ≥ 1 per AC |
| component | Contracts at module/service boundaries the plan changes: APIs, events, DB access | a few |
| unit | Pure logic, branches, edge cases, error handling, each risk that code can guard | most tests |

Go top down, but push each behaviour to the lowest layer that can prove it.
A test at a higher layer needs a reason the lower layer can't cover it.

## tests.md

~~~
# Test plan: #<issue> <title>

## Summary
Counts per layer and the overall approach in two or three sentences.

## Smoke
### T-1: <title>
- Target: <endpoint / page / command>
- Why this layer: ...
- Covers: AC-1

## BDD
### T-2: <title>
```gherkin
Given ...
When ...
Then ...
```
- Target: <feature file or test file>
- Why this layer: ...
- Covers: AC-1

## Component
### T-n: ...

## Unit
### T-n: ...

## Coverage
| Criterion / risk | Smoke | BDD | Component | Unit |
|---|---|---|---|---|
| AC-1 | T-1 | T-2 | | T-6 |

## Gaps
- What is deliberately not tested and why (or "None")
~~~

`tests.json` must contain the same tests, matching
`.bob-pipeline/schemas/tests.schema.json`. In `traces_to`, use `AC-n` ids
exactly as in the high-level plan, and `risk: <risk text>` for risks.

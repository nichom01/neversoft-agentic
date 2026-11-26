# What has changed: #15 Risk scoring

## Summary
The branch adds a stateless scorer, `SalesOrderRiskScorer`, and a small immutable result type, `RiskScore`. Together they give each sales order in a collection a risk number from 1 to 10, based on the order's total value and its number of lines. The change is additive: no existing class is modified and nothing calls the scorer yet. **The planned test class, `SalesOrderRiskScorerTest`, is not in the diff, so none of the new behaviour is covered by tests.**

## Changes
| Area | Files | What changed | Why |
|---|---|---|---|
| Result type | [`RiskScore.java`](../../../src/main/java/com/neversoft/sales/RiskScore.java) | New public `record RiskScore(SalesOrder order, int score)`. The compact constructor throws `NullPointerException` for a null order. It throws `IllegalArgumentException` if `score` is outside `MIN_SCORE`..`MAX_SCORE` (1-10). | Return one immutable order/score pair per input order. It is not stored on `SalesOrder`, so that class's `equals`/`hashCode` and reflection tests are unaffected (AC-1, AC-5). |
| Scorer | [`SalesOrderRiskScorer.java`](../../../src/main/java/com/neversoft/sales/SalesOrderRiskScorer.java) | New `public final` class with a private constructor. The public entry point is `score(Collection<SalesOrder>)`, which returns an immutable `List<RiskScore>` in iteration order. Null or empty input returns `List.of()`. A null element throws `NullPointerException`. | Implements the issue: a way to take a set of orders and score each from 1 to 10. |
| Scoring rule | [`SalesOrderRiskScorer.java`](../../../src/main/java/com/neversoft/sales/SalesOrderRiskScorer.java) | `orderValue` sums non-null `lineAmount`s (null counts as zero) and returns `BigDecimal.ZERO` for a negative total. `valueScore` is 1 plus the count of `VALUE_BOUNDS` entries `<=` the value, compared with `compareTo`. `lineScore` is 1 plus the count of `LINE_BOUNDS` entries `<=` the line count. `scoreOrder` takes the higher of the two and clamps it to 1-10. | Score depends only on value and line count, never decreases as either rises, and is scale-insensitive for `BigDecimal` (AC-2, AC-3, AC-4, AC-5, AC-8). |
| Bands | [`SalesOrderRiskScorer.java`](../../../src/main/java/com/neversoft/sales/SalesOrderRiskScorer.java) | Package-private constants `MIN_SCORE = 1`, `MAX_SCORE = 10`, `VALUE_BOUNDS` (100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000) and `LINE_BOUNDS` (2, 4, 6, 10, 15, 20, 30, 50, 100). The class Javadoc documents the rule and the band table. | The bands live in one place and are documented (AC-6). They are implementer defaults, not business-mandated numbers. |
| Planning docs | `docs/bob/15/` (`hlp`, `llp`, `tests`, `deps`, `state.json`) | New plan, dependency and pipeline-state files. | Pipeline records. They do not change runtime behaviour. |

Not changed, as confirmed by the diff: `SalesOrder.java`, `SalesOrderLine.java` and `Customer.java` do not appear in it. `package.json` and the `tools/` projects are also absent.

## Acceptance criteria
Status reflects what the diff shows. "Met" means the code implements it. Where the plan required a test as evidence, the missing test is noted.

| Criterion | Status | Evidence (file, test) |
|---|---|---|
| AC-1: one result per order, in input order, score 1-10 | Partly | Implemented in `score` (`ArrayList` filled in iteration order, then `List.copyOf`) and in the `RiskScore` range check. No test (T-4, T-12, T-13 missing). |
| AC-2: score derived only from total value and line count | Partly | `scoreOrder` reads only `orderValue(order)` and `order.getLines().size()`. No test (T-10, T-11, T-17, T-19 missing). |
| AC-3: monotone in value and in line count | Partly | Both sub-scores count bounds `<=` the input, and `max` preserves monotonicity. No test (T-9, T-14, T-15, T-16 missing). |
| AC-4: no lines or all-null/zero amounts scores 1 without throwing | Partly | With zero lines or zero value, no bound is `<=` the input, so both sub-scores are `MIN_SCORE`. No test (T-5 missing). |
| AC-5: capped at 10 | Partly | Clamp in `scoreOrder`, plus 9 bounds per list, so a score cannot exceed 10. No test (T-6, T-12 missing). |
| AC-6: thresholds in one place, documented, tests on both sides of every boundary | Partly | Constants and Javadoc are in `SalesOrderRiskScorer.java`. Boundary tests are missing (T-14, T-15, T-18, T-20). |
| AC-7: null/empty collection gives empty result, null element gives `NullPointerException` | Partly | `score` returns `List.of()` for null or empty input and calls `Objects.requireNonNull` on each element. No test (T-7 missing). |
| AC-8: null `lineAmount` counts as zero | Partly | `orderValue` skips null amounts. No test (T-5, T-17 missing). |
| AC-9: no mutation, score independent of other orders | Partly | `score` and its helpers only read the order, and each order is scored independently. No test (T-8, T-21 missing). |
| AC-10: `SalesOrder`, `SalesOrderLine`, `Customer` unchanged, `SalesOrderTest` still passes | Partly | The three files are absent from the diff. The diff has no evidence that `SalesOrderTest` was run (T-1, T-2 are shell checks, not artefacts in the diff). |
| AC-11: compiles with `javac --release 25 -Xlint:all -Werror`, new tests run with plain `java` and exit non-zero on failure | Not met | The new test class does not exist in the diff. The main code uses only the JDK. Compilation under the strict flags is not evidenced in the diff. |

## Tests: planned vs actual
The diff contains no file under `src/test/`. `SalesOrderRiskScorerTest.java` is not in the diff, and a search of the worktree finds no file with that name. Every planned test is therefore Missing. The T-n ids come from [`tests.md`](tests.md). R-n is the planned method name in the test class.

| Test | Layer | Planned | Status | File |
|---|---|---|---|---|
| T-1 compile with strict flags, both test classes pass | smoke | yes | Missing | shell check, no artefact in the diff. It also needs the test class. |
| T-2 existing model files untouched | smoke | yes | Missing | shell check, no artefact. The diff does show no change to those files. |
| T-3 failing test makes harness exit non-zero | smoke | yes | Missing | shell check. It needs the test class. |
| T-4 one result per order, in input order (R-1) | bdd | yes | Missing | `src/test/java/com/neversoft/sales/SalesOrderRiskScorerTest.java` (not created) |
| T-5 empty and valueless orders score 1 (R-2) | bdd | yes | Missing | same file (not created) |
| T-6 very large orders capped at 10 (R-3) | bdd | yes | Missing | same file (not created) |
| T-7 null and empty input (R-4) | bdd | yes | Missing | same file (not created) |
| T-8 side-effect free, independent of the set (R-5) | bdd | yes | Missing | same file (not created) |
| T-9 bigger or busier order never scores lower (R-6) | bdd | yes | Missing | same file (not created) |
| T-10 only value and line count matter (R-6) | bdd | yes | Missing | same file (not created) |
| T-11 combination is the higher sub-score (R-6) | component | yes | Missing | same file (not created) |
| T-12 result types immutable and validated (R-7) | component | yes | Missing | same file (not created) |
| T-13 equal orders not collapsed (R-5) | component | yes | Missing | same file (not created) |
| T-14 value band boundaries (R-8) | unit | yes | Missing | same file (not created) |
| T-15 line band boundaries (R-9) | unit | yes | Missing | same file (not created) |
| T-16 monotonicity sweep (R-10) | unit | yes | Missing | same file (not created) |
| T-17 order value arithmetic (R-11) | unit | yes | Missing | same file (not created) |
| T-18 scale-insensitive comparison (R-11) | unit | yes | Missing | same file (not created) |
| T-19 value from `lineAmount`, not quantity times price (R-11) | unit | yes | Missing | same file (not created) |
| T-20 constants well formed (R-12) | unit | yes | Missing | same file (not created) |
| T-21 helpers do not mutate inputs (R-5) | unit | yes | Missing | same file (not created) |
| (unplanned) | n/a | no | None found | No tests were added that were not in the plan. |

## Deviations from the plan
- **Missing test class (significant).** The low-level plan lists `src/test/java/com/neversoft/sales/SalesOrderRiskScorerTest.java` as a file to create, and the test plan expects 21 tests. That file is not in the diff, so the "single commit of three files" rollout is not what the branch contains. The rollout verification commands, which are meant to live in that test's Javadoc, are therefore not in the repo either.
- **Dependency from `RiskScore` to the scorer's constants.** The plan says the `RiskScore` constructor rejects a score outside 1-10. The implementation expresses the range as `SalesOrderRiskScorer.MIN_SCORE` and `MAX_SCORE`, which are package-private. The two classes therefore depend on each other. The behaviour matches the plan.
- **`scoreOrder` structure.** The plan writes it as one nested `Math.min(Math.max(...))` expression. The implementation computes a `combined` local variable first, then clamps. The result is the same.
- **Sizing of the result list.** `score` pre-sizes the `ArrayList` with `orders.size()`. The plan does not say this, and it does not change behaviour.
- **Everything else matches the plan.** This covers the band tables, the null/empty handling, the `compareTo` comparison, the negative-total floor, and the `List.copyOf` result.

## Risks and things reviewers should check
- **No automated coverage.** Because the test class is missing, boundary values (for example 99.99 against 100, and 1 against 2 lines), the null-element positions, the negative-total floor and immutability have never been exercised by anything in this branch. Do not merge until the test class is added, or the gap is accepted explicitly.
- **Compile status is not shown.** Nothing in the diff proves the code compiles under `-Xlint:all -Werror` with `--release 25`. Run the rollout commands from [`llp.md`](llp.md) (without the test class they only compile the main code) and run the existing `SalesOrderTest`.
- **Business confirmation still open.** The value bands, the line-count bands and the use of `max` instead of an average are implementer defaults (see the open questions in [`hlp.md`](hlp.md)). A reviewer or the issue author should confirm them.
- **Value uses stored `lineAmount`.** The score ignores quantity and unit price, and `lineAmount` may disagree with them. Issue #5 derives totals from quantity times unit price (see [`deps.md`](deps.md)). This only matters if the score is later shown in the UI.
- **Credits are floored.** A negative order total is scored as zero value. Check this is acceptable.
- **Lower-inclusive bands.** A value of exactly 100 scores 2, and exactly 2 lines scores 2. Check the Javadoc table in `SalesOrderRiskScorer.java` against what the business expects.
- **Mutable orders.** `score` keeps references to the caller's `SalesOrder` objects in each `RiskScore`. If a caller later changes an order, the stored score is stale. The record only guards the score range, not the order's state.
- **Public surface.** Only `score` and `RiskScore` are public. The helpers and constants are package-private so that tests in the same package can reach them.
- **Housekeeping files in the diff.** `docs/bob/15/state.json` records pipeline history and a PR number. Check whether it should be committed.

## Follow-ups
- Add `SalesOrderRiskScorerTest.java` with the 21 planned tests, in the style of `SalesOrderTest`, and run the smoke commands (T-1 to T-3).
- Get business confirmation of the bands and the `max` combination rule.
- Decide whether to expose scoring through `tools/warehouse-server` or the sales-orders UI. The plan treats this as out of scope.

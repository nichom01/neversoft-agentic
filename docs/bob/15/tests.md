# Test plan: #15 Risk scoring

## Summary
21 tests: 3 smoke, 7 BDD, 3 component and 8 unit. The repo has no build file and no BDD or smoke framework. Its only test convention is the dependency-free `javac` + `java` harness in [`SalesOrderTest.java`](../../../src/test/java/com/neversoft/sales/SalesOrderTest.java:16). So every BDD, component and unit test is a named method in one new file, `src/test/java/com/neversoft/sales/SalesOrderRiskScorerTest.java`. The Gherkin is the specification. It is implemented as a method that calls the public `SalesOrderRiskScorer.score`, not as a `.feature` file. Smoke tests are shell commands run from the repo root.

Boundary and branch logic is pushed down to the package-private `valueScore`, `lineScore` and `orderValue` (unit). BDD is kept for behaviour a caller sees through `score(...)`. Component tests cover the combination rule and the contract of the two new types against real `SalesOrder` / `SalesOrderLine` graphs.

T-n is the plan identifier. Each test's Target line gives the matching LLP `R-n` method name used in the test class.

## Smoke
### T-1: Everything compiles under strict flags and both test classes pass
- Target: shell, from repo root, using the compile and run commands in the LLP Rollout section:
  `javac --release 25 -Xlint:all -Werror -d "$OUT" <Customer, SalesOrderLine, SalesOrder, RiskScore, SalesOrderRiskScorer, SalesOrderTest, SalesOrderRiskScorerTest>`, then `java -cp "$OUT" com.neversoft.sales.SalesOrderTest` and `java -cp "$OUT" com.neversoft.sales.SalesOrderRiskScorerTest`. All exit codes must be 0 with no compiler warnings.
- Why this layer: this is the "is it alive" check for a library with no deployment. It is the only check that proves the whole set compiles together with `-Xlint:all -Werror`, and that the pre-existing `SalesOrderTest` still passes. No lower layer can prove either.
- Covers: AC-10, AC-11

### T-2: Existing model files are untouched
- Target: `git status` / `git diff --stat` against the base branch. Only `RiskScore.java`, `SalesOrderRiskScorer.java`, `SalesOrderRiskScorerTest.java` and `docs/bob/15/*` may appear. `Customer.java`, `SalesOrder.java` and `SalesOrderLine.java` must show no diff.
- Why this layer: "unchanged" is a property of the working tree, not of runtime behaviour, so only a repo-level check can prove it.
- Covers: AC-10

### T-3: A failing test makes the harness exit non-zero
- Target: shell. Copy `SalesOrderRiskScorer.java` to a temp directory, edit the copy (for example change the first `VALUE_BOUNDS` entry), compile it with the unchanged test class, and run `java`. The exit code must be 1 and the output must list a failure. Do not touch the source files in the repo.
- Why this layer: AC-11 says the tests exit non-zero on failure. Only running a deliberately broken build proves that the `System.exit(1)` path is wired correctly. A passing run alone cannot show it.
- Covers: AC-11

## BDD
### T-4: One result per order, in input order
```gherkin
Given three sales orders: a low order, a mid order and a high order, in that sequence
When I score the collection
Then I get exactly three results
And the results are in the same sequence as the input
And each result's order is the same instance as the input order at that position
And each score is an integer between 1 and 10 inclusive
```
- Target: `SalesOrderRiskScorerTest` (harness name R-1)
- Why this layer: this is the headline behaviour in the issue, "take a set of orders and apply a risk number". It is seen by the caller through the public `score` API and spans the scorer and `RiskScore`. Ordering and cardinality cannot be proved by a unit test of the helpers.
- Covers: AC-1

### T-5: Empty and valueless orders score the minimum without throwing
```gherkin
Given an order with no lines
And an order whose lines all have a null lineAmount
And an order whose lines all have a lineAmount of zero
And an order with one line of 500 and a second line with a null lineAmount
When I score them
Then no exception is thrown
And the first three orders score 1
And the fourth order scores the same as an order with a single line of 500
```
- Target: `SalesOrderRiskScorerTest` (harness name R-2)
- Why this layer: this is the caller-visible edge-case behaviour that the issue implies. The null-amount arithmetic itself is covered at unit level in T-17. This test proves it through the public path with real `SalesOrderLine` objects.
- Covers: AC-4, AC-8

### T-6: Very large orders are capped at 10
```gherkin
Given an order with one line of value 1,000,000
And an order with 500 lines of value 1 each
And an order with 500 lines of value 1,000,000 each
When I score them
Then every score is exactly 10
```
- Target: `SalesOrderRiskScorerTest` (harness name R-3)
- Why this layer: the cap is a user-visible promise ("never above 10"). It must hold through the clamp in `scoreOrder`, which the helper-level tests do not exercise. The combined case also covers both factors saturating at once.
- Covers: AC-5

### T-7: Null and empty input
```gherkin
Given a null collection
When I score it
Then the result is an empty list

Given an empty collection
When I score it
Then the result is an empty list

Given a collection with a null element at the first, middle or last position
When I score it
Then a NullPointerException is thrown
```
- Target: `SalesOrderRiskScorerTest` (harness name R-4)
- Why this layer: this is the public contract on the `score` entry point, which is the only place that handles null input. A null element is checked at three positions, so a check that only covers the first element cannot pass.
- Covers: AC-7

### T-8: Scoring is side-effect free and independent of the rest of the set
```gherkin
Given an order, and a deep copy of it built beforehand
When I score the order on its own
And I score it again inside a list with a very large order and a very small order
Then both scores are equal
And the order still equals the pre-built copy, including every line
```
- Target: `SalesOrderRiskScorerTest` (harness name R-5, part 1)
- Why this layer: independence from the other items in the collection is a property of the whole `score` call, and it is the reason the plan rejected relative scoring. It cannot be proved at helper level. `SalesOrder.equals` is value-based and covers lines, so it detects any mutation.
- Covers: AC-9

### T-9: A bigger or busier order never scores lower
```gherkin
Given a list of orders with one line each and increasing values 0, 99, 100, 500, 5,000, 100,000
And a list of orders with a fixed value and 1, 2, 4, 10, 50, 100 lines
When I score each list
Then in each list every score is greater than or equal to the previous score
```
- Target: `SalesOrderRiskScorerTest` (harness name R-6, monotonic part)
- Why this layer: the issue's phrase "based on the value ... and the number of lines" implies that more of either means more risk. This test shows it from the caller's side with real orders. The exhaustive sweep is at unit level in T-16. This BDD test checks the property survives the full `score` path.
- Covers: AC-3

### T-10: Only value and line count matter
```gherkin
Given two orders with the same total value and the same number of lines
But different status, customer, id, quantity, unit price and line descriptions
When I score them
Then both receive the same score
```
- Target: `SalesOrderRiskScorerTest` (harness name R-6, input-independence part)
- Why this layer: AC-2 is about what the score is derived from. Only a full `score` call over orders that differ in other fields can show those fields are ignored. Reading the code cannot.
- Covers: AC-2

## Component
### T-11: Combination rule is the higher of the two sub-scores
- Target: `SalesOrderRiskScorer.score` over real `SalesOrder` and `SalesOrderLine` graphs, in `SalesOrderRiskScorerTest` (harness name R-6). Expected results use the bands in the LLP table:
  - value-dominated: 1 line of 60,000 gives value 9, lines 1, so 9
  - line-dominated: 20 lines of 1 give value 1, lines 7, so 7
  - mixed: 5 lines of 30,000 (150,000) give value 10, lines 3, so 10
  - both middling: 4 lines totalling 600 give value 3, lines 3, so 3
- Why this layer: the `max` rule is the seam between the value factor, the line factor and the clamp. It is also a documented business assumption in the HLP. Unit tests of each factor cannot show the factors are combined correctly, and a BDD test would be too coarse to pin the rule.
- Covers: AC-2, AC-3, risk: Thresholds and combination rule are a business decision the issue does not specify, so scores may not match the author's expectation

### T-12: Result types are immutable and validated
- Target: `RiskScore` and the list returned by `SalesOrderRiskScorer.score`, in `SalesOrderRiskScorerTest` (harness name R-7).
  - `add` on the returned list throws `UnsupportedOperationException`.
  - `new RiskScore(null, 5)` throws `NullPointerException`.
  - `new RiskScore(order, 0)` and `new RiskScore(order, 11)` throw `IllegalArgumentException`.
  - `new RiskScore(order, 1)` and `new RiskScore(order, 10)` are accepted.
- Why this layer: this is the contract of the new public types at the boundary the caller sees. It is not scoring logic, so it is not a BDD scenario, and it needs real `SalesOrder` instances for the `order()` accessor.
- Covers: AC-1, AC-5

### T-13: Equal orders are not collapsed
- Target: `SalesOrderRiskScorer.score`, in `SalesOrderRiskScorerTest` (harness name R-5, part 2).
  - The same instance supplied twice returns two results.
  - Two distinct but `equals` orders return two results, each with its own `order()` instance.
  - A `Set`-typed input (for example `LinkedHashSet`) is accepted and scored in iteration order.
- Why this layer: the HLP chose a list return type specifically to avoid `equals`/`hashCode` key collisions. This checks the choice at the `score` boundary. A unit test of the helpers cannot see it.
- Covers: AC-1, risk: SalesOrder is mutable and its equals/hashCode are value-based, so using orders as map keys could collapse equal orders

## Unit
### T-14: Value band boundaries
- Target: `SalesOrderRiskScorer.valueScore` and `VALUE_BOUNDS`, in `SalesOrderRiskScorerTest` (harness name R-8). For each bound `b` at index `i`, `valueScore(b - 0.01)` is `i + 1` and `valueScore(b)` is `i + 2`. Also `valueScore(0)` is 1, `valueScore(huge)` is 10, and the result is never outside 1-10.
- Why this layer: this is pure logic with 9 boundaries. Looping over the real constant means the test stays right if the bands are retuned, and it can only be done at the helper level.
- Covers: AC-6, AC-3, AC-5

### T-15: Line count band boundaries
- Target: `SalesOrderRiskScorer.lineScore` and `LINE_BOUNDS`, in `SalesOrderRiskScorerTest` (harness name R-9). For each bound `b` at index `i`, `lineScore(b - 1)` is `i + 1` and `lineScore(b)` is `i + 2`. Also `lineScore(0)` is 1 and `lineScore(Integer.MAX_VALUE)` is 10.
- Why this layer: same as T-14, for the second factor. AC-6 requires both factors, so each has its own test.
- Covers: AC-6, AC-3, AC-5

### T-16: Monotonicity sweep
- Target: `valueScore`, `lineScore` and `scoreOrder`, in `SalesOrderRiskScorerTest` (harness name R-10). Sweep value from 0 to 150,000 in small steps and line count from 0 to 150. Neither sub-score ever decreases. `scoreOrder` never decreases when one factor rises with the other held fixed, checked at several fixed values of the other factor.
- Why this layer: monotonicity is a property over many inputs, so it needs a cheap sweep that is impractical to run through `score` with real order graphs. T-9 covers the same promise in a few examples at BDD level.
- Covers: AC-3

### T-17: Order value arithmetic
- Target: `SalesOrderRiskScorer.orderValue`, in `SalesOrderRiskScorerTest` (harness name R-11, part 1).
  - Amounts are summed.
  - A null `lineAmount` counts as zero and does not throw.
  - An order with no lines gives `BigDecimal.ZERO`.
  - A negative total (for example 50 and -80) gives zero.
  - A negative line within a positive total (for example 200 and -50) gives 150.
- Why this layer: this is branch logic (null, empty, negative). It is cheapest to prove directly on the helper. It is the only test of the negative clamp mitigation.
- Covers: AC-8, AC-4, AC-2, risk: Negative lineAmount (for example credits) could push an order's total below zero

### T-18: Scale-insensitive comparison
- Target: `SalesOrderRiskScorer.valueScore` and `orderValue`, in `SalesOrderRiskScorerTest` (harness name R-11, part 2). `valueScore` returns the same score for `100`, `100.0` and `100.00`. `1.0` plus `99.00` sums to a value that scores the same as `100`. `99.99` and `100.00` score differently.
- Why this layer: `BigDecimal.equals` is scale-sensitive (see `SalesOrderTest` T-25). A wrong implementation would only show in the boundary comparison, which is a helper-level detail.
- Covers: AC-6, risk: lineAmount is stored rather than derived and may be null or inconsistent with quantity times unit price

### T-19: Value comes from lineAmount, not quantity times unit price
- Target: `SalesOrderRiskScorer.scoreOrder`, in `SalesOrderRiskScorerTest` (harness name R-11, part 3). Build a line whose `quantity * unitPrice` differs greatly from its `lineAmount` (for example 1 x 1 with `lineAmount` 60,000, and 1,000 x 1,000 with `lineAmount` 1). The score follows `lineAmount` only.
- Why this layer: the HLP names `lineAmount` as the single source of value, and the model does not keep it in step with quantity and price. The check needs hand-built inconsistent lines, which is easiest at the helper level.
- Covers: AC-2, risk: lineAmount is stored rather than derived and may be null or inconsistent with quantity times unit price

### T-20: Constants are well formed and in one place
- Target: `SalesOrderRiskScorer.VALUE_BOUNDS`, `LINE_BOUNDS`, `MIN_SCORE`, `MAX_SCORE`, in `SalesOrderRiskScorerTest` (harness name R-12).
  - Both bound lists have 9 entries and are strictly ascending.
  - `MIN_SCORE` is 1 and `MAX_SCORE` is 10.
  - Both lists are immutable (`add` throws).
  - Number of bounds plus one equals `MAX_SCORE`, so every score from 1 to 10 is reachable by each factor.
- Why this layer: boundary tests in T-14 and T-15 loop over these constants, so a malformed list (unsorted, wrong length) would make those tests meaningless. This guards the guard. It also supports "defined in one place" for retuning.
- Covers: AC-6, risk: Thresholds and combination rule are a business decision the issue does not specify, so scores may not match the author's expectation

### T-21: Inputs are not mutated by the helpers
- Target: `orderValue`, `scoreOrder`, in `SalesOrderRiskScorerTest` (harness name R-5, part 3). Build an order and a deep copy. Call `orderValue` and `scoreOrder` several times. The order still equals the copy, `getLines()` has the same size and the same `SalesOrderLine` instances, and repeated calls give the same result.
- Why this layer: T-8 proves no mutation through `score`. This proves the helpers do not mutate either, and that they are deterministic. A failure points straight at the helper to fix.
- Covers: AC-9

## Coverage
| Criterion / risk | Smoke | BDD | Component | Unit |
|---|---|---|---|---|
| AC-1 | | T-4 | T-12, T-13 | |
| AC-2 | | T-10 | T-11 | T-17, T-19 |
| AC-3 | | T-9 | T-11 | T-14, T-15, T-16 |
| AC-4 | | T-5 | | T-17 |
| AC-5 | | T-6 | T-12 | T-14, T-15 |
| AC-6 | | | | T-14, T-15, T-18, T-20 |
| AC-7 | | T-7 | | |
| AC-8 | | T-5 | | T-17 |
| AC-9 | | T-8 | | T-21 |
| AC-10 | T-1, T-2 | | | |
| AC-11 | T-1, T-3 | | | |
| risk: Thresholds and combination rule are a business decision the issue does not specify | | | T-11 | T-20 |
| risk: lineAmount is stored rather than derived and may be null or inconsistent | | | | T-18, T-19 |
| risk: Negative lineAmount could push an order's total below zero | | | | T-17 |
| risk: Scoring is a feature with no current caller, so it could drift from future needs | | | | |
| risk: SalesOrder equals/hashCode are value-based, so map keys could collapse equal orders | | | T-13 | |

## Gaps
- AC-6 "documented": whether the Javadoc describes the rule and the band table is a review item. A test cannot judge documentation quality. The "defined in one place" half is covered by T-20, and the boundary half by T-14 and T-15.
- Risk "Scoring is a feature with no current caller, so it could drift from future needs": this is a product risk, not a behaviour. Its mitigation is a small API surface, which is checked in code review. No test.
- Business correctness of the band values and the `max` combination rule (open questions): tests pin the implemented bands and rule, but cannot show they match the author's intent. That needs confirmation from the issue author before merge.
- No REST or UI tests: the HLP excludes exposure through `tools/warehouse-server` and `sales-orders-ui`. Existing tests in those tools are not affected by this change.
- No performance or concurrency tests: the scorer is stateless, in-memory and called with small collections, and the issue sets no performance need.

# Low-level plan: #15 Risk scoring

## Overview
The approved high-level plan adds a stateless scorer and a small immutable result type to `com.neversoft.sales`, plus one dependency-free test class. The repo has no build file. Code is compiled with plain `javac --release 25 -Xlint:all -Werror`, as described in [`SalesOrderTest.java`](../../../src/test/java/com/neversoft/sales/SalesOrderTest.java:16). Nothing existing is modified. The scorer only reads [`SalesOrder.getLines()`](../../../src/main/java/com/neversoft/sales/SalesOrder.java:71) and [`SalesOrderLine.getLineAmount()`](../../../src/main/java/com/neversoft/sales/SalesOrderLine.java:77).

Scoring rule (fixed here so the implementation does not re-decide it):
1. `value` = sum of non-null `lineAmount`s (null counts as zero), clamped to a minimum of zero.
2. `valueScore` = 1 + the number of `VALUE_BOUNDS` entries that are `<= value`.
3. `lineScore` = 1 + the number of `LINE_BOUNDS` entries that are `<= lines.size()`.
4. Final score = `max(valueScore, lineScore)`, clamped to 1-10. The higher sub-score is the conservative default from the HLP open questions.

Bands are lower-inclusive. A bound is the lowest input that earns the next score. Nine bounds give a score range of 1 to 10.

| Score | Value from (inclusive) | Lines from (inclusive) |
|---|---|---|
| 1 | 0 | 0 |
| 2 | 100 | 2 |
| 3 | 500 | 4 |
| 4 | 1000 | 6 |
| 5 | 2500 | 10 |
| 6 | 5000 | 15 |
| 7 | 10000 | 20 |
| 8 | 25000 | 30 |
| 9 | 50000 | 50 |
| 10 | 100000 | 100 |

The bands are implementer defaults, not business-mandated numbers (HLP assumption). They live only in the two constants in `SalesOrderRiskScorer` (AC-6).

## Changes by file
### src/main/java/com/neversoft/sales/RiskScore.java (create)
- Immutable result pairing an order with its score. Implemented as a `record` (Java 25), so no setters and no extra boilerplate.
- The compact constructor rejects a null order with `Objects.requireNonNull(order, "order")`. It throws `IllegalArgumentException` if `score` is outside 1-10.
- The record is not stored on `SalesOrder`, so `SalesOrder.equals`/`hashCode`/`toString` and the reflection tests T-8 to T-18 are unaffected.
- Symbols: `RiskScore`, `RiskScore(SalesOrder order, int score)`, `order()`, `score()`
- Covers: AC-1, AC-5, AC-10

### src/main/java/com/neversoft/sales/SalesOrderRiskScorer.java (create)
- `public final class` with a private constructor and only static members.
- Constants, declared package-private so the test can iterate over them for boundary checks (AC-6):
  - `MIN_SCORE = 1`, `MAX_SCORE = 10`
  - `VALUE_BOUNDS`: `List<BigDecimal>` = `List.of(new BigDecimal("100"), "500", "1000", "2500", "5000", "10000", "25000", "50000", "100000")`
  - `LINE_BOUNDS`: `List<Integer>` = `List.of(2, 4, 6, 10, 15, 20, 30, 50, 100)`
  - Javadoc on the class documents the rule, the band table and the null/negative handling.
- `public static List<RiskScore> score(Collection<SalesOrder> orders)`:
  - If `orders` is null or empty, return `List.of()`.
  - Otherwise iterate in iteration order. Each element goes through `Objects.requireNonNull(order, "order")`, so a null element throws `NullPointerException` (AC-7).
  - Add `new RiskScore(order, scoreOrder(order))` to an `ArrayList`. Return `List.copyOf(list)`, which is immutable and in input order (AC-1).
  - Scoring is per order with no shared state, so one order's score never depends on the others (AC-9). Nothing is mutated.
- `static int scoreOrder(SalesOrder order)`: `Math.min(MAX_SCORE, Math.max(MIN_SCORE, Math.max(valueScore(orderValue(order)), lineScore(order.getLines().size()))))`. Uses only value and line count (AC-2, AC-3, AC-4, AC-5).
- `static BigDecimal orderValue(SalesOrder order)`: sums `getLineAmount()` over `order.getLines()`, skipping nulls (AC-8). Starts from `BigDecimal.ZERO`. Returns `BigDecimal.ZERO` if the sum is negative (credits clamp to zero).
- `static int valueScore(BigDecimal value)`: 1 + the count of `VALUE_BOUNDS` entries `b` with `b.compareTo(value) <= 0`. Uses `compareTo`, not `equals`, because `BigDecimal.equals` is scale-sensitive (see the `SalesOrderLine` Javadoc).
- `static int lineScore(int lineCount)`: 1 + the count of `LINE_BOUNDS` entries `<= lineCount`.
- Both sub-score functions are monotone non-decreasing in their input, and `max` preserves that, which gives AC-3.
- No logging, no I/O, no framework imports.
- Symbols: `SalesOrderRiskScorer`, `score`, `scoreOrder`, `orderValue`, `valueScore`, `lineScore`, `VALUE_BOUNDS`, `LINE_BOUNDS`, `MIN_SCORE`, `MAX_SCORE`
- Covers: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-11

### src/test/java/com/neversoft/sales/SalesOrderRiskScorerTest.java (create)
- Dependency-free harness copied in style from `SalesOrderTest`: `main`, a `FAILURES` list, `test(name, Runnable)`, `check`, `eq`. Exits with `System.exit(1)` if any test fails (AC-11).
- The class Javadoc carries the compile and run commands (see Rollout).
- Helpers: `order(String... lineAmounts)` builds a `SalesOrder` with one line per amount (a null string gives a null `lineAmount`). `orderWithLines(int n, String amountEach)` builds an order with n lines.
- Tests are listed in the Test approach section. They are named `R-1`...`R-n` in the style of `T-n`.
- Symbols: `SalesOrderRiskScorerTest`, `main`, `test`, `check`, `eq`
- Covers: AC-1 to AC-11

### src/main/java/com/neversoft/sales/SalesOrder.java, SalesOrderLine.java and src/main/java/com/neversoft/customer/Customer.java (no change)
- Read only. AC-10 is verified by `git status` and by running `SalesOrderTest` unchanged.
- Covers: AC-10

## Interfaces
```java
// com.neversoft.sales
public record RiskScore(SalesOrder order, int score) {
    public RiskScore { /* requireNonNull(order); score in [1,10] else IllegalArgumentException */ }
}

public final class SalesOrderRiskScorer {
    static final int MIN_SCORE = 1;
    static final int MAX_SCORE = 10;
    static final List<BigDecimal> VALUE_BOUNDS;   // 9 ascending lower bounds for scores 2..10
    static final List<Integer> LINE_BOUNDS;       // 9 ascending lower bounds for scores 2..10

    public static List<RiskScore> score(Collection<SalesOrder> orders);
    // null/empty -> List.of(); null element -> NullPointerException; result immutable, input order

    static int scoreOrder(SalesOrder order);
    static BigDecimal orderValue(SalesOrder order);   // null lineAmount = 0, floor 0
    static int valueScore(BigDecimal value);
    static int lineScore(int lineCount);
}
```
Package-private members exist for white-box boundary tests in the same package. Only `score` and `RiskScore` are public API.

## Data and configuration changes
None. There is no schema, migration, flag or env var. Thresholds are source constants. `package.json` and the other tools are untouched.

## Test approach
Tests are run as plain `javac` and `java`, with no BDD or smoke framework in the repo. Layers are mapped as follows. Each test is a method in `SalesOrderRiskScorerTest`.

| Layer | What | Covers |
|---|---|---|
| smoke | Compile `Customer`, `SalesOrderLine`, `SalesOrder`, `RiskScore`, `SalesOrderRiskScorer` and both test classes with `javac --release 25 -Xlint:all -Werror`. Run `java -cp "$OUT" com.neversoft.sales.SalesOrderRiskScorerTest` and check exit code 0. Also run `SalesOrderTest`. | AC-10, AC-11 |
| smoke | `git status` shows only the three new source files plus `docs/bob/15/*`. | AC-10 |
| bdd | R-1: given three orders (low, mid, high), `score` returns three results in input order, and `result.order()` is the same instance as the input at each position. Every score is in 1-10. | AC-1 |
| bdd | R-2: an order with 0 lines scores 1. An order with lines of all-null or all-zero amounts scores 1. Neither throws. | AC-4, AC-8 |
| bdd | R-3: an order of 1,000,000 value, and an order of 500 lines, each score exactly 10. | AC-5 |
| bdd | R-4: `score(null)` and `score(List.of())` return an empty list. A list containing a null element throws `NullPointerException`. The null element is checked at the first, middle and last position. | AC-7 |
| bdd | R-5: scoring the same order alone and inside a mixed list gives the same score. Its lines and fields are unchanged after scoring (compare `equals` against a pre-built copy). The same order appearing twice yields two results. | AC-9, AC-1 |
| component | R-6: end to end `score` over mixed orders. The score equals `max(valueScore, lineScore)` for a value-dominated order (1 line, 60000, so 9), a line-dominated order (20 lines of 1, so 7) and a mixed one. | AC-2, AC-3 |
| component | R-7: the returned list is immutable (`add` throws `UnsupportedOperationException`). `RiskScore` rejects a null order and a score of 0 or 11. | AC-1, AC-5 |
| unit | R-8: value boundaries. For each `b` in `VALUE_BOUNDS` at index i, `valueScore(b - 0.01)` is `i + 1` and `valueScore(b)` is `i + 2`. Also `valueScore(0)` is 1 and `valueScore(huge)` is 10. | AC-6, AC-3 |
| unit | R-9: line boundaries. For each `b` in `LINE_BOUNDS` at index i, `lineScore(b - 1)` is `i + 1` and `lineScore(b)` is `i + 2`. Also `lineScore(0)` is 1 and `lineScore(Integer.MAX_VALUE)` is 10. | AC-6, AC-3 |
| unit | R-10: monotonicity. Sweep value from 0 to 150000 in steps and line count from 0 to 150. `valueScore` and `lineScore` never decrease. `scoreOrder` never decreases when either factor rises with the other held fixed. | AC-3 |
| unit | R-11: `orderValue` sums non-null amounts, treats null as zero, and returns zero for a negative total (for example 50 and -80). It also gives 100 for `1.0` + `99.00` and `valueScore` treats `100`, `100.0` and `100.00` the same (scale-insensitive). | AC-8, AC-2, AC-4 |
| unit | R-12: constants are well formed. Both bound lists have 9 entries and are strictly ascending, and `MIN_SCORE` is 1 and `MAX_SCORE` is 10. | AC-6 |

## Rollout
1. Create `RiskScore.java`, then `SalesOrderRiskScorer.java`, then `SalesOrderRiskScorerTest.java`. All three are in a single commit.
2. Verify with the following commands, which are also placed in the test class Javadoc:
   ```
   OUT=$(mktemp -d)
   javac --release 25 -Xlint:all -Werror -d "$OUT" \
       src/main/java/com/neversoft/customer/Customer.java \
       src/main/java/com/neversoft/sales/SalesOrderLine.java \
       src/main/java/com/neversoft/sales/SalesOrder.java \
       src/main/java/com/neversoft/sales/RiskScore.java \
       src/main/java/com/neversoft/sales/SalesOrderRiskScorer.java \
       src/test/java/com/neversoft/sales/SalesOrderTest.java \
       src/test/java/com/neversoft/sales/SalesOrderRiskScorerTest.java
   java -cp "$OUT" com.neversoft.sales.SalesOrderTest
   java -cp "$OUT" com.neversoft.sales.SalesOrderRiskScorerTest
   ```
3. No flags and no backwards-compatibility concerns. The change is purely additive, and nothing calls the scorer yet. Exposure over REST or UI is a follow-up (see the HLP).

## Open questions
- Business confirmation of the value bands and line-count bands in the table above (they are placeholders chosen by the implementer).
- Confirmation that combining by `max` is wanted rather than an average.
- Whether a follow-up should expose scoring through `tools/warehouse-server` or the sales-orders UI (out of scope here).

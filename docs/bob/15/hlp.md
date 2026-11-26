# High-level plan: #15 Risk scoring

## Summary
Add a small, pure-Java risk scoring component in the `com.neversoft.sales` package that takes a collection of `SalesOrder`s and assigns each an integer risk score from 1 to 10, derived from the order's total value and its number of lines.

## Approach
The domain model is plain Java objects with no framework, no build file and a dependency-free `javac` test harness (see `SalesOrderTest`). The scoring therefore fits as one new stateless class in `com.neversoft.sales` next to `SalesOrder` and `SalesOrderLine`, with no changes to those existing classes.

Order value is the sum of `SalesOrderLine.getLineAmount()` across the order's lines. `lineAmount` is a stored value (not derived from quantity and unit price) and is nullable, so null amounts count as zero. Line count is `getLines().size()`. Each factor is mapped to a 1-10 sub-score through fixed, documented threshold bands held as constants. The two sub-scores are combined into one final score, clamped to 1-10. Thresholds are absolute rather than relative to the input set, so an order's score does not change depending on which other orders are scored with it. This makes results deterministic and testable.

The result is returned per order, preserving input order, as a small immutable value pairing the order with its score. It is not stored on `SalesOrder`, because that class is `equals`/`hashCode`-sensitive and its fields are marked provisional. Null or empty input yields an empty result. A null element is rejected, matching the `Objects.requireNonNull` convention in `SalesOrder.addLine`.

A new dependency-free test class follows the existing harness style and is run with plain `javac` and `java`.

## Alternatives considered
- Add a `riskScore` field and getter to `SalesOrder` — rejected: changes `equals`/`hashCode`/`toString` and the reflection-based structure tests (T-8 to T-18), and stores derived data on a provisional model.
- Score relative to the set (percentile or min-max normalisation) — rejected: scores would shift whenever the set changes, and a set of one order would be meaningless. The issue does not ask for relative ranking.
- Continuous formula (for example logarithmic scaling of value) instead of banded thresholds — rejected: harder to explain, review and test at boundaries. Bands are easy to tune later.
- Expose over REST in `tools/warehouse-server` or in `sales-orders-ui` — rejected: the issue asks for a way to score orders, not an endpoint or UI. It can be a follow-up.
- Introduce a build tool or JUnit — rejected: out of scope. The repo's convention is the dependency-free harness.

## Components affected
- `com.neversoft.sales` scoring component (new) — computes order value and line count, maps each to a 1-10 sub-score through threshold bands, combines them, and returns an ordered list of order/score results for a collection of orders.
- Risk result value type (new, in the same package) — immutable pairing of a `SalesOrder` and its score from 1 to 10.
- Scoring test harness (new, `src/test/java/com/neversoft/sales`) — dependency-free tests in the style of `SalesOrderTest`, covering band boundaries, null and empty handling, bounds, and ordering.
- `SalesOrder`, `SalesOrderLine` — read only, no changes.

## Acceptance criteria
- AC-1: Given a collection of `SalesOrder`s, the scorer returns exactly one result per input order, in input order, each with an integer score between 1 and 10 inclusive.
- AC-2: An order's score is derived only from its total value (sum of its lines' `lineAmount`) and its number of lines.
- AC-3: Holding line count constant, a higher total value never gives a lower score. Holding value constant, a higher line count never gives a lower score.
- AC-4: An order with no lines, or whose line amounts are all null or zero, scores the minimum of 1 and does not throw.
- AC-5: An order with very large value and/or many lines is capped at 10, never above.
- AC-6: Threshold boundaries are defined in one place and documented. Tests cover the value on each side of every boundary, for both factors.
- AC-7: A null or empty collection returns an empty result. A null element in the collection is rejected with a `NullPointerException`.
- AC-8: A line with a null `lineAmount` is treated as zero value and does not cause a `NullPointerException`.
- AC-9: Scoring does not mutate the orders or lines passed in, and a given order's score does not depend on the other orders in the collection.
- AC-10: `SalesOrder`, `SalesOrderLine` and `Customer` are unchanged, and the existing `SalesOrderTest` still passes.
- AC-11: New main and test code compile with `javac --release 25 -Xlint:all -Werror` and the new tests run with plain `java` and exit non-zero on failure.

## Dependencies on other issues
- None known. The existing sales order model (issue #4) is already on the branch.

## Assumptions
- "Set of sales orders" means any `Collection<SalesOrder>`, with no uniqueness requirement beyond what the caller supplies.
- "Value of each one" means the sum of `SalesOrderLine.lineAmount`. Currency is a single, implicit currency, as the model has no currency field.
- Higher value and more lines both mean higher risk, and 10 is the highest risk.
- The deliverable is a library-level capability in the Java domain model, not an API endpoint or UI feature.
- Initial threshold bands and the combination rule are reasonable defaults chosen by the implementer and documented in code. They are not business-mandated numbers.
- Orders in any `status` are scored the same way. Status is not an input.
- Java 25 and no external libraries, per the existing test harness comment.

## Risks
| Risk | Severity | Mitigation |
|---|---|---|
| Thresholds and combination rule are a business decision the issue does not specify, so the scores may not match the author's expectation | medium | Keep thresholds as named constants in one place, document the rule in Javadoc, and raise it in the open questions for confirmation before merge |
| `lineAmount` is stored rather than derived and may be null or inconsistent with quantity times unit price | medium | Use `lineAmount` as the single source of value, treat null as zero, and state this in the assumptions and Javadoc |
| Negative `lineAmount` (for example credits) could push an order's total below zero | low | Clamp the total at zero for scoring, and cover it with a test |
| Scoring is a feature with no current caller, so it could drift from future needs | low | Keep the API minimal, with no persistence or framework coupling, so it is cheap to change |
| `SalesOrder` is mutable and its `equals`/`hashCode` are value-based, so using orders as map keys could collapse equal orders | low | Return an ordered list of results rather than a `Map<SalesOrder, Integer>` |

## Open questions
- What are the intended value bands (currency amounts) and line-count bands for the 1-10 scale?
- How should the two factors be combined: the higher of the two sub-scores, or an average? This plan defaults to the higher, as a conservative risk view, pending confirmation.
- Should the score be exposed through the warehouse server or the sales-orders UI in a follow-up?

## Complexity
S — one new stateless class, one small value type and one test class, with no changes to existing code. The only real uncertainty is the business rule, not the engineering.

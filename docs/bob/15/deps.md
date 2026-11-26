# Dependency check: #15 Risk scoring

## Summary
#15 relies on the `SalesOrder` / `SalesOrderLine` model delivered by #4, which is already done and on the branch, so that dependency is satisfied. No other open issue touches the same files. One loose conceptual overlap with #5 (how an order's value is defined) is worth noting but does not affect ordering.

## Dependencies
| Issue | Relationship | Confidence | Why | Shared |
|---|---|---|---|---|
| #4 | blocked by | high | The #15 plan explicitly builds on #4's model ("The existing sales order model (issue #4) is already on the branch"). It reads `SalesOrder.getLines()` and `SalesOrderLine.getLineAmount()`. #4 is `bob:done` and `SalesOrder.java`, `SalesOrderLine.java` and `Customer.java` exist in the tree, so this is satisfied. #15 only reads these classes (AC-10) and adds new files. | `com.neversoft.sales.SalesOrder`, `com.neversoft.sales.SalesOrderLine` |
| #5 | overlaps | low | Both deal with the value of a sales order. #5's UI computes the order total as the sum of line totals (quantity × unit price) in client-side TypeScript. #15 uses the stored `lineAmount` in Java. No files are shared and neither plan relies on the other, so merge order does not matter. | concept only: "order total" |

No dependency with #1, #3, #6 or #8:
- #1 and #3 touch `com.neversoft.vehicle` and `com.neversoft.warehouse`. #3 extends the root `package.json` test script. #15 does not edit `package.json` and runs its tests with plain `javac` and `java` (AC-11).
- #6 adds `tools/warehouse-server` and `tools/warehouse-ui`, which cover Vehicle CRUD only. #15 explicitly rejects exposing scoring over REST and lists it as a follow-up.
- #8 restyles `tools/bob-pipeline/apps/web`, which is unrelated to #15.

## Conflicts
- #5 and #15 define an order's "value" differently. #5 derives line totals from quantity and unit price. #15 uses the stored `lineAmount`, which its plan notes may not equal quantity × unit price. This is not a file or merge conflict, because the UI has no backend and nothing links the two. It would matter only if the score were later shown in the UI. Recommend recording the #15 definition in the Javadoc, as the plan already intends.

## Recommended order
#4 → #5 → #15

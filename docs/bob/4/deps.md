# Dependency check: #4 sales orders

## Summary
Issue #4 is independent: it adds new Java domain classes (`SalesOrder`, `SalesOrderLine`, `Customer`) in new packages and modifies no existing file. No other plan needs it first or must land before it. Only low-confidence, non-blocking overlaps exist with #3 and #5.

## Dependencies
| Issue | Relationship | Confidence | Why | Shared |
|---|---|---|---|---|
| #3 | overlaps | low | Both add new POJOs under `src/main/java/com/neversoft/` in different packages (`sales`/`customer` vs `warehouse`), so no file clash. #3 edits the root `package.json` test script, which names the `Vehicle` files explicitly ([`package.json`](../../../package.json:6)). #4 does not touch it (AC-7), so its classes are not compiled by `npm test`. If #4 later adds tests or wires itself into that script, it will conflict with #3's edit and should merge after #3. | `package.json` (only if #4 later extends the test script), `src/main/java/com/neversoft/` |
| #5 | overlaps | low | #5 is a standalone React app in `sales-orders-ui/` and shares no files with #4. Both model the same sales-order concept (order, lines, customer, quantity, unit price). #5 is client-side only and does not consume the Java classes, so neither blocks the other. #5's open question about a future backend API shaped to the domain could later link the two. | Sales order domain concept only (no shared files) |

#1 (`Vehicle`, already done) is not a dependency. #4 follows the `Vehicle` POJO conventions, and that file is already in the tree.

## Conflicts
- None. #5 holds the customer as a plain name field while #4 defines a `Customer` class. That is not contradictory, because the two do not integrate and each plan states its fields are provisional.

## Recommended order
#3 → #4 → #5

(The order only matters if #4 later touches `package.json`. #5 is independent and can merge at any point.)

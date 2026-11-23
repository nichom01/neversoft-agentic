# Dependency check: #5 ui for sales orders

## Summary
#5 is functionally independent: it adds a self-contained client-side React app in `sales-orders-ui/` and touches no files that #1, #3 or #4 touch. The only link is a conceptual one with #4 (both model sales orders and lines), so there is a weak, low-confidence ordering preference and no hard blocker.

## Dependencies
| Issue | Relationship | Confidence | Why | Shared |
|---|---|---|---|---|
| #4 | overlaps | low | Both plans define a sales order / sales order line model. #4 adds Java POJOs (`SalesOrder`, `SalesOrderLine`, `Customer`) under `src/main/java/com/neversoft/`. #5 defines its own TypeScript model in `sales-orders-ui/src`. #5 explicitly assumes "no backend or API exists or is wanted", so it does not rely on #4's output. No files are shared. Field names are provisional in both plans and could be aligned (see Conflicts). | Sales order / sales order line domain concept only (no shared files) |

No relationship was found with #3 (warehouse Java classes plus a root `package.json` test script change) or #1 (`Vehicle` class). #5 commits not to edit the root `package.json` (AC-8), so it does not clash with #3's extension of that file. Both #3 and #1 are already `bob:done` or past their approved plans and use files that #5 does not touch.

## Conflicts
- None. The #4 and #5 models differ in shape, but neither plan assumes the other's shape, and the two do not connect:
  - #4 has `status` and a `Customer` object reference.
  - #5 has a customer name string and an order date.

  If a backend is added later, the two models will need to be aligned. That is outside both plans.

## Recommended order
#4 → #5

The order is a preference, not a requirement. #5 can merge before or after #4 with no file conflicts.

# What has changed: #4 sales orders

## Summary
Adds Java domain classes for [`Customer`](src/main/java/com/neversoft/customer/Customer.java:9), [`SalesOrderLine`](src/main/java/com/neversoft/sales/SalesOrderLine.java:15), and [`SalesOrder`](src/main/java/com/neversoft/sales/SalesOrder.java:19) under `src/main/java/com/neversoft/`, establishing customer association and line item management for sales orders. The implementation adheres to plain Java object (POJO) conventions with no external dependencies and includes a comprehensive test harness covering structure, contracts, and encapsulation. All changes are purely additive without modifying existing files or build configurations.

## Changes
| Area | Files | What changed | Why |
|---|---|---|---|
| Customer Domain | [`src/main/java/com/neversoft/customer/Customer.java`](src/main/java/com/neversoft/customer/Customer.java:9) | Created public POJO [`Customer`](src/main/java/com/neversoft/customer/Customer.java:9) with fields (`id`, `name`, `email`, `phone`), no-arg and all-fields constructors, getters/setters, and `equals`/`hashCode`/`toString`. | Implements AC-3 to represent customer details associated with sales orders. |
| Sales Domain | [`src/main/java/com/neversoft/sales/SalesOrderLine.java`](src/main/java/com/neversoft/sales/SalesOrderLine.java:15) | Created public child POJO [`SalesOrderLine`](src/main/java/com/neversoft/sales/SalesOrderLine.java:15) with fields (`id`, `itemCode`, `description`, `quantity`, `unitPrice`, `lineAmount`), getters/setters, and `equals`/`hashCode`/`toString`, without back-references to [`SalesOrder`](src/main/java/com/neversoft/sales/SalesOrder.java:19). | Implements AC-2 to represent order line items while preventing circular reference recursion. |
| Sales Domain | [`src/main/java/com/neversoft/sales/SalesOrder.java`](src/main/java/com/neversoft/sales/SalesOrder.java:19) | Created public parent POJO [`SalesOrder`](src/main/java/com/neversoft/sales/SalesOrder.java:19) with fields (`id`, `orderDate`, `status`, `customer`, `lines`), defensive copying, unmodifiable list view via `getLines()`, `addLine`, `removeLine`, and `equals`/`hashCode`/`toString`. | Implements AC-1 and AC-4 to manage order headers, customer association, and child line collections. |
| Sales Testing | [`src/test/java/com/neversoft/sales/SalesOrderTest.java`](src/test/java/com/neversoft/sales/SalesOrderTest.java:31) | Created dependency-free test harness running 23 test methods across BDD, component, and unit test layers using plain JDK `javac`/`java`. | Verifies AC-1 through AC-6 and guards domain invariants without third-party test dependencies. |

## Acceptance criteria
| Criterion | Status | Evidence (file, test) |
|---|---|---|
| AC-1 | Met | [`src/main/java/com/neversoft/sales/SalesOrder.java`](src/main/java/com/neversoft/sales/SalesOrder.java:19), [`src/test/java/com/neversoft/sales/SalesOrderTest.java`](src/test/java/com/neversoft/sales/SalesOrderTest.java:37) (T-3, T-5, T-10, T-11, T-12, T-13) |
| AC-2 | Met | [`src/main/java/com/neversoft/sales/SalesOrderLine.java`](src/main/java/com/neversoft/sales/SalesOrderLine.java:15), [`src/test/java/com/neversoft/sales/SalesOrderTest.java`](src/test/java/com/neversoft/sales/SalesOrderTest.java:39) (T-5, T-9, T-11, T-12, T-13, T-25) |
| AC-3 | Met | [`src/main/java/com/neversoft/customer/Customer.java`](src/main/java/com/neversoft/customer/Customer.java:9), [`src/test/java/com/neversoft/sales/SalesOrderTest.java`](src/test/java/com/neversoft/sales/SalesOrderTest.java:39) (T-5, T-8, T-11, T-12, T-13) |
| AC-4 | Met | [`src/main/java/com/neversoft/sales/SalesOrder.java`](src/main/java/com/neversoft/sales/SalesOrder.java:68) (`setCustomer`, `getLines`, `setLines`, `addLine`, `removeLine`), [`src/test/java/com/neversoft/sales/SalesOrderTest.java`](src/test/java/com/neversoft/sales/SalesOrderTest.java:37) (T-3, T-4, T-6, T-10, T-19, T-20, T-21, T-22, T-23, T-24) |
| AC-5 | Met | [`src/main/java/com/neversoft/customer/Customer.java`](src/main/java/com/neversoft/customer/Customer.java:17), [`src/main/java/com/neversoft/sales/SalesOrderLine.java`](src/main/java/com/neversoft/sales/SalesOrderLine.java:24), [`src/main/java/com/neversoft/sales/SalesOrder.java`](src/main/java/com/neversoft/sales/SalesOrder.java:28), [`src/test/java/com/neversoft/sales/SalesOrderTest.java`](src/test/java/com/neversoft/sales/SalesOrderTest.java:39) (T-5, T-6, T-7, T-8, T-9, T-10, T-12, T-13, T-14, T-15, T-16, T-17, T-18, T-21, T-25) |
| AC-6 | Met | [`src/test/java/com/neversoft/sales/SalesOrderTest.java`](src/test/java/com/neversoft/sales/SalesOrderTest.java:20) (T-1, compiled cleanly with `javac --release 25 -Xlint:all -Werror`) |
| AC-7 | Met | Git diff and status show only new files added under `src/` and `docs/bob/4` (T-2) |

## Tests: planned vs actual
| Test | Layer | Planned | Status | File |
|---|---|---|---|---|
| T-1 | smoke | yes | Created | [`src/test/java/com/neversoft/sales/SalesOrderTest.java`](src/test/java/com/neversoft/sales/SalesOrderTest.java:20) |
| T-2 | smoke | yes | Created | [`docs/bob/4/tests.md`](docs/bob/4/tests.md:14) |
| T-3 | bdd | yes | Created | [`src/test/java/com/neversoft/sales/SalesOrderTest.java`](src/test/java/com/neversoft/sales/SalesOrderTest.java:37) |
| T-4 | bdd | yes | Created | [`src/test/java/com/neversoft/sales/SalesOrderTest.java`](src/test/java/com/neversoft/sales/SalesOrderTest.java:38) |
| T-5 | bdd | yes | Created | [`src/test/java/com/neversoft/sales/SalesOrderTest.java`](src/test/java/com/neversoft/sales/SalesOrderTest.java:39) |
| T-6 | component | yes | Created | [`src/test/java/com/neversoft/sales/SalesOrderTest.java`](src/test/java/com/neversoft/sales/SalesOrderTest.java:40) |
| T-7 | component | yes | Created | [`src/test/java/com/neversoft/sales/SalesOrderTest.java`](src/test/java/com/neversoft/sales/SalesOrderTest.java:41) |
| T-8 | unit | yes | Created | [`src/test/java/com/neversoft/sales/SalesOrderTest.java`](src/test/java/com/neversoft/sales/SalesOrderTest.java:42) |
| T-9 | unit | yes | Created | [`src/test/java/com/neversoft/sales/SalesOrderTest.java`](src/test/java/com/neversoft/sales/SalesOrderTest.java:43) |
| T-10 | unit | yes | Created | [`src/test/java/com/neversoft/sales/SalesOrderTest.java`](src/test/java/com/neversoft/sales/SalesOrderTest.java:44) |
| T-11 | unit | yes | Created | [`src/test/java/com/neversoft/sales/SalesOrderTest.java`](src/test/java/com/neversoft/sales/SalesOrderTest.java:45) |
| T-12 | unit | yes | Created | [`src/test/java/com/neversoft/sales/SalesOrderTest.java`](src/test/java/com/neversoft/sales/SalesOrderTest.java:46) |
| T-13 | unit | yes | Created | [`src/test/java/com/neversoft/sales/SalesOrderTest.java`](src/test/java/com/neversoft/sales/SalesOrderTest.java:47) |
| T-14 | unit | yes | Created | [`src/test/java/com/neversoft/sales/SalesOrderTest.java`](src/test/java/com/neversoft/sales/SalesOrderTest.java:48) |
| T-15 | unit | yes | Created | [`src/test/java/com/neversoft/sales/SalesOrderTest.java`](src/test/java/com/neversoft/sales/SalesOrderTest.java:49) |
| T-16 | unit | yes | Created | [`src/test/java/com/neversoft/sales/SalesOrderTest.java`](src/test/java/com/neversoft/sales/SalesOrderTest.java:50) |
| T-17 | unit | yes | Created | [`src/test/java/com/neversoft/sales/SalesOrderTest.java`](src/test/java/com/neversoft/sales/SalesOrderTest.java:51) |
| T-18 | unit | yes | Created | [`src/test/java/com/neversoft/sales/SalesOrderTest.java`](src/test/java/com/neversoft/sales/SalesOrderTest.java:52) |
| T-19 | unit | yes | Created | [`src/test/java/com/neversoft/sales/SalesOrderTest.java`](src/test/java/com/neversoft/sales/SalesOrderTest.java:53) |
| T-20 | unit | yes | Created | [`src/test/java/com/neversoft/sales/SalesOrderTest.java`](src/test/java/com/neversoft/sales/SalesOrderTest.java:54) |
| T-21 | unit | yes | Created | [`src/test/java/com/neversoft/sales/SalesOrderTest.java`](src/test/java/com/neversoft/sales/SalesOrderTest.java:55) |
| T-22 | unit | yes | Created | [`src/test/java/com/neversoft/sales/SalesOrderTest.java`](src/test/java/com/neversoft/sales/SalesOrderTest.java:56) |
| T-23 | unit | yes | Created | [`src/test/java/com/neversoft/sales/SalesOrderTest.java`](src/test/java/com/neversoft/sales/SalesOrderTest.java:57) |
| T-24 | unit | yes | Created | [`src/test/java/com/neversoft/sales/SalesOrderTest.java`](src/test/java/com/neversoft/sales/SalesOrderTest.java:58) |
| T-25 | unit | yes | Created | [`src/test/java/com/neversoft/sales/SalesOrderTest.java`](src/test/java/com/neversoft/sales/SalesOrderTest.java:59) |

## Deviations from the plan
- [`SalesOrder`](src/main/java/com/neversoft/sales/SalesOrder.java:31) all-fields constructor copies `lines` directly rather than invoking `setLines(lines)`: The low-level plan specified assigning `lines` via `setLines(lines)`. Under `javac --release 25 -Xlint:all -Werror`, calling an overridable method from the constructor produces a `[this-escape]` compiler warning/error. The constructor directly assigns `this.lines = lines == null ? new ArrayList<>() : new ArrayList<>(lines);`, matching the exact logic and invariants of `setLines`.

## Risks and things reviewers should check
- `BigDecimal.equals` scale sensitivity: [`SalesOrderLine.equals(Object)`](src/main/java/com/neversoft/sales/SalesOrderLine.java:86) uses `Objects.equals` on `unitPrice` and `lineAmount`, making equality sensitive to scale (e.g. `1.0` vs `1.00`).
- Stored `lineAmount`: [`SalesOrderLine`](src/main/java/com/neversoft/sales/SalesOrderLine.java:15) stores `lineAmount` directly rather than calculating it from `quantity` and `unitPrice`.
- Encapsulation of [`SalesOrder.getLines()`](src/main/java/com/neversoft/sales/SalesOrder.java:71): Returns an unmodifiable list view; callers must modify lines via [`addLine(SalesOrderLine)`](src/main/java/com/neversoft/sales/SalesOrder.java:79) and [`removeLine(SalesOrderLine)`](src/main/java/com/neversoft/sales/SalesOrder.java:84).
- Repository cleanliness: Verify no existing files (such as `package.json` or `Vehicle.java`) have been modified.

## Follow-ups
- Wire the test harness into the repository build/test script once coordinated with related issues (e.g., #3).
- Implement automated `lineAmount` calculations and order totals when pricing and business rules are specified.
- Introduce domain enums for order status if required by future workflows.

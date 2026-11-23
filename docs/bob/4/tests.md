# Test plan: #4 sales orders

## Summary
25 tests: 2 smoke, 3 BDD, 2 component, 18 unit. The change is three dependency-free POJOs (`Customer`, `SalesOrderLine`, `SalesOrder`) with no I/O, no endpoints and no build wiring, so almost all behaviour is provable at unit level.

The repo has no test framework. [`VehicleTest.java`](../../../src/test/java/com/neversoft/vehicle/VehicleTest.java) is a plain `javac`/`java` harness with `main`, `test`, `check` and `eq` helpers, and `package.json` is not changed (AC-7). All tests T-3 to T-25 therefore live in one new file, `src/test/java/com/neversoft/sales/SalesOrderTest.java`, in the same harness style. "BDD" tests are Given/When/Then scenarios written as named test methods in that file, because no Cucumber or feature-file tooling exists and adding it would violate AC-6 and AC-7. The smoke tests are shell commands (the commands in the test's Javadoc and `git`).

## Smoke
### T-1: Main classes and test compile warning-free with JDK only, and the harness exits 0
- Target: `javac --release 25 -Xlint:all -Werror -d "$OUT"` on `src/main/java/com/neversoft/customer/Customer.java`, `src/main/java/com/neversoft/sales/SalesOrderLine.java`, `src/main/java/com/neversoft/sales/SalesOrder.java` and `src/test/java/com/neversoft/sales/SalesOrderTest.java`, then `java -cp "$OUT" com.neversoft.sales.SalesOrderTest`
- Why this layer: AC-6 is a property of the compiler run itself, with no classpath and `-Werror`. It can't be proved by a test inside the code under compilation. It is also the critical path: if it passes, the feature is alive and every other test in the harness ran.
- Covers: AC-6

### T-2: Only new files are added, no existing file is modified
- Target: `git status --porcelain` and `git diff --name-only <base>...HEAD` on the branch. Expect only added files under `src/main/java/com/neversoft/{sales,customer}`, `src/test/java/com/neversoft/sales` and `docs/bob/4`. `Vehicle.java`, `VehicleTest.java` and `package.json` must not appear as modified.
- Why this layer: AC-7 is about repository state, not runtime behaviour. Only a VCS check can prove it.
- Covers: AC-7

## BDD
### T-3: Associate a customer and add lines to an order
```gherkin
Given a Customer "Acme Ltd"
  And two SalesOrderLines with item codes "A-1" and "B-2"
  And a new SalesOrder with an id, an order date and status "NEW"
When the customer is set on the order
  And both lines are added with addLine in order
Then getCustomer() returns that customer
  And getLines() contains exactly the two lines in insertion order
  And getId(), getOrderDate() and getStatus() return the values supplied
```
- Target: `src/test/java/com/neversoft/sales/SalesOrderTest.java`
- Why this layer: the main user story from the issue (an order with child lines related to a customer). It spans the three classes as a caller would use them.
- Covers: AC-1, AC-4

### T-4: Remove a line from an order
```gherkin
Given a SalesOrder holding two lines
When removeLine is called with one of those lines
Then it returns true
  And the order holds exactly one line, the other one
When removeLine is called with a line that is not in the order
Then it returns false
  And the order still holds one line
```
- Target: `src/test/java/com/neversoft/sales/SalesOrderTest.java`
- Why this layer: AC-4 says "manage" the collection. Remove is the caller-visible half of that scenario and complements T-3.
- Covers: AC-4

### T-5: Build all three classes with their all-fields constructors
```gherkin
Given distinct values for every field of Customer, SalesOrderLine and SalesOrder
When each object is created with its all-fields constructor
Then every getter on all three classes returns the value that was passed in
  And the SalesOrder holds the supplied customer and lines
```
- Target: `src/test/java/com/neversoft/sales/SalesOrderTest.java`
- Why this layer: a caller-facing scenario that proves the three field sets named in AC-1, AC-2 and AC-3 (id, date, status, customer, lines; id, code, description, quantity, unit price, line amount; id, name, email, phone) and the parameterised constructors end to end.
- Covers: AC-1, AC-2, AC-3, AC-5

## Component
### T-6: Equal object graphs are equal; one change anywhere breaks equality
- Target: `src/test/java/com/neversoft/sales/SalesOrderTest.java`, using `SalesOrder` with a `Customer` and two `SalesOrderLine`s.
- Behaviour: two identically built graphs are `equals` and have equal `hashCode`. Changing one field in the customer, in one line, in the line order or in the line count makes them unequal.
- Why this layer: `SalesOrder.equals` and `hashCode` delegate to `Customer` and `SalesOrderLine`. That delegation is the boundary between the classes and can't be seen from a single class's unit test.
- Covers: AC-4, AC-5

### T-7: toString and hashCode on a full graph terminate and include nested data
- Target: `src/test/java/com/neversoft/sales/SalesOrderTest.java`
- Behaviour: for a populated order, `toString()` returns normally (no `StackOverflowError`) and contains the customer name and each line's item code. `hashCode()` also returns normally.
- Why this layer: the risk is recursion across the parent and child classes, which only shows when the full graph is exercised. The unit tests in T-9 and T-18 guard the structure and each class on its own.
- Covers: risk: Circular reference between `SalesOrder` and `SalesOrderLine` in `toString`/`hashCode`/`equals`, AC-5

## Unit
### T-8: Customer structure
- Target: `src/test/java/com/neversoft/sales/SalesOrderTest.java` (reflection on `com.neversoft.customer.Customer`)
- Behaviour: the class is public, extends `Object` and implements no interfaces. It has exactly 4 declared fields (`long id`, `String name`, `String email`, `String phone`), all private and non-static. It has a public no-arg constructor and a public `(long, String, String, String)` constructor. A public getter and setter exists per field.
- Why this layer: pure structural facts about one class. This is the same technique as `VehicleTest` T-7 and T-8.
- Covers: AC-3, AC-5

### T-9: SalesOrderLine structure, with no back-reference to SalesOrder
- Target: `src/test/java/com/neversoft/sales/SalesOrderTest.java` (reflection on `com.neversoft.sales.SalesOrderLine`)
- Behaviour: the class is public. It has exactly 6 private non-static fields (`long id`, `String itemCode`, `String description`, `int quantity`, `BigDecimal unitPrice`, `BigDecimal lineAmount`). It has public no-arg and 6-arg constructors and a getter and setter per field. No field has type `SalesOrder`.
- Why this layer: structural facts about one class. The "no `SalesOrder` field" assertion is a cheap, deterministic guard on the recursion risk.
- Covers: AC-2, AC-5, risk: Circular reference between `SalesOrder` and `SalesOrderLine` in `toString`/`hashCode`/`equals`

### T-10: SalesOrder structure
- Target: `src/test/java/com/neversoft/sales/SalesOrderTest.java` (reflection on `com.neversoft.sales.SalesOrder`)
- Behaviour: the class is public. It has exactly 5 private non-static fields (`long id`, `LocalDate orderDate`, `String status`, `Customer customer`, `List<SalesOrderLine> lines`). It has public no-arg and 5-arg constructors. It has `getLines`, `setLines`, `addLine`, `removeLine` and `setCustomer`/`getCustomer` with the specified signatures, including `removeLine` returning `boolean`.
- Why this layer: structural facts about one class.
- Covers: AC-1, AC-4, AC-5

### T-11: Classes are in the conventional packages
- Target: `src/test/java/com/neversoft/sales/SalesOrderTest.java`
- Behaviour: `Class.forName` succeeds for `com.neversoft.customer.Customer`, `com.neversoft.sales.SalesOrderLine` and `com.neversoft.sales.SalesOrder`.
- Why this layer: a class-loading check needs no collaborators. It fixes the package paths that future modules would depend on.
- Covers: risk: Package naming conflicts with future modularization, AC-1, AC-2, AC-3

### T-12: No-arg constructor defaults
- Target: `src/test/java/com/neversoft/sales/SalesOrderTest.java`
- Behaviour: for each class, numeric fields are 0 and reference fields are `null`. `SalesOrder.getLines()` is empty and non-null.
- Why this layer: pure constructor logic per class.
- Covers: AC-1, AC-2, AC-3, AC-5

### T-13: Setter and getter round trip per field
- Target: `src/test/java/com/neversoft/sales/SalesOrderTest.java`
- Behaviour: for every field of the three classes, the getter returns what the setter stored. This includes `null` for reference fields (`String`, `BigDecimal`, `LocalDate`, `Customer`). `lineAmount` stores whatever is set and is not derived from quantity × unit price.
- Why this layer: simple accessor logic with no collaborators.
- Covers: AC-1, AC-2, AC-3, AC-5

### T-14: equals contract
- Target: `src/test/java/com/neversoft/sales/SalesOrderTest.java`
- Behaviour: for each class, `equals` is reflexive and symmetric, returns false for `null` and for an object of another type, and returns true for a separately constructed instance with the same field values.
- Why this layer: pure method logic per class.
- Covers: AC-5

### T-15: equals is false when any single field differs
- Target: `src/test/java/com/neversoft/sales/SalesOrderTest.java`
- Behaviour: starting from two equal instances, change exactly one field on one of them. `equals` becomes false. Do this once per field for `Customer` (4), `SalesOrderLine` (6) and `SalesOrder` (5).
- Why this layer: this covers the per-field branches in `equals`. Each branch is only reachable by varying one field at a time.
- Covers: AC-5

### T-16: hashCode is consistent with equals
- Target: `src/test/java/com/neversoft/sales/SalesOrderTest.java`
- Behaviour: equal instances have equal hash codes. `hashCode` is stable across repeated calls. Instances that differ in a field generally hash differently (a sanity check on at least one pair, not a collision guarantee).
- Why this layer: pure method logic per class.
- Covers: AC-5

### T-17: Null-safe equals, hashCode and toString on default instances
- Target: `src/test/java/com/neversoft/sales/SalesOrderTest.java`
- Behaviour: for default (all-null) instances of all three classes, and a `SalesOrder` whose `customer` is null, `equals`, `hashCode` and `toString` don't throw. Two default instances are equal.
- Why this layer: this covers the null branches of `Objects.equals` and `Objects.hash`.
- Covers: AC-5

### T-18: toString contains every field value and the specified shape
- Target: `src/test/java/com/neversoft/sales/SalesOrderTest.java`
- Behaviour: for each class, `toString()` starts with the class's simple name and contains each field's name and value. `SalesOrder.toString()` shows its `customer=` and `lines=` parts, and `SalesOrderLine.toString()` shows no order reference.
- Why this layer: pure string-building logic per class.
- Covers: AC-5, risk: Circular reference between `SalesOrder` and `SalesOrderLine` in `toString`/`hashCode`/`equals`

### T-19: getLines returns an unmodifiable view
- Target: `src/test/java/com/neversoft/sales/SalesOrderTest.java`
- Behaviour: calling `add` and `remove` on the `getLines()` result throws `UnsupportedOperationException`, and the order's lines are unchanged. After a later `addLine`, the previously returned view reflects the new line.
- Why this layer: this is encapsulation logic inside `SalesOrder`. The caller can only manage children through `addLine` and `removeLine`.
- Covers: AC-4

### T-20: addLine rejects null
- Target: `src/test/java/com/neversoft/sales/SalesOrderTest.java`
- Behaviour: `addLine(null)` throws `NullPointerException` and the lines list is unchanged.
- Why this layer: a single guard branch in `SalesOrder`.
- Covers: AC-4

### T-21: setLines and the all-fields constructor take a defensive copy
- Target: `src/test/java/com/neversoft/sales/SalesOrderTest.java`
- Behaviour: after passing a mutable list to `setLines` or to the 5-arg constructor, adding to or clearing the caller's list doesn't change the order's lines. `setLines` replaces the previous contents instead of appending.
- Why this layer: aliasing logic inside `SalesOrder`.
- Covers: AC-4, AC-5

### T-22: Lines are never null
- Target: `src/test/java/com/neversoft/sales/SalesOrderTest.java`
- Behaviour: `new SalesOrder().getLines()` is empty and non-null. `setLines(null)` and the all-fields constructor with `null` lines give an empty, non-null list. `addLine` works straight after construction.
- Why this layer: this covers the null branch in `setLines` and the field initialiser.
- Covers: AC-4

### T-23: setCustomer replaces and clears the association
- Target: `src/test/java/com/neversoft/sales/SalesOrderTest.java`
- Behaviour: `setCustomer(c1)` then `setCustomer(c2)` leaves `getCustomer()` as `c2`. `setCustomer(null)` clears it. Changing a `Customer` field after association is visible through `getCustomer()`, because the customer is held by reference.
- Why this layer: the plan's customer association method (AC-4) is a single setter on `SalesOrder`.
- Covers: AC-4

### T-24: removeLine semantics
- Target: `src/test/java/com/neversoft/sales/SalesOrderTest.java`
- Behaviour: `removeLine` matches by `equals`, so a separately built equal line is removed. If two equal lines were added, only the first is removed. It returns true on removal, and false for an absent line, for `null`, and on an empty order. Remaining lines keep their relative order.
- Why this layer: this covers branches of `List.remove` as used by `SalesOrder`. The caller-level view is in T-4.
- Covers: AC-4

### T-25: BigDecimal scale sensitivity is the documented behaviour
- Target: `src/test/java/com/neversoft/sales/SalesOrderTest.java`
- Behaviour: two `SalesOrderLine`s whose `unitPrice` is `new BigDecimal("1.0")` in one and `new BigDecimal("1.00")` in the other are not `equals`. Lines with the same value and scale are equal and have equal hash codes.
- Why this layer: this pins the design decision in the low-level plan so a later change to `compareTo` semantics is deliberate. It needs no collaborators.
- Covers: AC-2, AC-5

## Coverage
| Criterion / risk | Smoke | BDD | Component | Unit |
|---|---|---|---|---|
| AC-1 | | T-3, T-5 | | T-10, T-11, T-12, T-13 |
| AC-2 | | T-5 | | T-9, T-11, T-12, T-13, T-25 |
| AC-3 | | T-5 | | T-8, T-11, T-12, T-13 |
| AC-4 | | T-3, T-4 | T-6 | T-10, T-19, T-20, T-21, T-22, T-23, T-24 |
| AC-5 | | T-5 | T-6, T-7 | T-8, T-9, T-10, T-12, T-13, T-14, T-15, T-16, T-17, T-18, T-21, T-25 |
| AC-6 | T-1 | | | |
| AC-7 | T-2 | | | |
| Risk: Circular reference in `toString`/`hashCode`/`equals` | | | T-7 | T-9, T-18 |
| Risk: Package naming conflicts with future modularization | | | | T-11 |
| Risk: Domain field requirements evolve | | | | |

## Gaps
- Risk "Domain field requirements evolve as business logic is added": not tested. This is a future-change risk, mitigated by design (simple POJOs). The structural tests T-8, T-9 and T-10 assert exact field counts and will fail on purpose when fields change, which forces a conscious update.
- Wiring into `npm test` / CI is not tested. The low-level plan keeps `package.json` unchanged (AC-7), so the harness is run only through the Javadoc commands (T-1).
- Thread-safety, serialization and persistence are not tested. They are out of scope for the plain POJOs in this issue.
- The semantics of `status` values (a free `String`, no enum) and of `lineAmount` (stored, not computed) are only pinned by T-13. No business rules exist to test.

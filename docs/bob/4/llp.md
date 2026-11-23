# Low-level plan: #4 sales orders

## Overview
The approved high-level plan adds three dependency-free POJOs that mirror the style of the existing [`Vehicle.java`](../../../src/main/java/com/neversoft/vehicle/Vehicle.java): public class, private fields, public no-arg constructor, all-fields constructor, getter/setter per field, and `equals`/`hashCode`/`toString` built on `java.util.Objects` and string concatenation.

- `com.neversoft.customer.Customer` is a standalone entity (no reference to orders).
- `com.neversoft.sales.SalesOrderLine` is the child entity. It holds **no back-reference** to `SalesOrder`, so `equals`/`hashCode`/`toString` cannot recurse (HLP risk 2).
- `com.neversoft.sales.SalesOrder` is the parent. It references one `Customer` and owns a `List<SalesOrderLine>`.

Design decisions made here so the implementation stage does not need to re-decide them:
- Monetary values use `java.math.BigDecimal`. Dates use `java.time.LocalDate`. Both are JDK types, so there are no external dependencies. `BigDecimal.equals` is scale-sensitive; this is accepted and documented in the class Javadoc rather than worked around.
- `lineAmount` is a plain stored field with a plain setter (AC-2). It is **not** auto-computed from quantity × unit price, and `SalesOrder` has no total. This keeps the change minimal; computation can be added in a later issue.
- `SalesOrder.lines` is never `null`. The no-arg constructor initialises an empty `ArrayList`. `setLines` and the all-fields constructor copy the supplied list into a new `ArrayList` (a `null` argument yields an empty list). `getLines()` returns `Collections.unmodifiableList(lines)`, so callers mutate children only through `addLine`/`removeLine`.
- `status` is a `String`, matching `Vehicle`'s use of plain strings. No enum is introduced.
- No existing file is modified (AC-7). In particular [`package.json`](../../../package.json) is left alone, so `npm test` does not compile or run the new classes. The new test is run with the `javac`/`java` commands in its Javadoc, the same pattern as `VehicleTest`. Wiring it into `npm test` is out of scope and would conflict with issue #3's edit to that script (see `deps.md`).

## Changes by file
### src/main/java/com/neversoft/customer/Customer.java (create)
- `package com.neversoft.customer;` public class with provisional-field Javadoc, same as `Vehicle`.
- Private fields: `long id`, `String name`, `String email`, `String phone`.
- Constructors: `Customer()` and `Customer(long id, String name, String email, String phone)`.
- Getter and setter for each field.
- `equals` (same `this == o` / `getClass()` pattern as `Vehicle`; `Objects.equals` for strings), `hashCode` (`Objects.hash(id, name, email, phone)`), and `toString` in the form `Customer{id=.., name='..', email='..', phone='..'}`.
- Imports: `java.util.Objects` only.
- Symbols: `Customer`, `Customer()`, `Customer(long, String, String, String)`, `getId/setId`, `getName/setName`, `getEmail/setEmail`, `getPhone/setPhone`, `equals`, `hashCode`, `toString`
- Covers: AC-3, AC-5, AC-6

### src/main/java/com/neversoft/sales/SalesOrderLine.java (create)
- `package com.neversoft.sales;` public class. It has no field of type `SalesOrder`.
- Private fields: `long id`, `String itemCode`, `String description`, `int quantity`, `BigDecimal unitPrice`, `BigDecimal lineAmount`.
- Constructors: `SalesOrderLine()` and `SalesOrderLine(long id, String itemCode, String description, int quantity, BigDecimal unitPrice, BigDecimal lineAmount)`.
- Getter and setter for each field.
- `equals`, `hashCode` and `toString` over all six fields (`id` and `quantity` compared with `==`, the rest with `Objects.equals`). `toString` form: `SalesOrderLine{id=.., itemCode='..', description='..', quantity=.., unitPrice=.., lineAmount=..}`.
- Imports: `java.math.BigDecimal`, `java.util.Objects`.
- Symbols: `SalesOrderLine`, `SalesOrderLine()`, `SalesOrderLine(long, String, String, int, BigDecimal, BigDecimal)`, `getId/setId`, `getItemCode/setItemCode`, `getDescription/setDescription`, `getQuantity/setQuantity`, `getUnitPrice/setUnitPrice`, `getLineAmount/setLineAmount`, `equals`, `hashCode`, `toString`
- Covers: AC-2, AC-5, AC-6

### src/main/java/com/neversoft/sales/SalesOrder.java (create)
- `package com.neversoft.sales;` public class.
- Imports: `com.neversoft.customer.Customer`, `java.time.LocalDate`, `java.util.ArrayList`, `java.util.Collections`, `java.util.List`, `java.util.Objects`.
- Private fields: `long id`, `LocalDate orderDate`, `String status`, `Customer customer`, `List<SalesOrderLine> lines` (initialised to `new ArrayList<>()` in the field initialiser, so it is never null).
- Constructors: `SalesOrder()` and `SalesOrder(long id, LocalDate orderDate, String status, Customer customer, List<SalesOrderLine> lines)`. The all-fields constructor assigns `lines` via `setLines(lines)`.
- Getter and setter for `id`, `orderDate`, `status`, `customer`. `setCustomer(Customer)` is the customer association method (accepts `null` to clear it).
- Child management:
  - `getLines()` returns `Collections.unmodifiableList(lines)`.
  - `setLines(List<SalesOrderLine>)` replaces the contents with a copy: `this.lines = lines == null ? new ArrayList<>() : new ArrayList<>(lines)`.
  - `addLine(SalesOrderLine line)` calls `Objects.requireNonNull(line, "line")`, then adds it.
  - `removeLine(SalesOrderLine line)` removes the first equal element and returns the `boolean` result of `List.remove`.
- `equals`, `hashCode` and `toString` over `id`, `orderDate`, `status`, `customer` and `lines`. Neither `Customer` nor `SalesOrderLine` references `SalesOrder`, so there is no recursion. `toString` form: `SalesOrder{id=.., orderDate=.., status='..', customer=.., lines=[..]}`.
- Symbols: `SalesOrder`, `SalesOrder()`, `SalesOrder(long, LocalDate, String, Customer, List)`, `getId/setId`, `getOrderDate/setOrderDate`, `getStatus/setStatus`, `getCustomer/setCustomer`, `getLines`, `setLines`, `addLine`, `removeLine`, `equals`, `hashCode`, `toString`
- Covers: AC-1, AC-4, AC-5, AC-6

### src/test/java/com/neversoft/sales/SalesOrderTest.java (create)
- Dependency-free harness copied in shape from [`VehicleTest.java`](../../../src/test/java/com/neversoft/vehicle/VehicleTest.java): `main`, private `test`, `check`, `eq` helpers, and a `FAILURES` list. It exits 1 on any failure.
- Javadoc gives the run command (`javac --release 25 -Xlint:all -Werror -d "$OUT" <3 main files> <this file>`, then `java -cp "$OUT" com.neversoft.sales.SalesOrderTest`).
- Test cases are listed in Test approach below.
- Symbols: `SalesOrderTest`, `main`, `test`, `check`, `eq`, plus one private static method per test case
- Covers: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6

## Interfaces
New public API (no existing signatures change):

```java
package com.neversoft.customer;
public class Customer {
    public Customer();
    public Customer(long id, String name, String email, String phone);
    public long getId();            public void setId(long id);
    public String getName();        public void setName(String name);
    public String getEmail();       public void setEmail(String email);
    public String getPhone();       public void setPhone(String phone);
    public boolean equals(Object o);
    public int hashCode();
    public String toString();
}

package com.neversoft.sales;
public class SalesOrderLine {
    public SalesOrderLine();
    public SalesOrderLine(long id, String itemCode, String description, int quantity,
                          BigDecimal unitPrice, BigDecimal lineAmount);
    public long getId();                 public void setId(long id);
    public String getItemCode();         public void setItemCode(String itemCode);
    public String getDescription();      public void setDescription(String description);
    public int getQuantity();           public void setQuantity(int quantity);
    public BigDecimal getUnitPrice();    public void setUnitPrice(BigDecimal unitPrice);
    public BigDecimal getLineAmount();   public void setLineAmount(BigDecimal lineAmount);
    public boolean equals(Object o);
    public int hashCode();
    public String toString();
}

package com.neversoft.sales;
public class SalesOrder {
    public SalesOrder();
    public SalesOrder(long id, LocalDate orderDate, String status, Customer customer,
                      List<SalesOrderLine> lines);
    public long getId();                 public void setId(long id);
    public LocalDate getOrderDate();     public void setOrderDate(LocalDate orderDate);
    public String getStatus();           public void setStatus(String status);
    public Customer getCustomer();       public void setCustomer(Customer customer);
    public List<SalesOrderLine> getLines();               // unmodifiable view, never null
    public void setLines(List<SalesOrderLine> lines);     // copies; null -> empty
    public void addLine(SalesOrderLine line);             // NPE on null
    public boolean removeLine(SalesOrderLine line);
    public boolean equals(Object o);
    public int hashCode();
    public String toString();
}
```

## Data and configuration changes
None. There is no schema, migration, flag or env var. `package.json` and the build are deliberately unchanged (AC-7).

## Test approach
Tests live in one new file, `src/test/java/com/neversoft/sales/SalesOrderTest.java`, using the repo's existing plain-`javac` harness style. They are compiled with `--release 25 -Xlint:all -Werror`, so a clean compile also verifies AC-6.

| Layer | What | Covers |
|---|---|---|
| smoke | Compile all three main classes and the test with `javac --release 25 -Xlint:all -Werror` (no classpath, JDK only). It must produce no warnings and no errors. Then run `SalesOrderTest` and expect exit 0. | AC-6 |
| smoke | `git status` / `git diff --name-only` shows only new files under `src/main/java/com/neversoft/{sales,customer}`, `src/test/java/com/neversoft/sales` and `docs/bob/4`. No existing file is modified. | AC-7 |
| bdd | Given a `Customer`, two `SalesOrderLine`s and a new `SalesOrder`, when the customer is set and both lines are added, then `getCustomer()` returns that customer and `getLines()` has both lines in insertion order. | AC-1, AC-4 |
| bdd | Given an order with two lines, when one line is removed, then `removeLine` returns true and one line remains. Removing an absent line returns false. | AC-4 |
| bdd | Given an order built with the all-fields constructors, then every getter on all three classes returns the value passed in. | AC-1, AC-2, AC-3, AC-5 |
| component | Object graph: `SalesOrder` → `Customer` + `SalesOrderLine`s. Two identically built graphs are `equals` with equal `hashCode`. Changing one field in the customer or in a line makes them unequal. `toString` terminates and contains the customer name and each line's item code. | AC-4, AC-5 |
| component | `getLines()` result throws `UnsupportedOperationException` on `add`. `addLine(null)` throws `NullPointerException`. Mutating the list passed to `setLines`/the constructor afterwards does not change the order. `setLines(null)` and the no-arg constructor give an empty, non-null list. | AC-4 |
| unit | Reflection per class: public class, superclass `Object`, no interfaces, declared field names and types as specified, all fields private and non-static, public no-arg constructor present. `SalesOrder` has exactly 5 fields, `SalesOrderLine` 6, `Customer` 4. `SalesOrderLine` has no field of type `SalesOrder` (guards the recursion risk). | AC-1, AC-2, AC-3, AC-5 |
| unit | No-arg defaults: numeric fields 0, reference fields null, `SalesOrder.getLines()` empty. Setter/getter round trip per field, including `null` for reference fields. | AC-1, AC-2, AC-3, AC-5 |
| unit | `equals` contract (reflexive, symmetric, false for null / other type), `equals` false when any single field differs (one mutation per field, per class), `hashCode` consistent with `equals`, and null-safe `equals`/`hashCode`/`toString` on default instances. | AC-5 |
| unit | `toString` of each class contains every field value. | AC-5 |

## Rollout
1. Create `Customer.java`. It has no dependencies.
2. Create `SalesOrderLine.java`. It has no dependencies.
3. Create `SalesOrder.java`. It depends on `Customer` and `SalesOrderLine`.
4. Create `SalesOrderTest.java` and run the compile and run commands from its Javadoc.
5. Confirm `git status` shows only new files.

There are no feature flags and no backwards-compatibility concerns, because the change is purely additive. Per `deps.md`, the recommended merge order is #3 → #4 → #5, but this plan does not touch `package.json`, so the order does not matter in practice.

## Open questions
None

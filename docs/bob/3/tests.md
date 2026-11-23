# Test plan: #3 warehouse classes

## Summary
25 tests: 3 smoke, 6 BDD, 2 component, 14 unit. The repo has one test mechanism: a dependency-free Java harness (`main` method with `test`/`check`/`eq` helpers) run by `npm test` through plain `javac --release 25 -Xlint:all -Werror` and `java -cp`. The existing example is [`VehicleTest`](../../../src/test/java/com/neversoft/vehicle/VehicleTest.java). All Java tests therefore go into one new file, `src/test/java/com/neversoft/warehouse/WarehouseTest.java`, grouped under BDD, component and unit section comments as `VehicleTest` does. The smoke tests are shell and git checks, because they prove repo-level properties (compiles clean, files in the right place, only `package.json` modified) that Java code cannot see.

Most behaviour is pure object logic (constructors, accessors, `equals`/`hashCode`/`toString`, quantity rules), so it sits at the unit layer. BDD scenarios give one readable Given/When/Then per behavioural criterion (AC-1 to AC-6). AC-7, AC-8 and AC-9 are properties of the build and the change set, not of runtime behaviour. They are proven at smoke only, because no lower layer can see them and a BDD wrapper would duplicate the smoke check.

## Smoke
### T-1: `npm test` compiles everything warning-free and runs both test classes
- Target: `npm test` at repo root (the `scripts.test` entry in [`package.json`](../../../package.json))
- Why this layer: this is the single end-to-end command the repo uses. It proves in one run that all five sources and both test classes compile under `-Xlint:all -Werror`, that `VehicleTest` still runs after the script was extended, and that `WarehouseTest` passes. No lower layer can see the combined script. Expect exit code 0 and `0 failed` printed by both `VehicleTest` and `WarehouseTest`.
- Covers: AC-7, AC-8, risk: Extending the hardcoded `npm test` script could break the existing Vehicle test, risk: `-Xlint:all -Werror` turns lint warnings into build failures

### T-2: Change set modifies only `package.json` among existing files
- Target: `git diff --name-status <base>..HEAD` at repo root
- Why this layer: AC-9 is a property of the repository change set, not of code behaviour, so only a git check can prove it. Expect `M package.json`, `A` entries for the five `src/main/java/com/neversoft/warehouse/*.java` files and for `src/test/java/com/neversoft/warehouse/WarehouseTest.java` (plus `docs/bob/3/`), and no other `M` or `D`. `Vehicle.java` and `VehicleTest.java` must not appear. A second check parses `package.json` (`node -e "JSON.parse(require('fs').readFileSync('package.json'))"`) and confirms only the `scripts.test` value differs from the base.
- Covers: AC-9, AC-1

### T-3: Class files land in the declared package path
- Target: `OUT=$(mktemp -d); javac --release 25 -Xlint:all -Werror -d "$OUT" src/main/java/com/neversoft/warehouse/*.java; test -f "$OUT/com/neversoft/warehouse/{Warehouse,Store,Location,Product,StockItem}.class"`
- Why this layer: `javac` does not fail when a package declaration disagrees with the directory of an explicitly listed file. It just writes the class to a different output path. Only checking the compiled output proves the package matches the directory. This is a build-output property that no Java test can observe. It is the same kind of check as T-1 in the issue #1 plan.
- Covers: AC-1, AC-8

## BDD
All BDD scenarios are methods in `WarehouseTest`, each with its Given/When/Then as a leading comment, as in `VehicleTest.t3` to `t6`.

### T-4: Developer can load each warehouse class by its fully qualified name
```gherkin
Given the warehouse sources have been compiled
When each of Warehouse, Store, Location, Product and StockItem is loaded by its fully qualified name in com.neversoft.warehouse
Then every class is found, is public, and reports package com.neversoft.warehouse
```
- Target: `src/test/java/com/neversoft/warehouse/WarehouseTest.java` (W-1)
- Why this layer: a developer's first use of the model is to find the classes. Reflection loading is the plain-Java equivalent of that. The directory check itself is T-3.
- Covers: AC-1

### T-5: Developer builds each class with the no-arg constructor and with the all-args constructor
```gherkin
Given a new Warehouse, Store, Location, Product and StockItem built with no arguments
When values are set through their setters
Then each getter returns the value that was set

Given values for every field of a class
When the all-args constructor is called
Then every getter returns the value passed in, including a null capacity on Location
```
- Target: `src/test/java/com/neversoft/warehouse/WarehouseTest.java` (W-3)
- Why this layer: this is the caller-facing story for AC-2. The detailed shape checks (private fields, no annotations, per-field independence) are unit tests T-12 to T-14.
- Covers: AC-2

### T-6: Equal objects are equal, print every field, and differ when a field differs
```gherkin
Given two Warehouse trees built from the same values
When they are compared and printed
Then they are equal, have the same hashCode, and toString contains every field value

Given one of them has a different nested Location code
When they are compared again
Then they are not equal
```
- Target: `src/test/java/com/neversoft/warehouse/WarehouseTest.java` (W-6, W-9)
- Why this layer: this shows the `equals`/`hashCode`/`toString` behaviour a caller sees on the root object. The per-class contract and per-field mutation detail is covered by unit tests T-17 to T-21.
- Covers: AC-3

### T-7: A new Warehouse or Store never has null child lists
```gherkin
Given a default-constructed Warehouse and a default-constructed Store
When getStores() and getLocations() are called
Then both return an empty, non-null list

Given a Store is added to the Warehouse and a Location is added to the Store
When the lists are read back
Then the Warehouse holds that Store and the Store holds that Location
```
- Target: `src/test/java/com/neversoft/warehouse/WarehouseTest.java` (W-4, W-5)
- Why this layer: this is the caller's view of AC-4. The null-argument and ordering branches are covered at unit level by T-15 and T-16.
- Covers: AC-4

### T-8: One location holds several products and one product sits in several locations
```gherkin
Given products P1 and P2, and locations with ids 10 and 20
When stock items are created for (10, P1, 5), (10, P2, 3) and (20, P1, 7)
Then location 10 has two stock items with different products
And product P1 appears in stock items for locations 10 and 20
And each stock item reports its own locationId, product and quantity
```
- Target: `src/test/java/com/neversoft/warehouse/WarehouseTest.java` (W-10)
- Why this layer: it proves the many-to-many relationship as the author would describe it. This is a statement about the model design, so it is written at scenario level.
- Covers: AC-5

### T-9: Adding and removing stock, and rejected quantity changes
```gherkin
Given a StockItem holding quantity 5
When 3 is added
Then the quantity is 8
When 8 is removed
Then the quantity is 0

Given a StockItem holding quantity 5
When removing 6, adding 0, or removing -1 is attempted
Then an IllegalArgumentException is thrown each time
And the quantity is still 5
```
- Target: `src/test/java/com/neversoft/warehouse/WarehouseTest.java` (W-11, W-12)
- Why this layer: AC-6 is a user-visible rule (stock cannot go negative). A scenario shows it. The full boundary list is T-23 and T-24.
- Covers: AC-6

## Component
### T-10: A full Warehouse tree builds, compares and prints without recursion
- Target: `src/test/java/com/neversoft/warehouse/WarehouseTest.java` (W-9; section "component")
- Why this layer: this is the boundary between `Warehouse`, `Store`, `Location` and `StockItem`/`Product`, where `equals`, `hashCode` and `toString` call into children. Cycles would only show when the classes are composed. Build a `Warehouse` with two `Store`s, each with `Location`s, and a `StockItem` for a location id. Call `toString`, `hashCode` and `equals` on the root. Assert that each returns (no `StackOverflowError`), that `toString` contains the nested store name and location code, and that `equals` between two independently built identical trees is true.
- Covers: AC-3, AC-4

### T-11: Stock can be resolved through the tree by location id and adjusted
- Target: `src/test/java/com/neversoft/warehouse/WarehouseTest.java` (section "component")
- Why this layer: the `Location` to `StockItem` link is by id, not by object reference. The one place that can go wrong is composing the two: ids in `Location` must line up with `StockItem.locationId`. Build a tree with locations 10 and 20 and a list of `StockItem`s. Filter the list by `Location.getId()` from the tree. Assert that location 10 resolves to two items and location 20 to one, then call `removeQuantity` on one found item. Assert that only that item changed and that an over-removal throws and leaves the quantity as it was.
- Covers: AC-5, AC-6

## Unit
### T-12: Class shape: public no-arg constructor, private instance fields, no annotations, no interfaces
- Target: `src/test/java/com/neversoft/warehouse/WarehouseTest.java` (W-2)
- Why this layer: pure reflection on one class at a time, like `VehicleTest.t7`/`t8`/`t9`. For each of the five classes assert a public no-arg constructor, a declared field count and type list (`Warehouse` 4, `Store` 4, `Location` 4, `Product` 5, `StockItem` 3), every field private and non-static, superclass `Object`, zero interfaces, and no annotations on the class, fields or constructors. A public getter and setter must exist for every field.
- Covers: AC-2

### T-13: All-args constructor assigns every field with distinct values
- Target: `src/test/java/com/neversoft/warehouse/WarehouseTest.java` (W-3)
- Why this layer: a constructor that swaps two same-typed fields (for example `name` and `address`, or `sku` and `name`) is a logic bug. Use a distinct value per field to catch it. Include `Location` with `capacity` `null` and `0`, and unusual values (negative ids, empty strings) that must be stored as given, because constructors do not validate.
- Covers: AC-2

### T-14: Getters return what setters stored, and each setter touches only its own field
- Target: `src/test/java/com/neversoft/warehouse/WarehouseTest.java` (W-3)
- Why this layer: a per-method property of each class, like `VehicleTest.t11`. Cover boundary values (`Long.MAX_VALUE` ids, `Integer.MAX_VALUE` quantity, null strings, null capacity, null product) and, after one setter call, check that every other getter is unchanged.
- Covers: AC-2

### T-15: Null lists become empty lists in the constructor and the list setters
- Target: `src/test/java/com/neversoft/warehouse/WarehouseTest.java` (W-4)
- Why this layer: this is a branch in four places: the `Warehouse` and `Store` all-args constructors and `setStores`/`setLocations`. Each is a separate code path. Assert that `new Warehouse(1, "n", "a", null).getStores()` and `new Store(1, "n", 2, null).getLocations()` are empty and non-null, and that the same holds after `setStores(null)` and `setLocations(null)` on a populated object. Also assert that a non-null list passed in is accepted.
- Covers: AC-4

### T-16: `addStore` and `addLocation` append in order and reject null
- Target: `src/test/java/com/neversoft/warehouse/WarehouseTest.java` (W-5)
- Why this layer: simple branch logic. Add three children and check the order and size. Assert that `addStore(null)` and `addLocation(null)` throw `NullPointerException` and leave the list size unchanged. Assert that adding a child does not change its parent id (`Store.warehouseId`, `Location.storeId`), as the low-level plan specifies.
- Covers: AC-4

### T-17: `equals` contract holds for all five classes
- Target: `src/test/java/com/neversoft/warehouse/WarehouseTest.java` (W-6)
- Why this layer: contract checks per class, like `VehicleTest.t12`. For each class assert: reflexive, symmetric, an equal copy is equal, not equal to `null`, to a `String`, to a plain `Object`, or to an object of another warehouse class built from similar values (this checks the `getClass()` use).
- Covers: AC-3

### T-18: `equals` is false when any single field differs, in both directions
- Target: `src/test/java/com/neversoft/warehouse/WarehouseTest.java` (W-7)
- Why this layer: one defect per field, each detected separately, as `VehicleTest.t13` does. Use a `List<Consumer<T>>` of mutations per class: `Warehouse` (id, name, address, a changed store in the list, an extra store), `Store` (id, name, warehouseId, locations), `Location` (id, code, storeId, capacity), `Product` (five fields) and `StockItem` (locationId, product, a changed product field, quantity). Assert the mutation count equals the field count so a new field cannot be added without a test.
- Covers: AC-3

### T-19: `hashCode` is consistent with `equals` and stable
- Target: `src/test/java/com/neversoft/warehouse/WarehouseTest.java` (W-6)
- Why this layer: equal objects must share a hash, which is a per-class property like `VehicleTest.t15`. Assert equal hash for equal copies of all five classes, stable across repeated calls, restored after a mutate-and-revert, and equal for equal child lists built separately.
- Covers: AC-3

### T-20: Null-safe `equals`, `hashCode` and `toString`
- Target: `src/test/java/com/neversoft/warehouse/WarehouseTest.java` (W-8)
- Why this layer: each of the null cases below takes its own branch inside `Objects.equals`/`Objects.hash` and `toString`, as `VehicleTest.t14` covers for `Vehicle`. Check default-constructed instances of all five classes: two are equal, with equal hashes, and none of the three methods throws. Also check a populated object against one with null strings, and `StockItem` with a null `Product`, `Location` with a null `capacity` and null `code`, and empty lists. A null-field object must not equal a populated one in either direction.
- Covers: AC-3

### T-21: `toString` of each class contains every field value
- Target: `src/test/java/com/neversoft/warehouse/WarehouseTest.java` (W-9)
- Why this layer: a missing field in a `toString` is a per-class string-building bug, as in `VehicleTest.t16`. Use distinctive values per field (for example id `123456`, name `NameVal`) and assert `toString` contains each. For `Warehouse` and `Store`, assert that a child's identifying value is included. For `StockItem`, assert that the product's name appears.
- Covers: AC-3

### T-22: `StockItem` defaults, and `setQuantity` does not validate
- Target: `src/test/java/com/neversoft/warehouse/WarehouseTest.java` (W-2, W-3)
- Why this layer: the low-level plan fixes a design decision: only `addQuantity` and `removeQuantity` validate, while the no-arg constructor leaves `product` null and `quantity` 0 and `setQuantity` is plain. A test pins this down so nobody adds validation to one path without the other. Assert the defaults, that `setQuantity(-3)` stores -3, and that the all-args constructor with a negative quantity stores it as given.
- Covers: AC-6, AC-2

### T-23: `addQuantity` and `removeQuantity` happy paths and exact boundaries
- Target: `src/test/java/com/neversoft/warehouse/WarehouseTest.java` (W-11)
- Why this layer: arithmetic branches in one method. Assert 5 + 3 = 8, 8 - 8 = 0 (removal to exactly zero is allowed), 0 + 1 = 1, and `Integer.MAX_VALUE - 1` + 1 = `Integer.MAX_VALUE` (the largest allowed add). Also assert that a successful call changes only `quantity`, not `locationId` or `product`.
- Covers: AC-6

### T-24: Invalid quantity arguments throw `IllegalArgumentException` and leave state unchanged
- Target: `src/test/java/com/neversoft/warehouse/WarehouseTest.java` (W-12)
- Why this layer: each rejection is its own `if` branch: `amount <= 0` (add and remove), overflow on add, and `amount > quantity` on remove. Test each separately: `addQuantity(0)`, `addQuantity(-1)`, `addQuantity(Integer.MIN_VALUE)`, `removeQuantity(0)`, `removeQuantity(-1)`, `removeQuantity(quantity + 1)`, and an add of 1 to `Integer.MAX_VALUE` and of `Integer.MAX_VALUE` to 1. Assert the exception type is exactly `IllegalArgumentException` (not `ArithmeticException`) and that `quantity`, `locationId` and `product` are unchanged afterwards.
- Covers: AC-6

### T-25: Child lists are stored by reference (accepted behaviour is pinned)
- Target: `src/test/java/com/neversoft/warehouse/WarehouseTest.java` (section "unit")
- Why this layer: the high-level plan accepts that mutable lists are exposed through getters. A test documents this so a later change to defensive copies is a deliberate decision. Assert that `getStores()` returns the list passed to the constructor and that adding to it directly is visible through `warehouse.getStores()`. Do the same for `Store.getLocations()`.
- Covers: risk: Mutable lists exposed through getters allow external modification

## Coverage
| Criterion / risk | Smoke | BDD | Component | Unit |
|---|---|---|---|---|
| AC-1 | T-2, T-3 | T-4 | | |
| AC-2 | | T-5 | | T-12, T-13, T-14, T-22 |
| AC-3 | | T-6 | T-10 | T-17, T-18, T-19, T-20, T-21 |
| AC-4 | | T-7 | T-10 | T-15, T-16 |
| AC-5 | | T-8 | T-11 | |
| AC-6 | | T-9 | T-11 | T-22, T-23, T-24 |
| AC-7 | T-1 | | | |
| AC-8 | T-1, T-3 | | | |
| AC-9 | T-2 | | | |
| risk: Guessed fields and relationships do not match the author's intent | | | | |
| risk: Id-based upward links may be less convenient than object references | | | | |
| risk: Extending the hardcoded `npm test` script could break the existing Vehicle test | T-1 | | | |
| risk: `-Xlint:all -Werror` turns lint warnings into build failures | T-1 | | | |
| risk: Mutable lists exposed through getters allow external modification | | | | T-25 |

## Gaps
- AC-7, AC-8 and AC-9 have no BDD, component or unit test: they are build and change-set properties and are proven by T-1 to T-3 at smoke only.
- AC-6 requires a "documented exception". Javadoc `@throws` text cannot be checked by a runtime test and `-Xlint:all` does not check it. The exception type and unchanged state are tested (T-9, T-24). The Javadoc itself is left to code review.
- AC-2 "no external dependencies": T-12 checks that there are no annotations and no interfaces, and T-1 compiles the sources with no classpath, so any third-party import would fail to compile. There is no separate import-scanning test.
- Risk "Guessed fields and relationships do not match the author's intent": this is a product-fit risk, not testable by code. The mitigation is the PR description and review.
- Risk "Id-based upward links may be less convenient than object references": this is a design trade-off, not a behaviour. T-11 shows the id link works, and nothing more is tested.
- No test covers `Vehicle` behaviour directly. The unchanged `VehicleTest` run inside T-1 is the regression check.
- No concurrency, serialization or persistence tests, because the POJOs have none (out of scope per the high-level plan).

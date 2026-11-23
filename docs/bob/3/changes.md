# What has changed: #3 warehouse classes

## Summary
Adds a new `com.neversoft.warehouse` package with five plain Java classes: `Warehouse`, `Store`, `Location`, `Product` and `StockItem`. Together they model a warehouse, its stores, the storage locations in them, the products, and the quantity of each product held at each location. A dependency-free test class is added and `npm test` now compiles and runs it alongside the existing Vehicle test. No existing Java code is touched.

## Changes
| Area | Files | What changed | Why |
|---|---|---|---|
| Domain model: hierarchy | [`Warehouse.java`](../../../src/main/java/com/neversoft/warehouse/Warehouse.java), [`Store.java`](../../../src/main/java/com/neversoft/warehouse/Store.java), [`Location.java`](../../../src/main/java/com/neversoft/warehouse/Location.java) | New POJOs. `Warehouse` (`id`, `name`, `address`, `List<Store> stores`), `Store` (`id`, `name`, `warehouseId`, `List<Location> locations`), `Location` (`id`, `code`, `storeId`, nullable `Integer capacity`). Each has no-arg and all-args constructors, a getter and setter per field, and `equals`/`hashCode`/`toString`. Lists default to `new ArrayList<>()`, and a `null` list passed to the all-args constructor or to `setStores`/`setLocations` becomes an empty list. `Warehouse.addStore` and `Store.addLocation` append and throw `NullPointerException` on `null`. They do not set the child's parent id. | Models the warehouse, its stores and its locations. Ownership goes down as lists and the upward link is a plain id, so `equals`/`hashCode`/`toString` cannot recurse. |
| Domain model: products and stock | [`Product.java`](../../../src/main/java/com/neversoft/warehouse/Product.java), [`StockItem.java`](../../../src/main/java/com/neversoft/warehouse/StockItem.java) | New POJOs. `Product` (`id`, `sku`, `name`, `description`, `unitOfMeasure`). `StockItem` (`locationId`, `Product product`, `int quantity`) is the only place quantity lives. `StockItem.addQuantity(int)` throws `IllegalArgumentException` if `amount <= 0` or the sum would exceed `Integer.MAX_VALUE`. `StockItem.removeQuantity(int)` throws `IllegalArgumentException` if `amount <= 0` or `amount > quantity`. The exceptions are documented with `@throws` Javadoc. `setQuantity` and the constructors do not validate. | Expresses the relationship between a location and the stock in it. One location can hold many products, and one product can be stocked at many locations. Stock cannot go negative through the helpers. |
| Tests | [`WarehouseTest.java`](../../../src/test/java/com/neversoft/warehouse/WarehouseTest.java) | New dependency-free harness (`test`, `check`, `eq` and a `throwsExactly` helper; `main` exits 1 on failure). It runs 22 tests, `T-4` to `T-25`: 6 BDD, 2 component and 14 unit. | Covers AC-1 to AC-6. Follows the `VehicleTest` pattern. |
| Build / test script | [`package.json`](../../../package.json) | Only `scripts.test` changes. The `javac` call (still `--release 25 -Xlint:all -Werror`) now also lists the five warehouse sources and `WarehouseTest.java`. The Vehicle compile and run steps are kept, and `&& java -cp "$OUT" com.neversoft.warehouse.WarehouseTest` is appended. | `npm test` previously named only the Vehicle files, so the new tests would not have run. |
| Pipeline documents | `docs/bob/3/` (`deps.*`, `hlp.*`, `llp.*`, `tests.*`, `state.json`) | New planning and metadata files. No code. | Record the approved plans for this issue. |

## Acceptance criteria
The criteria are the AC-1 to AC-9 in [`hlp.md`](hlp.md). The issue text itself has no acceptance criteria. The diff contains no test run output, so "Met" below means the code and tests that satisfy the criterion are in the diff, not that a run was observed. AC-7 and AC-8 depend on a build and are marked "Partly" for that reason.

| Criterion | Status | Evidence (file, test) |
|---|---|---|
| AC-1: Public classes in `com.neversoft.warehouse` under `src/main/java/com/neversoft/warehouse/` | Met | All five files exist at that path with `package com.neversoft.warehouse;` and a `public class`. `WarehouseTest` T-4 loads them by FQN. T-3 (class files land in the package path) is not an automated artifact in the diff (see Tests). |
| AC-2: Plain POJOs: private fields, no-arg and all-args constructors, getter and setter per field, no annotations or dependencies | Met | Five main classes. Imports are limited to `java.util`. `WarehouseTest` T-5, T-12 (reflection on shape, field count, types, annotations, accessors) and T-13, T-14, T-22. |
| AC-3: `equals`/`hashCode`/`toString` consistent, null-safe, non-recursive | Met | `Objects.equals`/`Objects.hash` over all fields, `getClass()` check. `WarehouseTest` T-6, T-10, T-17 to T-21. |
| AC-4: `Warehouse` holds `List<Store>`, `Store` holds `List<Location>`, never null | Met | Field initialisers plus null-to-empty in the constructor and setter. `WarehouseTest` T-7, T-15, T-16. |
| AC-5: `StockItem` links a location and a `Product` with a quantity. Many products per location, many locations per product | Met | [`StockItem.java`](../../../src/main/java/com/neversoft/warehouse/StockItem.java). `WarehouseTest` T-8, T-11. |
| AC-6: Add and remove reject negative results and invalid arguments, with a documented exception | Met | `addQuantity` and `removeQuantity` in `StockItem.java`, with `@throws IllegalArgumentException` Javadoc. `WarehouseTest` T-9, T-23, T-24. |
| AC-7: Tests exist and pass via `npm test`, and `VehicleTest` still passes | Partly | Tests exist and the script is extended with the Vehicle steps kept. No run result is in the diff, so a passing run is not shown. |
| AC-8: Compiles with `javac --release 25 -Xlint:all -Werror` with no warnings | Partly | The script keeps those flags. The new sources use no raw types. No build output is in the diff, so a clean compile is not shown. |
| AC-9: Apart from the `package.json` test script, no existing file is modified | Met | The diff stat shows one modified existing file (`package.json`, one line in `scripts.test`). All other entries are new files. `Vehicle.java` and `VehicleTest.java` do not appear. |

## Tests: planned vs actual
All 25 planned tests are from [`tests.md`](tests.md). Test ids in `WarehouseTest` use the plan ids (`T-4` to `T-25`), not the local `W-n` ids from the low-level plan.

| Test | Layer | Planned | Status | File |
|---|---|---|---|---|
| T-1 `npm test` compiles everything and runs both test classes | smoke | yes | Changed (the `npm test` script now runs both classes; no run output in diff) | `package.json` |
| T-2 Only `package.json` modified among existing files | smoke | yes | Missing as an automated check. The property holds in this diff. | none |
| T-3 Class files land in declared package path | smoke | yes | Missing as an automated check. T-4 checks packages by reflection, not the output path. | none |
| T-4 Load each class by FQN | bdd | yes | Created | `src/test/java/com/neversoft/warehouse/WarehouseTest.java` |
| T-5 No-arg and all-args construction | bdd | yes | Created | `WarehouseTest.java` |
| T-6 Equal objects equal, print every field, differ on a field | bdd | yes | Created | `WarehouseTest.java` |
| T-7 New Warehouse or Store has no null child lists | bdd | yes | Created | `WarehouseTest.java` |
| T-8 Location holds several products, product in several locations | bdd | yes | Created | `WarehouseTest.java` |
| T-9 Adding and removing stock, rejected changes | bdd | yes | Created | `WarehouseTest.java` |
| T-10 Full tree builds, compares, prints without recursion | component | yes | Created | `WarehouseTest.java` |
| T-11 Stock resolved through the tree by location id | component | yes | Created | `WarehouseTest.java` |
| T-12 Class shape | unit | yes | Created | `WarehouseTest.java` |
| T-13 All-args constructor assigns every field | unit | yes | Created | `WarehouseTest.java` |
| T-14 Getters return what setters stored | unit | yes | Created | `WarehouseTest.java` |
| T-15 Null lists become empty lists | unit | yes | Created | `WarehouseTest.java` |
| T-16 `addStore`/`addLocation` append in order, reject null | unit | yes | Created | `WarehouseTest.java` |
| T-17 `equals` contract | unit | yes | Created | `WarehouseTest.java` |
| T-18 `equals` false when any single field differs | unit | yes | Created | `WarehouseTest.java` |
| T-19 `hashCode` consistent with `equals` | unit | yes | Created | `WarehouseTest.java` |
| T-20 Null-safe `equals`/`hashCode`/`toString` | unit | yes | Created | `WarehouseTest.java` |
| T-21 `toString` includes all fields | unit | yes | Created | `WarehouseTest.java` |
| T-22 `StockItem` defaults, `setQuantity` does not validate | unit | yes | Created | `WarehouseTest.java` |
| T-23 `addQuantity`/`removeQuantity` happy paths and boundaries | unit | yes | Created | `WarehouseTest.java` |
| T-24 Invalid quantity arguments throw and leave state unchanged | unit | yes | Created | `WarehouseTest.java` |
| T-25 Child lists stored by reference | unit | yes | Created | `WarehouseTest.java` |
| (unplanned) | unit | no | None. The only additions are the harness helper `throwsExactly` and the shared fixture and helper methods (`prod`, `loc`, `store`, `wh`, `stock`, `buildTree`, `shape`, `contract`, `mutations`, `hashing`, `rejected`), which are not tests. | n/a |

Note: [`tests.md`](tests.md) says the repo's smoke checks are shell and git checks (T-2, T-3). The diff does not add a script or file for them. The `WarehouseTest` class Javadoc says T-1 to T-3 "are not Java tests". Whether they were run by hand is not shown by the diff.

## Deviations from the plan
- **Test ids:** the low-level plan names tests `W-1` to `W-12`. The implementation uses the test-plan ids `T-4` to `T-25`, one method per test (`t4` to `t25`). The coverage is the same as the plan. Behaviour that the low-level plan grouped, such as W-9 (`toString`) and W-10 to W-12, is now split across more test methods.
- **Smoke T-2 and T-3:** planned as shell/git checks. No artifact for them is in the diff (see above).
- **Extra harness helper:** `throwsExactly(...)` is used to assert the exact exception class, as T-24 asks (`IllegalArgumentException`, not a subclass or `ArithmeticException`). It is not named in the low-level plan.
- **IDE-only suppression:** `contract(...)` in `WarehouseTest` carries `@SuppressWarnings({"EqualsWithItself", "ConstantConditions"})`. These are IDE inspection names, not javac lint keys, so they have no effect on `-Xlint:all -Werror`. This is not in the plan.
- Everything else in the main classes and the `package.json` value matches the low-level plan. This includes the full `scripts.test` string, the exception types and the null-to-empty-list rule.

## Risks and things reviewers should check
- **Guessed model:** field names, the "Store is a section of a warehouse" reading, and ids as `long` are assumptions the issue author invited. Reviewers should confirm they fit the intended domain.
- **`npm test` was not run for this document.** The diff has no output. Run it and confirm `0 failed` from both `VehicleTest` and `WarehouseTest`, and that `-Xlint:all -Werror` produces no warnings.
- **Mutable lists are shared by reference.** `getStores()` and `getLocations()` return the live list, and the constructors and setters store the list passed in. T-25 pins this. Because `equals` and `hashCode` include the lists, mutating a child after it is used as a hash key changes its hash.
- **No parent-id consistency.** `addStore` and `addLocation` do not set `warehouseId` or `storeId`. Callers must keep them in step. T-16 asserts this behaviour.
- **Validation is only in `addQuantity` and `removeQuantity`.** `setQuantity` and the constructor accept negative values (T-22 pins this). Code that uses the setter can bypass the rule.
- **`StockItem` is not attached to `Location` or `Warehouse`.** The link is by `locationId` only, and nothing in the model keeps the ids consistent or looks up a location's stock. T-11 does the lookup in the test.
- **`package.json` is one long line.** Check the JSON is still valid and that the Vehicle steps are unchanged.
- **Class Javadoc claim:** each class Javadoc says the field list is provisional, matching `Vehicle`.

## Follow-ups
- Add scripted checks for the smoke tests T-2 (change set) and T-3 (class output path), if the team wants them automated.
- Decide whether to use defensive copies for the child lists, object references instead of ids, or validation in the setters. Each is a deliberate change from the pinned behaviour.
- Adjust fields and add behaviour once the author reviews the guessed model.

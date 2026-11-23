# High-level plan: #3 warehouse classes

## Summary
Add a small set of plain Java POJOs modelling a warehouse, the stores within it, storage locations, products, and the stock held at each location. Field and method sets are a best-guess starting point, as the author requested.

## Approach
Create a new package `com.neversoft.warehouse` under `src/main/java`, following the conventions of the existing [`Vehicle`](../../../src/main/java/com/neversoft/vehicle/Vehicle.java) POJO: a public class, private fields, a no-arg constructor, an all-args constructor, getters/setters, and `equals`/`hashCode`/`toString`. The repo has no build tool, and `package.json` compiles with plain `javac --release 25 -Xlint:all -Werror`, so the classes stay dependency-free.

Five classes cover the request:
- `Warehouse` is the root. It has an id, name, address and a list of `Store`s.
- `Store` is a named area within a warehouse. It has an id, name, the owning warehouse id and a list of `Location`s.
- `Location` is a physical slot (for example aisle, rack, shelf and bin) in a store. It has an id, a code, the owning store id and an optional capacity.
- `Product` is a catalogue item: id, SKU, name, description and unit of measure.
- `StockItem` is the relationship between a location and the stock in it. It links a location id to a `Product` with a quantity, and it is the only place quantity lives. A location can hold several products, and a product can be stocked in many locations.

Parent/child links go downward as lists (`Warehouse` to `Store` to `Location`). Upward links are plain ids (`warehouseId`, `storeId`, `locationId`), the same way `Vehicle` uses a `long id`. This avoids object cycles that would break `equals`, `hashCode` and `toString`. A few small, obviously useful methods are included, such as adding a child to a list and adjusting a stock quantity without going negative. Everything else is left for follow-ups.

Following the repo's existing pattern (a dependency-free test harness run through `npm test`), a matching test class is added. The `package.json` test script currently names the `Vehicle` files explicitly, so it needs extending to compile and run the warehouse sources and tests too.

## Alternatives considered
- Java records — rejected: the author asked for POJOs and the fields will change, so mutable classes matching `Vehicle` are more consistent.
- Bidirectional object references (`Location.getStore()` and so on) — rejected: they create cycles in `equals`, `hashCode` and `toString`, and the author asked for simple POJOs. Ids are enough.
- Store quantity directly on `Location` or `Product` — rejected: a location can hold many products and a product can sit in many locations, so a separate `StockItem` models the relationship properly.
- JPA/Lombok annotations — rejected: they would add dependencies and a build system the repo does not have, and the author asked for plain POJOs.
- Add a Maven/Gradle build — rejected: out of scope.

## Components affected
- Java domain model (new package `com.neversoft.warehouse`) — new `Warehouse`, `Store`, `Location`, `Product` and `StockItem` classes.
- Java tests (new package under `src/test/java`) — new dependency-free test harness covering the classes, in the style of `VehicleTest`.
- Root `package.json` test script — extended so `npm test` compiles and runs the warehouse sources and tests as well as the existing `Vehicle` ones.
- Existing `Vehicle` code — unchanged.

## Acceptance criteria
- AC-1: Public classes `Warehouse`, `Store`, `Location`, `Product` and `StockItem` exist in package `com.neversoft.warehouse` under `src/main/java/com/neversoft/warehouse/`, with the package declaration matching the directory.
- AC-2: Each class is a plain POJO with private fields, a no-arg constructor, an all-args constructor, and a getter and setter for every field. There are no annotations or external dependencies.
- AC-3: Each class overrides `equals`, `hashCode` and `toString` consistently over its fields. These are null-safe and do not recurse infinitely.
- AC-4: A `Warehouse` holds a list of `Store`s and a `Store` holds a list of `Location`s. Child lists are never null on a default-constructed object.
- AC-5: `StockItem` associates a location with a `Product` and a quantity. The model allows one location to hold several products and one product to be stocked in several locations.
- AC-6: Quantity changes on `StockItem` (add and remove) reject negative resulting quantities and invalid arguments, with a documented exception.
- AC-7: Tests for the new classes exist and pass via `npm test`, and the existing `VehicleTest` still passes.
- AC-8: All sources compile with `javac --release 25 -Xlint:all -Werror` with no warnings.
- AC-9: Apart from the `package.json` test script, no existing file is modified.

## Dependencies on other issues
- None known (#1 introduced the `Vehicle` conventions and test script that this plan follows, but it is already merged into this tree).

## Assumptions
- "Stores" means sub-areas or sections within a warehouse, not retail stores.
- "Locations" are physical storage positions, such as aisle/rack/shelf/bin, belonging to a store.
- "Stock" means a quantity of a product at a location.
- Target is Java 25, matching the existing `--release 25` build script.
- Package name `com.neversoft.warehouse`, following `com.neversoft.vehicle`.
- Plain `long` ids and `int` quantities are acceptable, as with `Vehicle`. There is no persistence, so no id generation is needed.
- The author's request for "methods" is met by accessors plus a minimal set of domain helpers. No services, repositories or business logic are required.
- Adding tests and extending the `package.json` test script is in scope, following the issue #1 convention.

## Risks
| Risk | Severity | Mitigation |
|---|---|---|
| Guessed fields and relationships do not match the author's intent | medium | State the assumptions in the PR description. Keep the classes simple and the design provisional, as the author invited. |
| Id-based upward links may be less convenient than object references | low | Easy to change later, and it avoids cycles in `equals`/`hashCode`/`toString`. |
| Extending the hardcoded `npm test` script could break the existing Vehicle test | low | Keep the Vehicle compile and run steps intact. Verify that both the Vehicle and warehouse tests pass. |
| `-Xlint:all -Werror` turns lint warnings into build failures | low | Avoid raw types and unchecked code, and run `npm test` before finishing. |
| Mutable lists exposed through getters allow external modification | low | Accept for a POJO and be consistent with the "plain POJO" request. Document it. |

## Open questions
- None. The guesses are recorded in Assumptions and can be corrected in review.

## Complexity
S — five small, dependency-free data classes plus a test file and a one-line script change, with no existing logic touched.

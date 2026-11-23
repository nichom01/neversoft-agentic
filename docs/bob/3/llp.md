# Low-level plan: #3 warehouse classes

## Overview
The approved high-level plan adds five dependency-free POJOs in a new package `com.neversoft.warehouse`, a single dependency-free test class, and one edit to the `package.json` test script. The classes copy the style of the existing [`Vehicle`](../../../src/main/java/com/neversoft/vehicle/Vehicle.java): public class, private fields, public no-arg and all-args constructors, a getter and setter per field, and `equals`/`hashCode`/`toString` built with `java.util.Objects`. The test class copies the harness in [`VehicleTest`](../../../src/test/java/com/neversoft/vehicle/VehicleTest.java) (`test`/`check`/`eq` helpers, `main` that exits 1 on failure).

Design decisions fixed here so implementation does not need to re-decide them:
- Ownership goes downward as lists: `Warehouse` holds `List<Store>`, `Store` holds `List<Location>`. `Location`, `Product` and `StockItem` hold no list of parents, so `equals`, `hashCode` and `toString` cannot recurse infinitely.
- Upward links are plain `long` ids: `Store.warehouseId`, `Location.storeId`, `StockItem.locationId`.
- `StockItem` is the only place a quantity lives. It holds a `long locationId`, a `Product product` and an `int quantity`. A location can have many `StockItem`s with different products, and a product can appear in `StockItem`s with different `locationId`s.
- `Location.capacity` is an `Integer`. `null` means "no capacity set", which is the "optional capacity" in the high-level plan.
- Lists are never null. The field is initialised with `new ArrayList<>()`. The all-args constructor and the list setters replace a `null` argument with a new empty `ArrayList`. Otherwise the lists are stored by reference with no defensive copy, as the high-level plan accepts for a plain POJO.
- The only validation is in the `StockItem` quantity helpers. Constructors and plain setters do not validate, which matches `Vehicle`.
- Domain helpers are limited to `Warehouse.addStore`, `Store.addLocation` and `StockItem.addQuantity`/`removeQuantity`.

## Changes by file

### src/main/java/com/neversoft/warehouse/Warehouse.java (create)
- Package `com.neversoft.warehouse`, public class with a class Javadoc saying the field list is provisional, as `Vehicle` does.
- Private fields: `long id`, `String name`, `String address`, `List<Store> stores = new ArrayList<>()`.
- Public no-arg constructor (an empty body, so `stores` is an empty list). Public all-args constructor `(long id, String name, String address, List<Store> stores)`, where `stores == null` becomes `new ArrayList<>()`.
- Getter and setter for each field. `setStores(null)` also becomes an empty list.
- `addStore(Store store)` appends to `stores`. A null `store` throws `NullPointerException` via `Objects.requireNonNull`. It does not change `store.warehouseId`; the caller sets that.
- `equals` uses `getClass()` and `Objects.equals` over all four fields. `hashCode` is `Objects.hash(id, name, address, stores)`. `toString` is `Warehouse{id=.., name='..', address='..', stores=[..]}`.
- Symbols: `Warehouse`, `Warehouse.addStore`
- Covers: AC-1, AC-2, AC-3, AC-4, AC-8

### src/main/java/com/neversoft/warehouse/Store.java (create)
- Private fields: `long id`, `String name`, `long warehouseId`, `List<Location> locations = new ArrayList<>()`.
- No-arg constructor and all-args constructor `(long id, String name, long warehouseId, List<Location> locations)`, with the same null-to-empty-list rule.
- Getters and setters, including `setLocations`.
- `addLocation(Location location)` appends to `locations`. A null argument throws `NullPointerException` via `Objects.requireNonNull`. It does not change `location.storeId`.
- `equals`, `hashCode` and `toString` over all four fields, in the same style as `Warehouse`.
- Symbols: `Store`, `Store.addLocation`
- Covers: AC-1, AC-2, AC-3, AC-4, AC-8

### src/main/java/com/neversoft/warehouse/Location.java (create)
- Private fields: `long id`, `String code` (a free-text position such as "A-03-2-B"), `long storeId`, `Integer capacity` (nullable).
- No-arg constructor and all-args constructor `(long id, String code, long storeId, Integer capacity)`.
- Getters and setters. `getCapacity()` returns `Integer`.
- `equals`, `hashCode` and `toString` over all four fields, using `Objects.equals` so a null `capacity` and a null `code` are safe.
- Symbols: `Location`
- Covers: AC-1, AC-2, AC-3, AC-8

### src/main/java/com/neversoft/warehouse/Product.java (create)
- Private fields: `long id`, `String sku`, `String name`, `String description`, `String unitOfMeasure`.
- No-arg constructor and all-args constructor `(long id, String sku, String name, String description, String unitOfMeasure)`.
- Getters and setters. `equals`, `hashCode` and `toString` over all five fields.
- Symbols: `Product`
- Covers: AC-1, AC-2, AC-3, AC-5, AC-8

### src/main/java/com/neversoft/warehouse/StockItem.java (create)
- Private fields: `long locationId`, `Product product`, `int quantity`.
- No-arg constructor (`product` null, `quantity` 0) and all-args constructor `(long locationId, Product product, int quantity)`.
- Getters and setters. `setQuantity` is a plain setter with no validation.
- `addQuantity(int amount)`:
  - Throws `IllegalArgumentException` if `amount <= 0`.
  - Throws `IllegalArgumentException` if `quantity > Integer.MAX_VALUE - amount`, which would overflow.
  - Otherwise `quantity += amount`.
- `removeQuantity(int amount)`:
  - Throws `IllegalArgumentException` if `amount <= 0`.
  - Throws `IllegalArgumentException` if `amount > quantity`, because the result would be negative.
  - Otherwise `quantity -= amount`.
- On any exception `quantity` is left unchanged. Both exceptions are documented in the method Javadoc with `@throws IllegalArgumentException`.
- `equals`, `hashCode` and `toString` over `locationId`, `product` and `quantity`. `Product` is compared with `Objects.equals`, so a null product is safe.
- Symbols: `StockItem`, `StockItem.addQuantity`, `StockItem.removeQuantity`
- Covers: AC-1, AC-2, AC-3, AC-5, AC-6, AC-8

### src/test/java/com/neversoft/warehouse/WarehouseTest.java (create)
- Package `com.neversoft.warehouse`, public class `WarehouseTest` with `public static void main(String[] args)`. It uses the same `FAILURES`, `run`, `test`, `check` and `eq` helpers as `VehicleTest`, and prints `N tests run, M failed`. It calls `System.exit(1)` on failure.
- Tests (ids are local to this file):
  - W-1: all five classes load by fully qualified name, are public, and are in package `com.neversoft.warehouse`.
  - W-2: each class has a public no-arg constructor, only private non-static fields, and `Object` as superclass with no interfaces. It also checks the declared field count and types per class by reflection.
  - W-3: for each class, the all-args constructor assigns every field, and each getter returns what its setter stored. This includes `Location.capacity` set to `null`.
  - W-4: a default `Warehouse` has a non-null empty `getStores()`. A default `Store` has a non-null empty `getLocations()`. Passing `null` to the all-args constructor and to the list setters also gives an empty list.
  - W-5: `addStore` and `addLocation` append in order. Passing null throws `NullPointerException`.
  - W-6: `equals` contract (reflexive, symmetric, not equal to null or to another type) and `hashCode` consistent with `equals`. This covers all five classes, including a changed nested child, which breaks equality for `Warehouse`.
  - W-7: `equals` is false when any single field differs. A list of mutations is used per class, as in `VehicleTest.t13`.
  - W-8: default-constructed objects are equal, and their `equals`, `hashCode` and `toString` do not throw. This covers null strings, a null `Product`, a null `capacity` and empty lists.
  - W-9: `toString` of each class contains every field value. A fully populated `Warehouse` tree (a warehouse with a store, a location and a stock item) renders without recursion.
  - W-10: relationship test. Build two `Product`s and three `StockItem`s: one location holds two products, and one product is stocked in two locations. Assert that the `locationId`s and `Product`s read back correctly.
  - W-11: `addQuantity` and `removeQuantity` happy paths: 5 + 3 = 8, and 8 - 8 = 0.
  - W-12: `addQuantity(0)`, `addQuantity(-1)`, `removeQuantity(0)`, `removeQuantity(-1)`, `removeQuantity(quantity + 1)` and an add that overflows `Integer.MAX_VALUE` each throw `IllegalArgumentException` and leave `quantity` unchanged.
- Must compile cleanly under `-Xlint:all -Werror`: no raw types and no unchecked casts. Use `List.of(...)` of `Consumer<T>` the way `VehicleTest.t13` does.
- Covers: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8

### package.json (modify)
- Change only the `scripts.test` string. The existing `javac` invocation gains the five warehouse source paths and `WarehouseTest.java`. The existing `java -cp "$OUT" com.neversoft.vehicle.VehicleTest` is kept as is. `&& java -cp "$OUT" com.neversoft.warehouse.WarehouseTest` is appended.
- New value:
  `OUT=$(mktemp -d) && javac --release 25 -Xlint:all -Werror -d "$OUT" src/main/java/com/neversoft/vehicle/Vehicle.java src/main/java/com/neversoft/warehouse/Warehouse.java src/main/java/com/neversoft/warehouse/Store.java src/main/java/com/neversoft/warehouse/Location.java src/main/java/com/neversoft/warehouse/Product.java src/main/java/com/neversoft/warehouse/StockItem.java src/test/java/com/neversoft/vehicle/VehicleTest.java src/test/java/com/neversoft/warehouse/WarehouseTest.java && java -cp "$OUT" com.neversoft.vehicle.VehicleTest && java -cp "$OUT" com.neversoft.warehouse.WarehouseTest`
- The JSON must stay valid, so the inner double quotes remain escaped as `\"`. No other keys change.
- Covers: AC-7, AC-8, AC-9

No other file is touched: `Vehicle.java` and `VehicleTest.java` stay unchanged (AC-9).

## Interfaces
New public API, all in `com.neversoft.warehouse`. Every class also has a public getter and setter per field, named in the usual way (`getX`/`setX`).

```java
public class Warehouse {
    public Warehouse();
    public Warehouse(long id, String name, String address, List<Store> stores);
    public void addStore(Store store);            // NPE if store == null
    public List<Store> getStores();               // never null
    public void setStores(List<Store> stores);    // null -> empty list
}

public class Store {
    public Store();
    public Store(long id, String name, long warehouseId, List<Location> locations);
    public void addLocation(Location location);   // NPE if location == null
    public List<Location> getLocations();         // never null
    public void setLocations(List<Location> locations); // null -> empty list
}

public class Location {
    public Location();
    public Location(long id, String code, long storeId, Integer capacity);
    public Integer getCapacity();                 // null = no capacity set
}

public class Product {
    public Product();
    public Product(long id, String sku, String name, String description, String unitOfMeasure);
}

public class StockItem {
    public StockItem();
    public StockItem(long locationId, Product product, int quantity);
    /** @throws IllegalArgumentException if amount <= 0 or the sum would exceed Integer.MAX_VALUE */
    public void addQuantity(int amount);
    /** @throws IllegalArgumentException if amount <= 0 or amount > current quantity */
    public void removeQuantity(int amount);
}
```

Each class also has `equals(Object)`, `hashCode()` and `toString()`.

## Data and configuration changes
None, apart from the `scripts.test` string in `package.json`. There are no migrations, schemas, flags or env vars.

## Test approach
| Layer | What | Covers |
|---|---|---|
| smoke | W-1: the five classes load by FQN, are public, and are in `com.neversoft.warehouse`. The `npm test` run itself also proves the sources compile with `-Xlint:all -Werror` and that `VehicleTest` still passes. | AC-1, AC-7, AC-8, AC-9 |
| bdd | W-10 (a location with two products, and a product in two locations) and W-11/W-12 (add and remove stock, and rejected removals), written as Given/When/Then comments in the style of `VehicleTest`. | AC-5, AC-6 |
| component | W-4, W-5 and W-9: building a `Warehouse` -> `Store` -> `Location` tree, checking child lists are never null, appending children, and printing the whole tree without recursion. | AC-3, AC-4 |
| unit | W-2, W-3, W-6, W-7, W-8: reflection checks on the POJO shape, constructor/getter/setter round-trips per class, and the `equals`/`hashCode`/`toString` contract including null fields. W-12 covers the invalid `StockItem` arguments one by one. | AC-2, AC-3, AC-6 |

Run with `npm test`. The pass condition is exit code 0, with both `VehicleTest` and `WarehouseTest` reporting `0 failed`.

## Rollout
1. Create the five classes in `src/main/java/com/neversoft/warehouse/`. Order: `Product`, `Location`, `Store`, `Warehouse`, `StockItem`.
2. Create `WarehouseTest.java`.
3. Edit `package.json` last, then run `npm test` and confirm both test classes pass with no compiler warnings.

There are no flags. Backwards compatibility is not a concern: the change is additive, and only the test script changes in an existing file. `Vehicle` and `VehicleTest` stay in the same compile and run steps, so their behaviour is unchanged.

## Open questions
None

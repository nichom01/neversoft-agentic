package com.neversoft.warehouse;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Supplier;

/**
 * Dependency-free test harness for the warehouse classes. Run with plain javac and java:
 * <pre>
 * OUT=$(mktemp -d)
 * javac --release 25 -Xlint:all -Werror -d "$OUT" src/main/java/com/neversoft/warehouse/*.java \
 *     src/test/java/com/neversoft/warehouse/WarehouseTest.java
 * java -cp "$OUT" com.neversoft.warehouse.WarehouseTest
 * </pre>
 * Exits non-zero if any test fails. Test ids (T-n) trace to docs/bob/3/tests.json.
 * T-1 to T-3 are smoke checks on the build and change set and are not Java tests.
 */
public class WarehouseTest {

    private static final List<String> FAILURES = new ArrayList<>();
    private static int run;

    public static void main(String[] args) {
        // BDD
        test("T-4 Developer can load each warehouse class by its fully qualified name", WarehouseTest::t4);
        test("T-5 No-arg and all-args construction of each class", WarehouseTest::t5);
        test("T-6 Equal objects are equal, print every field, and differ when a field differs", WarehouseTest::t6);
        test("T-7 A new Warehouse or Store never has null child lists", WarehouseTest::t7);
        test("T-8 One location holds several products, one product sits in several locations", WarehouseTest::t8);
        test("T-9 Adding and removing stock, and rejected quantity changes", WarehouseTest::t9);
        // component
        test("T-10 Full Warehouse tree builds, compares and prints without recursion", WarehouseTest::t10);
        test("T-11 Stock resolved through the tree by location id and adjusted", WarehouseTest::t11);
        // unit
        test("T-12 Class shape", WarehouseTest::t12);
        test("T-13 All-args constructor assigns every field", WarehouseTest::t13);
        test("T-14 Getters return what setters stored", WarehouseTest::t14);
        test("T-15 Null lists become empty lists", WarehouseTest::t15);
        test("T-16 addStore and addLocation append in order and reject null", WarehouseTest::t16);
        test("T-17 equals contract", WarehouseTest::t17);
        test("T-18 equals false when any single field differs", WarehouseTest::t18);
        test("T-19 hashCode consistent with equals", WarehouseTest::t19);
        test("T-20 Null-safe equals, hashCode, toString", WarehouseTest::t20);
        test("T-21 toString includes all fields", WarehouseTest::t21);
        test("T-22 StockItem defaults, setQuantity does not validate", WarehouseTest::t22);
        test("T-23 addQuantity and removeQuantity happy paths", WarehouseTest::t23);
        test("T-24 Invalid quantity arguments throw IllegalArgumentException", WarehouseTest::t24);
        test("T-25 Child lists are stored by reference", WarehouseTest::t25);

        System.out.println(run + " tests run, " + FAILURES.size() + " failed");
        if (!FAILURES.isEmpty()) {
            FAILURES.forEach(f -> System.out.println("FAIL: " + f));
            System.exit(1);
        }
    }

    // ---- harness ----

    private static void test(String name, Runnable body) {
        run++;
        try {
            body.run();
            System.out.println("PASS: " + name);
        } catch (Throwable t) {
            FAILURES.add(name + " -> " + t);
        }
    }

    private static void check(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError(message);
        }
    }

    private static void eq(Object expected, Object actual, String message) {
        if (!Objects.equals(expected, actual)) {
            throw new AssertionError(message + ": expected <" + expected + "> but was <" + actual + ">");
        }
    }

    private static void throwsExactly(Class<? extends Throwable> type, Runnable body, String message) {
        try {
            body.run();
        } catch (Throwable t) {
            if (t.getClass() != type) {
                throw new AssertionError(message + ": expected " + type.getName() + " but got " + t, t);
            }
            return;
        }
        throw new AssertionError(message + ": expected " + type.getName() + " but nothing was thrown");
    }

    // ---- baselines ----

    private static Product prod() {
        return new Product(1, "SKU-1", "Widget", "A widget", "each");
    }

    private static Location loc() {
        return new Location(10, "A-03-2-B", 5, 100);
    }

    private static Store store() {
        Store s = new Store(5, "Main", 2, null);
        s.addLocation(loc());
        return s;
    }

    private static Warehouse wh() {
        Warehouse w = new Warehouse(2, "Central", "1 High St", null);
        w.addStore(store());
        return w;
    }

    private static StockItem stock() {
        return new StockItem(10, prod(), 5);
    }

    private static final Class<?>[] CLASSES = {
        Warehouse.class, Store.class, Location.class, Product.class, StockItem.class
    };

    // ---- BDD scenarios ----

    // Given the sources are compiled, When each class is loaded by FQN, Then found, public, right package
    private static void t4() {
        for (String n : new String[] {"Warehouse", "Store", "Location", "Product", "StockItem"}) {
            try {
                Class<?> c = Class.forName("com.neversoft.warehouse." + n);
                check(Modifier.isPublic(c.getModifiers()), n + " must be public");
                eq("com.neversoft.warehouse", c.getPackageName(), "package of " + n);
            } catch (ClassNotFoundException e) {
                throw new AssertionError(n + " class not found", e);
            }
        }
    }

    // Given new objects (no-arg), When setters are called, Then getters return the values;
    // Given values for every field, When the all-args constructor is called, Then getters return them
    private static void t5() {
        Warehouse w = new Warehouse();
        w.setId(1);
        w.setName("W");
        w.setAddress("addr");
        eq(1L, w.getId(), "warehouse id");
        eq("W", w.getName(), "warehouse name");
        eq("addr", w.getAddress(), "warehouse address");

        Store s = new Store();
        s.setId(2);
        s.setName("S");
        s.setWarehouseId(1);
        eq(2L, s.getId(), "store id");
        eq("S", s.getName(), "store name");
        eq(1L, s.getWarehouseId(), "store warehouseId");

        Location l = new Location();
        l.setId(3);
        l.setCode("C");
        l.setStoreId(2);
        l.setCapacity(9);
        eq(3L, l.getId(), "location id");
        eq("C", l.getCode(), "location code");
        eq(2L, l.getStoreId(), "location storeId");
        eq(9, l.getCapacity(), "location capacity");

        Product p = new Product();
        p.setId(4);
        p.setSku("K");
        p.setName("N");
        p.setDescription("D");
        p.setUnitOfMeasure("kg");
        eq(4L, p.getId(), "product id");
        eq("K", p.getSku(), "product sku");
        eq("N", p.getName(), "product name");
        eq("D", p.getDescription(), "product description");
        eq("kg", p.getUnitOfMeasure(), "product unit");

        StockItem si = new StockItem();
        si.setLocationId(3);
        si.setProduct(p);
        si.setQuantity(7);
        eq(3L, si.getLocationId(), "stock locationId");
        eq(p, si.getProduct(), "stock product");
        eq(7, si.getQuantity(), "stock quantity");

        Location nullCap = new Location(1, "X", 2, null);
        check(nullCap.getCapacity() == null, "null capacity stored");
        eq("Central", wh().getName(), "all-args warehouse name");
        eq("Main", store().getName(), "all-args store name");
        eq("Widget", prod().getName(), "all-args product name");
    }

    // Given two Warehouse trees from the same values, When compared and printed, Then equal;
    // Given a different nested Location code, Then not equal
    private static void t6() {
        Warehouse a = wh();
        Warehouse b = wh();
        check(a.equals(b), "identical trees must be equal");
        eq(a.hashCode(), b.hashCode(), "hashCode");
        String s = a.toString();
        for (String part : new String[] {"2", "Central", "1 High St", "Main", "A-03-2-B", "100"}) {
            check(s.contains(part), "toString missing " + part + ": " + s);
        }
        b.getStores().get(0).getLocations().get(0).setCode("OTHER");
        check(!a.equals(b), "different nested location code must differ");
    }

    // Given a default Warehouse and Store, When lists are read, Then empty non-null;
    // Given a store added to the warehouse and a location to the store, Then they are held
    private static void t7() {
        Warehouse w = new Warehouse();
        Store s = new Store();
        check(w.getStores() != null && w.getStores().isEmpty(), "default stores empty");
        check(s.getLocations() != null && s.getLocations().isEmpty(), "default locations empty");
        Location l = loc();
        s.addLocation(l);
        w.addStore(s);
        eq(1, w.getStores().size(), "stores size");
        check(w.getStores().get(0) == s, "warehouse holds store");
        eq(1, s.getLocations().size(), "locations size");
        check(s.getLocations().get(0) == l, "store holds location");
    }

    // Given products P1, P2 and locations 10 and 20, When stock items are created,
    // Then location 10 has two products and P1 is in locations 10 and 20
    private static void t8() {
        Product p1 = new Product(1, "P1", "One", "", "each");
        Product p2 = new Product(2, "P2", "Two", "", "each");
        List<StockItem> items = List.of(new StockItem(10, p1, 5), new StockItem(10, p2, 3), new StockItem(20, p1, 7));
        List<StockItem> at10 = items.stream().filter(i -> i.getLocationId() == 10).toList();
        eq(2, at10.size(), "items at location 10");
        check(!at10.get(0).getProduct().equals(at10.get(1).getProduct()), "different products at location 10");
        List<StockItem> ofP1 = items.stream().filter(i -> i.getProduct().equals(p1)).toList();
        eq(2, ofP1.size(), "items of P1");
        eq(10L, ofP1.get(0).getLocationId(), "P1 first location");
        eq(20L, ofP1.get(1).getLocationId(), "P1 second location");
        eq(5, items.get(0).getQuantity(), "quantity 0");
        eq(3, items.get(1).getQuantity(), "quantity 1");
        eq(7, items.get(2).getQuantity(), "quantity 2");
        eq(p2, items.get(1).getProduct(), "product 1");
    }

    // Given a StockItem with quantity 5, When 3 is added and 8 removed, Then 8 then 0;
    // Given quantity 5, When removing 6, adding 0 or removing -1, Then IllegalArgumentException and still 5
    private static void t9() {
        StockItem a = stock();
        a.addQuantity(3);
        eq(8, a.getQuantity(), "after add");
        a.removeQuantity(8);
        eq(0, a.getQuantity(), "after remove");

        StockItem b = stock();
        throwsExactly(IllegalArgumentException.class, () -> b.removeQuantity(6), "remove 6");
        throwsExactly(IllegalArgumentException.class, () -> b.addQuantity(0), "add 0");
        throwsExactly(IllegalArgumentException.class, () -> b.removeQuantity(-1), "remove -1");
        eq(5, b.getQuantity(), "quantity unchanged");
    }

    // ---- component tests ----

    private static void t10() {
        Warehouse a = buildTree();
        Warehouse b = buildTree();
        String s = a.toString();
        check(s.contains("Main") && s.contains("Annex"), "toString contains store names: " + s);
        check(s.contains("A-03-2-B") && s.contains("B-01-1-A"), "toString contains location codes: " + s);
        eq(a.hashCode(), b.hashCode(), "hash of identical trees");
        check(a.equals(b), "independently built identical trees equal");
        List<StockItem> items = List.of(new StockItem(10, prod(), 4));
        check(items.get(0).toString().contains("Widget"), "stock item prints product");
    }

    private static Warehouse buildTree() {
        Warehouse w = new Warehouse(2, "Central", "1 High St", null);
        Store main = new Store(5, "Main", 2, null);
        main.addLocation(new Location(10, "A-03-2-B", 5, 100));
        main.addLocation(new Location(11, "A-03-2-C", 5, null));
        Store annex = new Store(6, "Annex", 2, null);
        annex.addLocation(new Location(20, "B-01-1-A", 6, 50));
        w.addStore(main);
        w.addStore(annex);
        return w;
    }

    private static void t11() {
        Warehouse w = buildTree();
        Product p1 = new Product(1, "P1", "One", "", "each");
        Product p2 = new Product(2, "P2", "Two", "", "each");
        List<StockItem> items = new ArrayList<>();
        items.add(new StockItem(10, p1, 5));
        items.add(new StockItem(10, p2, 3));
        items.add(new StockItem(20, p1, 7));

        Location l10 = w.getStores().get(0).getLocations().get(0);
        Location l20 = w.getStores().get(1).getLocations().get(0);
        List<StockItem> at10 = items.stream().filter(i -> i.getLocationId() == l10.getId()).toList();
        List<StockItem> at20 = items.stream().filter(i -> i.getLocationId() == l20.getId()).toList();
        eq(2, at10.size(), "items at 10");
        eq(1, at20.size(), "items at 20");

        StockItem target = at10.get(0);
        target.removeQuantity(2);
        eq(3, items.get(0).getQuantity(), "target reduced");
        eq(3, items.get(1).getQuantity(), "sibling unchanged");
        eq(7, items.get(2).getQuantity(), "other location unchanged");
        throwsExactly(IllegalArgumentException.class, () -> target.removeQuantity(4), "over-removal");
        eq(3, target.getQuantity(), "unchanged after rejected removal");
    }

    // ---- unit tests ----

    private static String cap(String s) {
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private static void shape(Class<?> c, String[][] expected) {
        String n = c.getSimpleName();
        try {
            Constructor<?> ctor = c.getConstructor();
            check(Modifier.isPublic(ctor.getModifiers()), n + " no-arg constructor must be public");
            eq(0, ctor.getAnnotations().length, n + " constructor annotations");
        } catch (NoSuchMethodException e) {
            throw new AssertionError(n + " public no-arg constructor missing", e);
        }
        eq(Object.class, c.getSuperclass(), n + " superclass");
        eq(0, c.getInterfaces().length, n + " interface count");
        eq(0, c.getAnnotations().length, n + " class annotations");
        eq(expected.length, c.getDeclaredFields().length, n + " declared field count");
        for (String[] e : expected) {
            try {
                Field f = c.getDeclaredField(e[0]);
                eq(e[1], f.getType().getName(), n + " type of " + e[0]);
                check(Modifier.isPrivate(f.getModifiers()), n + "." + e[0] + " must be private");
                check(!Modifier.isStatic(f.getModifiers()), n + "." + e[0] + " must be an instance field");
                eq(0, f.getAnnotations().length, n + "." + e[0] + " annotations");
                Method getter = c.getMethod("get" + cap(e[0]));
                eq(f.getType(), getter.getReturnType(), n + " getter type of " + e[0]);
                Method setter = c.getMethod("set" + cap(e[0]), f.getType());
                check(Modifier.isPublic(setter.getModifiers()), n + " setter of " + e[0] + " must be public");
            } catch (NoSuchFieldException | NoSuchMethodException ex) {
                throw new AssertionError(n + " missing field or accessor " + e[0], ex);
            }
        }
    }

    private static void t12() {
        shape(Warehouse.class, new String[][] {
            {"id", "long"}, {"name", "java.lang.String"}, {"address", "java.lang.String"},
            {"stores", "java.util.List"}});
        shape(Store.class, new String[][] {
            {"id", "long"}, {"name", "java.lang.String"}, {"warehouseId", "long"},
            {"locations", "java.util.List"}});
        shape(Location.class, new String[][] {
            {"id", "long"}, {"code", "java.lang.String"}, {"storeId", "long"},
            {"capacity", "java.lang.Integer"}});
        shape(Product.class, new String[][] {
            {"id", "long"}, {"sku", "java.lang.String"}, {"name", "java.lang.String"},
            {"description", "java.lang.String"}, {"unitOfMeasure", "java.lang.String"}});
        shape(StockItem.class, new String[][] {
            {"locationId", "long"}, {"product", "com.neversoft.warehouse.Product"}, {"quantity", "int"}});
    }

    private static void t13() {
        // distinct values per field catch swapped same-typed arguments
        List<Location> locs = new ArrayList<>();
        Location l = new Location(31L, "code-A", 32L, 33);
        eq(31L, l.getId(), "location id");
        eq("code-A", l.getCode(), "location code");
        eq(32L, l.getStoreId(), "location storeId");
        eq(33, l.getCapacity(), "location capacity");
        check(new Location(1, "c", 2, null).getCapacity() == null, "null capacity");
        eq(0, new Location(1, "c", 2, 0).getCapacity(), "zero capacity");

        locs.add(l);
        Store s = new Store(41L, "name-B", 42L, locs);
        eq(41L, s.getId(), "store id");
        eq("name-B", s.getName(), "store name");
        eq(42L, s.getWarehouseId(), "store warehouseId");
        check(s.getLocations() == locs, "store locations");

        List<Store> stores = new ArrayList<>();
        stores.add(s);
        Warehouse w = new Warehouse(51L, "name-C", "address-D", stores);
        eq(51L, w.getId(), "warehouse id");
        eq("name-C", w.getName(), "warehouse name");
        eq("address-D", w.getAddress(), "warehouse address");
        check(w.getStores() == stores, "warehouse stores");

        Product p = new Product(61L, "sku-E", "name-F", "desc-G", "unit-H");
        eq(61L, p.getId(), "product id");
        eq("sku-E", p.getSku(), "product sku");
        eq("name-F", p.getName(), "product name");
        eq("desc-G", p.getDescription(), "product description");
        eq("unit-H", p.getUnitOfMeasure(), "product unit");

        StockItem si = new StockItem(71L, p, 72);
        eq(71L, si.getLocationId(), "stock locationId");
        check(si.getProduct() == p, "stock product");
        eq(72, si.getQuantity(), "stock quantity");

        // no validation: negatives and empty strings stored as given
        Warehouse odd = new Warehouse(-1L, "", "", new ArrayList<>());
        eq(-1L, odd.getId(), "negative id");
        eq("", odd.getName(), "empty name");
        eq("", odd.getAddress(), "empty address");
        Product oddP = new Product(-2L, "", "", "", "");
        eq(-2L, oddP.getId(), "negative product id");
        eq("", oddP.getSku(), "empty sku");
        Location oddL = new Location(-3L, "", -4L, -5);
        eq(-3L, oddL.getId(), "negative location id");
        eq(-4L, oddL.getStoreId(), "negative storeId");
        eq(-5, oddL.getCapacity(), "negative capacity");
    }

    private static void t14() {
        Warehouse w = wh();
        w.setId(Long.MAX_VALUE);
        eq(Long.MAX_VALUE, w.getId(), "warehouse id max");
        w.setName(null);
        check(w.getName() == null, "warehouse name null");
        eq("1 High St", w.getAddress(), "address unchanged");
        eq(1, w.getStores().size(), "stores unchanged");
        w.setAddress(null);
        check(w.getAddress() == null, "warehouse address null");
        eq(Long.MAX_VALUE, w.getId(), "id unchanged after setAddress");

        Store s = store();
        s.setWarehouseId(Long.MAX_VALUE);
        eq(Long.MAX_VALUE, s.getWarehouseId(), "warehouseId max");
        eq(5L, s.getId(), "store id unchanged");
        eq("Main", s.getName(), "store name unchanged");
        s.setName(null);
        check(s.getName() == null, "store name null");
        eq(1, s.getLocations().size(), "locations unchanged");

        Location l = loc();
        l.setCapacity(null);
        check(l.getCapacity() == null, "capacity null");
        eq("A-03-2-B", l.getCode(), "code unchanged");
        l.setCode(null);
        check(l.getCode() == null, "code null");
        l.setStoreId(Long.MAX_VALUE);
        eq(Long.MAX_VALUE, l.getStoreId(), "storeId max");
        eq(10L, l.getId(), "location id unchanged");
        l.setId(Long.MAX_VALUE);
        check(l.getCapacity() == null, "capacity still null");

        Product p = prod();
        p.setSku(null);
        check(p.getSku() == null, "sku null");
        eq("Widget", p.getName(), "name unchanged");
        eq("A widget", p.getDescription(), "description unchanged");
        eq("each", p.getUnitOfMeasure(), "unit unchanged");
        p.setUnitOfMeasure("kg");
        eq("kg", p.getUnitOfMeasure(), "unit");
        eq("Widget", p.getName(), "name unchanged after setUnitOfMeasure");
        p.setDescription(null);
        check(p.getDescription() == null, "description null");
        p.setName(null);
        check(p.getName() == null, "name null");
        p.setId(Long.MAX_VALUE);
        eq(Long.MAX_VALUE, p.getId(), "product id max");

        StockItem si = stock();
        si.setQuantity(Integer.MAX_VALUE);
        eq(Integer.MAX_VALUE, si.getQuantity(), "quantity max");
        eq(10L, si.getLocationId(), "locationId unchanged");
        si.setProduct(null);
        check(si.getProduct() == null, "product null");
        eq(Integer.MAX_VALUE, si.getQuantity(), "quantity unchanged after setProduct");
        si.setLocationId(Long.MAX_VALUE);
        eq(Long.MAX_VALUE, si.getLocationId(), "locationId max");
    }

    private static void t15() {
        check(new Warehouse(1, "n", "a", null).getStores().isEmpty(), "warehouse ctor null -> empty");
        check(new Warehouse(1, "n", "a", null).getStores() != null, "warehouse ctor non-null");
        check(new Store(1, "n", 2, null).getLocations() != null, "store ctor non-null");
        check(new Store(1, "n", 2, null).getLocations().isEmpty(), "store ctor null -> empty");

        Warehouse w = wh();
        w.setStores(null);
        check(w.getStores() != null && w.getStores().isEmpty(), "setStores(null) -> empty");
        Store s = store();
        s.setLocations(null);
        check(s.getLocations() != null && s.getLocations().isEmpty(), "setLocations(null) -> empty");

        List<Store> given = new ArrayList<>();
        given.add(store());
        w.setStores(given);
        eq(1, w.getStores().size(), "non-null list accepted");
        List<Location> givenLocs = new ArrayList<>();
        givenLocs.add(loc());
        s.setLocations(givenLocs);
        eq(1, s.getLocations().size(), "non-null locations accepted");
    }

    private static void t16() {
        Warehouse w = new Warehouse();
        Store s1 = new Store(1, "a", 99, null);
        Store s2 = new Store(2, "b", 99, null);
        Store s3 = new Store(3, "c", 99, null);
        w.addStore(s1);
        w.addStore(s2);
        w.addStore(s3);
        eq(3, w.getStores().size(), "stores size");
        check(w.getStores().get(0) == s1 && w.getStores().get(1) == s2 && w.getStores().get(2) == s3,
                "stores in order");
        eq(99L, s1.getWarehouseId(), "warehouseId unchanged by addStore");
        throwsExactly(NullPointerException.class, () -> w.addStore(null), "addStore(null)");
        eq(3, w.getStores().size(), "stores size after rejected add");

        Store s = new Store();
        Location l1 = new Location(1, "a", 77, null);
        Location l2 = new Location(2, "b", 77, null);
        Location l3 = new Location(3, "c", 77, null);
        s.addLocation(l1);
        s.addLocation(l2);
        s.addLocation(l3);
        eq(3, s.getLocations().size(), "locations size");
        check(s.getLocations().get(0) == l1 && s.getLocations().get(1) == l2 && s.getLocations().get(2) == l3,
                "locations in order");
        eq(77L, l1.getStoreId(), "storeId unchanged by addLocation");
        throwsExactly(NullPointerException.class, () -> s.addLocation(null), "addLocation(null)");
        eq(3, s.getLocations().size(), "locations size after rejected add");
    }

    @SuppressWarnings({"EqualsWithItself", "ConstantConditions"})
    private static <T> void contract(Supplier<T> make, Object otherClass) {
        T a = make.get();
        T b = make.get();
        String n = a.getClass().getSimpleName();
        check(a.equals(a), n + " reflexive");
        check(a.equals(b) && b.equals(a), n + " symmetric");
        check(!a.equals(null), n + " not equal to null");
        check(!a.equals("text"), n + " not equal to String");
        check(!a.equals(new Object()), n + " not equal to Object");
        check(!a.equals(otherClass), n + " not equal to another warehouse class");
        check(!otherClass.equals(a), n + " reverse not equal to another warehouse class");
    }

    private static void t17() {
        contract(WarehouseTest::wh, store());
        contract(WarehouseTest::store, wh());
        contract(WarehouseTest::loc, prod());
        contract(WarehouseTest::prod, loc());
        contract(WarehouseTest::stock, prod());
        // same-shaped default objects of different classes
        check(!new Warehouse().equals(new Store()), "default Warehouse vs Store");
        check(!new Location().equals(new Product()), "default Location vs Product");
    }

    private static <T> void mutations(Supplier<T> base, List<Consumer<T>> muts, int expectedCount, int fieldCount) {
        String n = base.get().getClass().getSimpleName();
        eq(expectedCount, muts.size(), n + " mutation count");
        check(muts.size() >= fieldCount, n + " must have at least one mutation per field");
        int i = 0;
        for (Consumer<T> m : muts) {
            T other = base.get();
            m.accept(other);
            check(!base.get().equals(other), n + " mutation " + i + " not detected by equals");
            check(!other.equals(base.get()), n + " mutation " + i + " not detected by reverse equals");
            i++;
        }
    }

    private static void t18() {
        mutations(WarehouseTest::wh, List.of(
            w -> w.setId(3),
            w -> w.setName("Other"),
            w -> w.setAddress("Other"),
            w -> w.getStores().get(0).setName("Changed"),
            w -> w.addStore(new Store())), 5, 4);
        mutations(WarehouseTest::store, List.of(
            s -> s.setId(6),
            s -> s.setName("Other"),
            s -> s.setWarehouseId(3),
            s -> s.getLocations().get(0).setCode("Changed"),
            s -> s.addLocation(new Location())), 5, 4);
        mutations(WarehouseTest::loc, List.of(
            l -> l.setId(11),
            l -> l.setCode("Other"),
            l -> l.setStoreId(6),
            l -> l.setCapacity(101),
            l -> l.setCapacity(null)), 5, 4);
        mutations(WarehouseTest::prod, List.of(
            p -> p.setId(2),
            p -> p.setSku("Other"),
            p -> p.setName("Other"),
            p -> p.setDescription("Other"),
            p -> p.setUnitOfMeasure("Other")), 5, 5);
        mutations(WarehouseTest::stock, List.of(
            s -> s.setLocationId(11),
            s -> s.setProduct(new Product(9, "x", "y", "z", "w")),
            s -> s.getProduct().setName("Changed"),
            s -> s.setQuantity(6),
            s -> s.setProduct(null)), 5, 3);
    }

    private static <T> void hashing(Supplier<T> make, Consumer<T> mutate, Consumer<T> revert) {
        T a = make.get();
        T b = make.get();
        String n = a.getClass().getSimpleName();
        eq(a.hashCode(), b.hashCode(), n + " equal objects, equal hash");
        int first = a.hashCode();
        eq(first, a.hashCode(), n + " stable across calls");
        mutate.accept(a);
        revert.accept(a);
        eq(first, a.hashCode(), n + " hash restored after mutate and revert");
    }

    private static void t19() {
        hashing(WarehouseTest::wh, w -> w.setName("x"), w -> w.setName("Central"));
        hashing(WarehouseTest::store, s -> s.setName("x"), s -> s.setName("Main"));
        hashing(WarehouseTest::loc, l -> l.setCapacity(1), l -> l.setCapacity(100));
        hashing(WarehouseTest::prod, p -> p.setSku("x"), p -> p.setSku("SKU-1"));
        hashing(WarehouseTest::stock, s -> s.setQuantity(1), s -> s.setQuantity(5));
        // equal child lists built separately
        eq(buildTree().getStores().hashCode(), buildTree().getStores().hashCode(), "child list hash");
        eq(buildTree().hashCode(), buildTree().hashCode(), "tree hash");
    }

    private static void t20() {
        for (Class<?> c : CLASSES) {
            try {
                Object a = c.getConstructor().newInstance();
                Object b = c.getConstructor().newInstance();
                check(a.equals(b), c.getSimpleName() + " defaults equal");
                eq(a.hashCode(), b.hashCode(), c.getSimpleName() + " default hashCodes");
                check(a.toString() != null, c.getSimpleName() + " toString non-null");
            } catch (ReflectiveOperationException e) {
                throw new AssertionError("cannot construct " + c.getName(), e);
            }
        }
        check(!new Warehouse().equals(wh()) && !wh().equals(new Warehouse()), "default warehouse vs populated");
        check(!new Store().equals(store()) && !store().equals(new Store()), "default store vs populated");
        check(!new Location().equals(loc()) && !loc().equals(new Location()), "default location vs populated");
        check(!new Product().equals(prod()) && !prod().equals(new Product()), "default product vs populated");
        check(!new StockItem().equals(stock()) && !stock().equals(new StockItem()), "default stock vs populated");

        StockItem nullProduct = new StockItem(10, null, 5);
        check(nullProduct.toString() != null, "null product toString");
        check(nullProduct.hashCode() == new StockItem(10, null, 5).hashCode(), "null product hash");
        check(nullProduct.equals(new StockItem(10, null, 5)), "null product equal");
        check(!nullProduct.equals(stock()) && !stock().equals(nullProduct), "null product vs populated");

        Location nullLoc = new Location(10, null, 5, null);
        check(nullLoc.equals(new Location(10, null, 5, null)), "null code and capacity equal");
        check(!nullLoc.equals(loc()) && !loc().equals(nullLoc), "null location fields vs populated");

        Warehouse nullStrings = new Warehouse(2, null, null, null);
        check(nullStrings.toString() != null, "null strings toString");
        check(!nullStrings.equals(wh()) && !wh().equals(nullStrings), "null strings vs populated");
    }

    private static void t21() {
        Product p = new Product(123456L, "SkuVal", "NameVal", "DescVal", "UnitVal");
        String ps = p.toString();
        for (String part : new String[] {"123456", "SkuVal", "NameVal", "DescVal", "UnitVal"}) {
            check(ps.contains(part), "Product toString missing " + part + ": " + ps);
        }
        Location l = new Location(234567L, "CodeVal", 345678L, 456789);
        String ls = l.toString();
        for (String part : new String[] {"234567", "CodeVal", "345678", "456789"}) {
            check(ls.contains(part), "Location toString missing " + part + ": " + ls);
        }
        Store s = new Store(567890L, "StoreVal", 678901L, null);
        s.addLocation(l);
        String ss = s.toString();
        for (String part : new String[] {"567890", "StoreVal", "678901", "CodeVal"}) {
            check(ss.contains(part), "Store toString missing " + part + ": " + ss);
        }
        Warehouse w = new Warehouse(789012L, "WhVal", "AddrVal", null);
        w.addStore(s);
        String ws = w.toString();
        for (String part : new String[] {"789012", "WhVal", "AddrVal", "StoreVal"}) {
            check(ws.contains(part), "Warehouse toString missing " + part + ": " + ws);
        }
        StockItem si = new StockItem(890123L, p, 901234);
        String sis = si.toString();
        for (String part : new String[] {"890123", "NameVal", "901234"}) {
            check(sis.contains(part), "StockItem toString missing " + part + ": " + sis);
        }
    }

    private static void t22() {
        StockItem d = new StockItem();
        check(d.getProduct() == null, "default product null");
        eq(0, d.getQuantity(), "default quantity");
        eq(0L, d.getLocationId(), "default locationId");
        d.setQuantity(-3);
        eq(-3, d.getQuantity(), "setQuantity does not validate");
        eq(-4, new StockItem(1, null, -4).getQuantity(), "all-args does not validate");
    }

    private static void t23() {
        StockItem a = stock();
        a.addQuantity(3);
        eq(8, a.getQuantity(), "5 + 3");
        a.removeQuantity(8);
        eq(0, a.getQuantity(), "8 - 8");
        a.addQuantity(1);
        eq(1, a.getQuantity(), "0 + 1");
        eq(10L, a.getLocationId(), "locationId unchanged");
        eq(prod(), a.getProduct(), "product unchanged");

        StockItem edge = new StockItem(1, null, Integer.MAX_VALUE - 1);
        edge.addQuantity(1);
        eq(Integer.MAX_VALUE, edge.getQuantity(), "MAX - 1 + 1");
    }

    private static void rejected(StockItem s, Consumer<StockItem> op, String message) {
        int q = s.getQuantity();
        long loc = s.getLocationId();
        Product p = s.getProduct();
        throwsExactly(IllegalArgumentException.class, () -> op.accept(s), message);
        eq(q, s.getQuantity(), message + " quantity unchanged");
        eq(loc, s.getLocationId(), message + " locationId unchanged");
        check(p == s.getProduct(), message + " product unchanged");
    }

    private static void t24() {
        rejected(stock(), s -> s.addQuantity(0), "addQuantity(0)");
        rejected(stock(), s -> s.addQuantity(-1), "addQuantity(-1)");
        rejected(stock(), s -> s.addQuantity(Integer.MIN_VALUE), "addQuantity(MIN_VALUE)");
        rejected(stock(), s -> s.removeQuantity(0), "removeQuantity(0)");
        rejected(stock(), s -> s.removeQuantity(-1), "removeQuantity(-1)");
        rejected(stock(), s -> s.removeQuantity(s.getQuantity() + 1), "removeQuantity(quantity + 1)");
        rejected(new StockItem(1, prod(), Integer.MAX_VALUE), s -> s.addQuantity(1), "add 1 to MAX_VALUE");
        rejected(new StockItem(1, prod(), 1), s -> s.addQuantity(Integer.MAX_VALUE), "add MAX_VALUE to 1");
    }

    private static void t25() {
        List<Store> stores = new ArrayList<>();
        Warehouse w = new Warehouse(1, "n", "a", stores);
        check(w.getStores() == stores, "getStores returns the list passed in");
        stores.add(store());
        eq(1, w.getStores().size(), "external add visible via getStores");

        List<Location> locations = new ArrayList<>();
        Store s = new Store(1, "n", 2, locations);
        check(s.getLocations() == locations, "getLocations returns the list passed in");
        locations.add(loc());
        eq(1, s.getLocations().size(), "external add visible via getLocations");
    }
}

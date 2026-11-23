package com.neversoft.vehicle;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;

/**
 * Dependency-free test harness for {@link Vehicle}. Run with plain javac and java:
 * <pre>
 * OUT=$(mktemp -d)
 * javac --release 25 -d "$OUT" src/main/java/com/neversoft/vehicle/Vehicle.java \
 *     src/test/java/com/neversoft/vehicle/VehicleTest.java
 * java -cp "$OUT" com.neversoft.vehicle.VehicleTest
 * </pre>
 * Exits non-zero if any test fails. Test ids (T-n) trace to docs/bob/1/tests.json.
 */
public class VehicleTest {

    private static final List<String> FAILURES = new ArrayList<>();
    private static int run;

    public static void main(String[] args) {
        test("T-3 Developer can load Vehicle by its fully qualified name", VehicleTest::t3);
        test("T-4 No-arg constructor plus setters", VehicleTest::t4);
        test("T-5 All-fields constructor scenario", VehicleTest::t5);
        test("T-6 Equal vehicles are equal and print all fields", VehicleTest::t6);
        test("T-7 Seven private fields with specified types", VehicleTest::t7);
        test("T-8 Plain POJO", VehicleTest::t8);
        test("T-9 No-arg constructor defaults", VehicleTest::t9);
        test("T-10 All-fields constructor assigns distinct values", VehicleTest::t10);
        test("T-11 Getters return what setters stored", VehicleTest::t11);
        test("T-12 equals contract", VehicleTest::t12);
        test("T-13 equals false when any field differs", VehicleTest::t13);
        test("T-14 Null-safe equals, hashCode, toString", VehicleTest::t14);
        test("T-15 hashCode consistent with equals", VehicleTest::t15);
        test("T-16 toString includes all fields", VehicleTest::t16);

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

    private static Vehicle baseline() {
        return new Vehicle(7, "Toyota", "Corolla", 2021, "JTDKB20U777123456", "red", 1200);
    }

    // ---- BDD scenarios ----

    // Given Vehicle.java has been compiled, When loaded by FQN, Then found, public, right package
    private static void t3() {
        try {
            Class<?> c = Class.forName("com.neversoft.vehicle.Vehicle");
            check(Modifier.isPublic(c.getModifiers()), "class must be public");
            eq("com.neversoft.vehicle", c.getPackageName(), "package");
        } catch (ClassNotFoundException e) {
            throw new AssertionError("Vehicle class not found", e);
        }
    }

    // Given a new Vehicle (no-arg), When setters are called, Then getters return the values
    private static void t4() {
        Vehicle v = new Vehicle();
        v.setId(42);
        v.setMake("Ford");
        v.setModel("Focus");
        v.setYear(2019);
        v.setVin("WF0AXXGCDA1A12345");
        v.setColor("blue");
        v.setMileage(55000);
        eq(42L, v.getId(), "id");
        eq("Ford", v.getMake(), "make");
        eq("Focus", v.getModel(), "model");
        eq(2019, v.getYear(), "year");
        eq("WF0AXXGCDA1A12345", v.getVin(), "vin");
        eq("blue", v.getColor(), "color");
        eq(55000L, v.getMileage(), "mileage");
    }

    // Given seven values, When all-fields constructor is called, Then every getter returns its value
    private static void t5() {
        Vehicle v = new Vehicle(7, "Toyota", "Corolla", 2021, "JTDKB20U777123456", "red", 1200);
        eq(7L, v.getId(), "id");
        eq("Toyota", v.getMake(), "make");
        eq("Corolla", v.getModel(), "model");
        eq(2021, v.getYear(), "year");
        eq("JTDKB20U777123456", v.getVin(), "vin");
        eq("red", v.getColor(), "color");
        eq(1200L, v.getMileage(), "mileage");
    }

    // Given two identical vehicles, When compared, Then equal with same hash; changing vin breaks equality
    private static void t6() {
        Vehicle a = baseline();
        Vehicle b = baseline();
        check(a.equals(b), "identical vehicles must be equal");
        eq(a.hashCode(), b.hashCode(), "hashCode");
        b.setVin("OTHER");
        check(!a.equals(b), "vehicles with different vin must differ");
        String s = a.toString();
        for (String part : new String[] {"7", "Toyota", "Corolla", "2021", "JTDKB20U777123456", "red", "1200"}) {
            check(s.contains(part), "toString missing " + part + ": " + s);
        }
    }

    // ---- unit tests ----

    private static void t7() {
        String[][] expected = {
            {"id", "long"}, {"make", "java.lang.String"}, {"model", "java.lang.String"},
            {"year", "int"}, {"vin", "java.lang.String"}, {"color", "java.lang.String"},
            {"mileage", "long"}
        };
        Field[] fields = Vehicle.class.getDeclaredFields();
        eq(expected.length, fields.length, "declared field count");
        for (String[] e : expected) {
            try {
                Field f = Vehicle.class.getDeclaredField(e[0]);
                eq(e[1], f.getType().getName(), "type of " + e[0]);
                check(Modifier.isPrivate(f.getModifiers()), e[0] + " must be private");
                check(!Modifier.isStatic(f.getModifiers()), e[0] + " must be an instance field");
            } catch (NoSuchFieldException ex) {
                throw new AssertionError("missing field " + e[0], ex);
            }
        }
    }

    private static void t8() {
        eq(Object.class, Vehicle.class.getSuperclass(), "superclass");
        eq(0, Vehicle.class.getInterfaces().length, "interface count");
    }

    private static void t9() {
        try {
            check(Modifier.isPublic(Vehicle.class.getConstructor().getModifiers()),
                    "no-arg constructor must be public");
        } catch (NoSuchMethodException e) {
            throw new AssertionError("public no-arg constructor missing", e);
        }
        Vehicle v = new Vehicle();
        eq(0L, v.getId(), "id");
        eq(0, v.getYear(), "year");
        eq(0L, v.getMileage(), "mileage");
        check(v.getMake() == null, "make null");
        check(v.getModel() == null, "model null");
        check(v.getVin() == null, "vin null");
        check(v.getColor() == null, "color null");
    }

    private static void t10() {
        Vehicle v = new Vehicle(1L, "make-A", "model-B", 1999, "vin-C", "color-D", 2L);
        eq(1L, v.getId(), "id");
        eq("make-A", v.getMake(), "make");
        eq("model-B", v.getModel(), "model");
        eq(1999, v.getYear(), "year");
        eq("vin-C", v.getVin(), "vin");
        eq("color-D", v.getColor(), "color");
        eq(2L, v.getMileage(), "mileage");

        // no validation: empty strings, negatives and nulls stored as given
        Vehicle odd = new Vehicle(-1L, "", null, -5, "", null, -9L);
        eq(-1L, odd.getId(), "negative id");
        eq("", odd.getMake(), "empty make");
        check(odd.getModel() == null, "null model");
        eq(-5, odd.getYear(), "negative year");
        eq("", odd.getVin(), "empty vin");
        check(odd.getColor() == null, "null color");
        eq(-9L, odd.getMileage(), "negative mileage");
    }

    private static void t11() {
        Vehicle v = baseline();

        v.setId(Long.MAX_VALUE);
        eq(Long.MAX_VALUE, v.getId(), "id max");
        v.setMileage(Long.MAX_VALUE);
        eq(Long.MAX_VALUE, v.getMileage(), "mileage max");
        v.setYear(Integer.MAX_VALUE);
        eq(Integer.MAX_VALUE, v.getYear(), "year max");
        v.setYear(0);
        eq(0, v.getYear(), "year zero");

        v.setMake(null);
        check(v.getMake() == null, "make null");
        v.setModel(null);
        check(v.getModel() == null, "model null");
        v.setVin(null);
        check(v.getVin() == null, "vin null");
        v.setColor(null);
        check(v.getColor() == null, "color null");

        // each setter touches only its own field
        Vehicle w = baseline();
        w.setMake("X");
        eq("X", w.getMake(), "make");
        eq("Corolla", w.getModel(), "model unchanged");
        eq("JTDKB20U777123456", w.getVin(), "vin unchanged");
        eq("red", w.getColor(), "color unchanged");
        eq(7L, w.getId(), "id unchanged");
        eq(2021, w.getYear(), "year unchanged");
        eq(1200L, w.getMileage(), "mileage unchanged");
        w.setModel("Y");
        eq("X", w.getMake(), "make unchanged after setModel");
        w.setColor("green");
        eq("JTDKB20U777123456", w.getVin(), "vin unchanged after setColor");
        w.setVin("V");
        eq("green", w.getColor(), "color unchanged after setVin");
    }

    @SuppressWarnings({"EqualsWithItself", "ConstantConditions"})
    private static void t12() {
        Vehicle a = baseline();
        Vehicle b = baseline();
        check(a.equals(a), "reflexive");
        check(a.equals(b) && b.equals(a), "symmetric");
        check(!a.equals(null), "not equal to null");
        check(!a.equals("Toyota"), "not equal to other type");
        check(!a.equals(new Object()), "not equal to Object");
        check(a.equals(baseline()), "equal copy");
    }

    private static void t13() {
        List<Consumer<Vehicle>> mutations = List.of(
            v -> v.setId(8),
            v -> v.setMake("Honda"),
            v -> v.setModel("Civic"),
            v -> v.setYear(2022),
            v -> v.setVin("OTHER-VIN"),
            v -> v.setColor("black"),
            v -> v.setMileage(1201));
        eq(7, mutations.size(), "mutation count");
        int i = 0;
        for (Consumer<Vehicle> m : mutations) {
            Vehicle other = baseline();
            m.accept(other);
            check(!baseline().equals(other), "mutation " + i + " not detected by equals");
            check(!other.equals(baseline()), "mutation " + i + " not detected by reverse equals");
            i++;
        }
    }

    private static void t14() {
        Vehicle a = new Vehicle();
        Vehicle b = new Vehicle();
        check(a.equals(b), "default vehicles equal");
        eq(a.hashCode(), b.hashCode(), "default hashCodes");
        check(a.toString() != null, "toString non-null");

        Vehicle populated = baseline();
        check(!a.equals(populated), "null-string vehicle differs from populated");
        check(!populated.equals(a), "populated differs from null-string vehicle");
        check(populated.toString() != null, "populated toString non-null");
    }

    private static void t15() {
        Vehicle a = baseline();
        Vehicle b = baseline();
        eq(a.hashCode(), b.hashCode(), "equal objects, equal hash");
        int first = a.hashCode();
        eq(first, a.hashCode(), "stable across calls");

        a.setColor("blue");
        a.setColor("red");
        eq(first, a.hashCode(), "hash restored after mutate and restore");
    }

    private static void t16() {
        Vehicle v = new Vehicle(123456L, "MakeVal", "ModelVal", 1987, "VinVal", "ColorVal", 987654L);
        String s = v.toString();
        for (String part : new String[] {"123456", "MakeVal", "ModelVal", "1987", "VinVal", "ColorVal", "987654"}) {
            check(s.contains(part), "toString missing " + part + ": " + s);
        }
    }
}

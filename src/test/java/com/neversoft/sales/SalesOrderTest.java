package com.neversoft.sales;

import com.neversoft.customer.Customer;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;

/**
 * Dependency-free test harness for {@link SalesOrder}, {@link SalesOrderLine} and
 * {@link Customer}. Run with plain javac and java:
 * <pre>
 * OUT=$(mktemp -d)
 * javac --release 25 -Xlint:all -Werror -d "$OUT" \
 *     src/main/java/com/neversoft/customer/Customer.java \
 *     src/main/java/com/neversoft/sales/SalesOrderLine.java \
 *     src/main/java/com/neversoft/sales/SalesOrder.java \
 *     src/test/java/com/neversoft/sales/SalesOrderTest.java
 * java -cp "$OUT" com.neversoft.sales.SalesOrderTest
 * </pre>
 * Exits non-zero if any test fails. Test ids (T-n) trace to docs/bob/4/tests.json.
 * T-1 (the compile above) and T-2 (git status shows only new files) are run as commands.
 */
public class SalesOrderTest {

    private static final List<String> FAILURES = new ArrayList<>();
    private static int run;

    public static void main(String[] args) {
        test("T-3 Associate a customer and add lines to an order", SalesOrderTest::t3);
        test("T-4 Remove a line from an order", SalesOrderTest::t4);
        test("T-5 Build all three classes with their all-fields constructors", SalesOrderTest::t5);
        test("T-6 Equal object graphs are equal; one change breaks equality", SalesOrderTest::t6);
        test("T-7 toString and hashCode on a full graph terminate", SalesOrderTest::t7);
        test("T-8 Customer structure", SalesOrderTest::t8);
        test("T-9 SalesOrderLine structure, no back-reference", SalesOrderTest::t9);
        test("T-10 SalesOrder structure", SalesOrderTest::t10);
        test("T-11 Classes are in the conventional packages", SalesOrderTest::t11);
        test("T-12 No-arg constructor defaults", SalesOrderTest::t12);
        test("T-13 Setter and getter round trip per field", SalesOrderTest::t13);
        test("T-14 equals contract", SalesOrderTest::t14);
        test("T-15 equals false when any single field differs", SalesOrderTest::t15);
        test("T-16 hashCode consistent with equals", SalesOrderTest::t16);
        test("T-17 Null-safe equals, hashCode, toString", SalesOrderTest::t17);
        test("T-18 toString contains every field value", SalesOrderTest::t18);
        test("T-19 getLines returns an unmodifiable view", SalesOrderTest::t19);
        test("T-20 addLine rejects null", SalesOrderTest::t20);
        test("T-21 setLines and constructor take a defensive copy", SalesOrderTest::t21);
        test("T-22 Lines are never null", SalesOrderTest::t22);
        test("T-23 setCustomer replaces and clears the association", SalesOrderTest::t23);
        test("T-24 removeLine semantics", SalesOrderTest::t24);
        test("T-25 BigDecimal scale sensitivity", SalesOrderTest::t25);

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

    private static void expectThrows(Class<? extends Throwable> type, Runnable body, String message) {
        try {
            body.run();
        } catch (Throwable t) {
            if (type.isInstance(t)) {
                return;
            }
            throw new AssertionError(message + ": expected " + type.getName() + " but got " + t, t);
        }
        throw new AssertionError(message + ": expected " + type.getName() + " but nothing was thrown");
    }

    private static void contains(String s, String part) {
        check(s.contains(part), "toString missing " + part + ": " + s);
    }

    // ---- fixtures ----

    private static final LocalDate DATE = LocalDate.of(2025, 3, 14);

    private static Customer customer() {
        return new Customer(11, "Acme Ltd", "orders@acme.example", "555-0100");
    }

    private static SalesOrderLine lineA() {
        return new SalesOrderLine(101, "A-1", "Widget", 3, new BigDecimal("2.50"), new BigDecimal("7.50"));
    }

    private static SalesOrderLine lineB() {
        return new SalesOrderLine(102, "B-2", "Gadget", 1, new BigDecimal("10.00"), new BigDecimal("10.00"));
    }

    private static SalesOrder order() {
        SalesOrder o = new SalesOrder(5, DATE, "NEW", customer(), null);
        o.addLine(lineA());
        o.addLine(lineB());
        return o;
    }

    // ---- reflection helpers ----

    private static Class<?> load(String name) {
        try {
            return Class.forName(name);
        } catch (ClassNotFoundException e) {
            throw new AssertionError("class not found: " + name, e);
        }
    }

    private static Method publicMethod(Class<?> c, String name, Class<?> returnType, Class<?>... params) {
        try {
            Method m = c.getMethod(name, params);
            check(Modifier.isPublic(m.getModifiers()), name + " must be public");
            eq(returnType, m.getReturnType(), "return type of " + name);
            return m;
        } catch (NoSuchMethodException e) {
            throw new AssertionError("missing method " + c.getSimpleName() + "." + name, e);
        }
    }

    private static Constructor<?> publicConstructor(Class<?> c, Class<?>... params) {
        try {
            Constructor<?> k = c.getConstructor(params);
            check(Modifier.isPublic(k.getModifiers()), "constructor must be public");
            return k;
        } catch (NoSuchMethodException e) {
            throw new AssertionError("missing constructor on " + c.getSimpleName(), e);
        }
    }

    private static String capitalise(String s) {
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    /** expected = {name, type name}; asserts exact private, non-static fields plus a getter and setter each. */
    private static void checkStructure(Class<?> c, String[][] expected) {
        check(Modifier.isPublic(c.getModifiers()), "class must be public");
        eq(Object.class, c.getSuperclass(), "superclass");
        eq(0, c.getInterfaces().length, "interface count");
        eq(expected.length, c.getDeclaredFields().length, "declared field count of " + c.getSimpleName());
        publicConstructor(c);
        for (String[] e : expected) {
            try {
                Field f = c.getDeclaredField(e[0]);
                eq(e[1], f.getGenericType().getTypeName(), "type of " + e[0]);
                check(Modifier.isPrivate(f.getModifiers()), e[0] + " must be private");
                check(!Modifier.isStatic(f.getModifiers()), e[0] + " must be an instance field");
                if (!e[0].equals("lines")) {
                    publicMethod(c, "get" + capitalise(e[0]), f.getType());
                    publicMethod(c, "set" + capitalise(e[0]), void.class, f.getType());
                }
            } catch (NoSuchFieldException ex) {
                throw new AssertionError("missing field " + e[0], ex);
            }
        }
    }

    // ---- BDD scenarios ----

    // Given a Customer, two lines and a new order, When customer is set and lines added, Then they are held in order
    private static void t3() {
        Customer c = customer();
        SalesOrderLine a = lineA();
        SalesOrderLine b = lineB();
        SalesOrder o = new SalesOrder();
        o.setId(5);
        o.setOrderDate(DATE);
        o.setStatus("NEW");
        o.setCustomer(c);
        o.addLine(a);
        o.addLine(b);
        check(o.getCustomer() == c, "customer");
        eq(List.of(a, b), o.getLines(), "lines in insertion order");
        eq(5L, o.getId(), "id");
        eq(DATE, o.getOrderDate(), "orderDate");
        eq("NEW", o.getStatus(), "status");
    }

    // Given an order with two lines, When one is removed, Then true and one remains; absent line gives false
    private static void t4() {
        SalesOrder o = order();
        eq(true, o.removeLine(lineA()), "remove present line");
        eq(List.of(lineB()), o.getLines(), "remaining line");
        eq(false, o.removeLine(new SalesOrderLine(999, "Z", "none", 1, null, null)), "remove absent line");
        eq(1, o.getLines().size(), "still one line");
    }

    // Given distinct values, When all-fields constructors are used, Then every getter returns them
    private static void t5() {
        Customer c = new Customer(1L, "name-A", "email-B", "phone-C");
        eq(1L, c.getId(), "customer id");
        eq("name-A", c.getName(), "name");
        eq("email-B", c.getEmail(), "email");
        eq("phone-C", c.getPhone(), "phone");

        SalesOrderLine l = new SalesOrderLine(2L, "code-D", "desc-E", 6, new BigDecimal("1.25"), new BigDecimal("7.50"));
        eq(2L, l.getId(), "line id");
        eq("code-D", l.getItemCode(), "itemCode");
        eq("desc-E", l.getDescription(), "description");
        eq(6, l.getQuantity(), "quantity");
        eq(new BigDecimal("1.25"), l.getUnitPrice(), "unitPrice");
        eq(new BigDecimal("7.50"), l.getLineAmount(), "lineAmount");

        List<SalesOrderLine> lines = List.of(l);
        SalesOrder o = new SalesOrder(3L, DATE, "status-F", c, lines);
        eq(3L, o.getId(), "order id");
        eq(DATE, o.getOrderDate(), "orderDate");
        eq("status-F", o.getStatus(), "status");
        check(o.getCustomer() == c, "customer");
        eq(lines, o.getLines(), "lines");
    }

    // ---- component tests ----

    private static void t6() {
        SalesOrder a = order();
        SalesOrder b = order();
        check(a.equals(b) && b.equals(a), "identical graphs equal");
        eq(a.hashCode(), b.hashCode(), "hashCode");

        List<Consumer<SalesOrder>> mutations = List.of(
            o -> o.getCustomer().setName("Other"),
            o -> o.removeLine(lineB()) ,
            o -> o.addLine(lineA()),
            o -> o.setLines(List.of(lineB(), lineA())),
            o -> o.setLines(List.of(lineA(), new SalesOrderLine(102, "B-2", "Gadget", 2,
                    new BigDecimal("10.00"), new BigDecimal("10.00")))));
        int i = 0;
        for (Consumer<SalesOrder> m : mutations) {
            SalesOrder other = order();
            m.accept(other);
            check(!order().equals(other), "graph mutation " + i + " not detected");
            i++;
        }
    }

    private static void t7() {
        SalesOrder o = order();
        String s = o.toString();
        contains(s, "Acme Ltd");
        contains(s, "A-1");
        contains(s, "B-2");
        o.hashCode();
    }

    // ---- unit tests ----

    private static void t8() {
        checkStructure(Customer.class, new String[][] {
            {"id", "long"}, {"name", "java.lang.String"}, {"email", "java.lang.String"},
            {"phone", "java.lang.String"}
        });
        publicConstructor(Customer.class, long.class, String.class, String.class, String.class);
    }

    private static void t9() {
        checkStructure(SalesOrderLine.class, new String[][] {
            {"id", "long"}, {"itemCode", "java.lang.String"}, {"description", "java.lang.String"},
            {"quantity", "int"}, {"unitPrice", "java.math.BigDecimal"}, {"lineAmount", "java.math.BigDecimal"}
        });
        publicConstructor(SalesOrderLine.class, long.class, String.class, String.class, int.class,
                BigDecimal.class, BigDecimal.class);
        for (Field f : SalesOrderLine.class.getDeclaredFields()) {
            check(f.getType() != SalesOrder.class, "field " + f.getName() + " must not reference SalesOrder");
        }
    }

    private static void t10() {
        checkStructure(SalesOrder.class, new String[][] {
            {"id", "long"}, {"orderDate", "java.time.LocalDate"}, {"status", "java.lang.String"},
            {"customer", "com.neversoft.customer.Customer"},
            {"lines", "java.util.List<com.neversoft.sales.SalesOrderLine>"}
        });
        publicConstructor(SalesOrder.class, long.class, LocalDate.class, String.class, Customer.class, List.class);
        publicMethod(SalesOrder.class, "getCustomer", Customer.class);
        publicMethod(SalesOrder.class, "setCustomer", void.class, Customer.class);
        publicMethod(SalesOrder.class, "getLines", List.class);
        publicMethod(SalesOrder.class, "setLines", void.class, List.class);
        publicMethod(SalesOrder.class, "addLine", void.class, SalesOrderLine.class);
        publicMethod(SalesOrder.class, "removeLine", boolean.class, SalesOrderLine.class);
    }

    private static void t11() {
        eq("com.neversoft.customer", load("com.neversoft.customer.Customer").getPackageName(), "Customer package");
        eq("com.neversoft.sales", load("com.neversoft.sales.SalesOrderLine").getPackageName(), "line package");
        eq("com.neversoft.sales", load("com.neversoft.sales.SalesOrder").getPackageName(), "order package");
    }

    private static void t12() {
        Customer c = new Customer();
        eq(0L, c.getId(), "customer id");
        check(c.getName() == null && c.getEmail() == null && c.getPhone() == null, "customer refs null");

        SalesOrderLine l = new SalesOrderLine();
        eq(0L, l.getId(), "line id");
        eq(0, l.getQuantity(), "quantity");
        check(l.getItemCode() == null && l.getDescription() == null, "line strings null");
        check(l.getUnitPrice() == null && l.getLineAmount() == null, "line prices null");

        SalesOrder o = new SalesOrder();
        eq(0L, o.getId(), "order id");
        check(o.getOrderDate() == null && o.getStatus() == null && o.getCustomer() == null, "order refs null");
        check(o.getLines() != null && o.getLines().isEmpty(), "lines empty and non-null");
    }

    private static void t13() {
        Customer c = new Customer();
        c.setId(Long.MAX_VALUE);
        c.setName("n");
        c.setEmail("e");
        c.setPhone("p");
        eq(Long.MAX_VALUE, c.getId(), "customer id");
        eq("n", c.getName(), "name");
        eq("e", c.getEmail(), "email");
        eq("p", c.getPhone(), "phone");
        c.setName(null);
        c.setEmail(null);
        c.setPhone(null);
        check(c.getName() == null && c.getEmail() == null && c.getPhone() == null, "customer nulls");

        SalesOrderLine l = new SalesOrderLine();
        l.setId(9);
        l.setItemCode("i");
        l.setDescription("d");
        l.setQuantity(4);
        l.setUnitPrice(new BigDecimal("3.00"));
        l.setLineAmount(new BigDecimal("99.99"));
        eq(9L, l.getId(), "line id");
        eq("i", l.getItemCode(), "itemCode");
        eq("d", l.getDescription(), "description");
        eq(4, l.getQuantity(), "quantity");
        eq(new BigDecimal("3.00"), l.getUnitPrice(), "unitPrice");
        eq(new BigDecimal("99.99"), l.getLineAmount(), "lineAmount is stored, not derived");
        l.setItemCode(null);
        l.setDescription(null);
        l.setUnitPrice(null);
        l.setLineAmount(null);
        check(l.getItemCode() == null && l.getDescription() == null, "line string nulls");
        check(l.getUnitPrice() == null && l.getLineAmount() == null, "line price nulls");

        SalesOrder o = new SalesOrder();
        Customer cust = customer();
        o.setId(8);
        o.setOrderDate(DATE);
        o.setStatus("OPEN");
        o.setCustomer(cust);
        eq(8L, o.getId(), "order id");
        eq(DATE, o.getOrderDate(), "orderDate");
        eq("OPEN", o.getStatus(), "status");
        check(o.getCustomer() == cust, "customer");
        o.setOrderDate(null);
        o.setStatus(null);
        o.setCustomer(null);
        check(o.getOrderDate() == null && o.getStatus() == null && o.getCustomer() == null, "order nulls");
    }

    private static void t14() {
        Customer c = customer();
        check(c.equals(c) && c.equals(customer()) && customer().equals(c), "customer reflexive/symmetric");
        check(!c.equals(null) && !c.equals("x") && !c.equals(new Object()), "customer vs null/other");

        SalesOrderLine l = lineA();
        check(l.equals(l) && l.equals(lineA()) && lineA().equals(l), "line reflexive/symmetric");
        check(!l.equals(null) && !l.equals("x") && !l.equals(new Object()), "line vs null/other");

        SalesOrder o = order();
        check(o.equals(o) && o.equals(order()) && order().equals(o), "order reflexive/symmetric");
        check(!o.equals(null) && !o.equals("x") && !o.equals(new Object()), "order vs null/other");
    }

    private static void t15() {
        List<Consumer<Customer>> customerMutations = List.of(
            c -> c.setId(12),
            c -> c.setName("Other"),
            c -> c.setEmail("other@example"),
            c -> c.setPhone("000"));
        eq(4, customerMutations.size(), "customer mutation count");
        int i = 0;
        for (Consumer<Customer> m : customerMutations) {
            Customer other = customer();
            m.accept(other);
            check(!customer().equals(other) && !other.equals(customer()), "customer mutation " + i);
            i++;
        }

        List<Consumer<SalesOrderLine>> lineMutations = List.of(
            l -> l.setId(1),
            l -> l.setItemCode("X"),
            l -> l.setDescription("Other"),
            l -> l.setQuantity(99),
            l -> l.setUnitPrice(new BigDecimal("9.99")),
            l -> l.setLineAmount(new BigDecimal("0.01")));
        eq(6, lineMutations.size(), "line mutation count");
        i = 0;
        for (Consumer<SalesOrderLine> m : lineMutations) {
            SalesOrderLine other = lineA();
            m.accept(other);
            check(!lineA().equals(other) && !other.equals(lineA()), "line mutation " + i);
            i++;
        }

        List<Consumer<SalesOrder>> orderMutations = List.of(
            o -> o.setId(6),
            o -> o.setOrderDate(DATE.plusDays(1)),
            o -> o.setStatus("SHIPPED"),
            o -> o.setCustomer(null),
            o -> o.setLines(List.of(lineA())));
        eq(5, orderMutations.size(), "order mutation count");
        i = 0;
        for (Consumer<SalesOrder> m : orderMutations) {
            SalesOrder other = order();
            m.accept(other);
            check(!order().equals(other) && !other.equals(order()), "order mutation " + i);
            i++;
        }
    }

    private static void t16() {
        eq(customer().hashCode(), customer().hashCode(), "customer equal hash");
        eq(lineA().hashCode(), lineA().hashCode(), "line equal hash");
        SalesOrder a = order();
        eq(a.hashCode(), order().hashCode(), "order equal hash");
        int first = a.hashCode();
        eq(first, a.hashCode(), "stable across calls");

        Customer other = customer();
        other.setName("Different");
        check(customer().hashCode() != other.hashCode(), "customer hash differs");
        SalesOrderLine otherLine = lineA();
        otherLine.setItemCode("Different");
        check(lineA().hashCode() != otherLine.hashCode(), "line hash differs");
        SalesOrder otherOrder = order();
        otherOrder.setStatus("Different");
        check(order().hashCode() != otherOrder.hashCode(), "order hash differs");
    }

    private static void t17() {
        Customer c1 = new Customer();
        Customer c2 = new Customer();
        check(c1.equals(c2), "default customers equal");
        eq(c1.hashCode(), c2.hashCode(), "default customer hash");
        check(c1.toString() != null, "customer toString");

        SalesOrderLine l1 = new SalesOrderLine();
        SalesOrderLine l2 = new SalesOrderLine();
        check(l1.equals(l2), "default lines equal");
        eq(l1.hashCode(), l2.hashCode(), "default line hash");
        check(l1.toString() != null, "line toString");

        SalesOrder o1 = new SalesOrder();
        SalesOrder o2 = new SalesOrder();
        check(o1.equals(o2), "default orders equal");
        eq(o1.hashCode(), o2.hashCode(), "default order hash");
        check(o1.toString() != null, "order toString");

        SalesOrder noCustomer = order();
        noCustomer.setCustomer(null);
        check(!noCustomer.equals(order()) && !order().equals(noCustomer), "null customer differs");
        noCustomer.hashCode();
        check(noCustomer.toString() != null, "null-customer toString");
    }

    private static void t18() {
        String cs = new Customer(123456L, "NameVal", "EmailVal", "PhoneVal").toString();
        check(cs.startsWith("Customer"), "Customer prefix: " + cs);
        for (String part : new String[] {"id=123456", "name='NameVal'", "email='EmailVal'", "phone='PhoneVal'"}) {
            contains(cs, part);
        }

        String ls = new SalesOrderLine(77L, "CodeVal", "DescVal", 42, new BigDecimal("3.10"),
                new BigDecimal("130.20")).toString();
        check(ls.startsWith("SalesOrderLine"), "SalesOrderLine prefix: " + ls);
        for (String part : new String[] {"id=77", "itemCode='CodeVal'", "description='DescVal'", "quantity=42",
                "unitPrice=3.10", "lineAmount=130.20"}) {
            contains(ls, part);
        }
        check(!ls.contains("SalesOrder{"), "line toString must not show an order: " + ls);

        String os = order().toString();
        check(os.startsWith("SalesOrder"), "SalesOrder prefix: " + os);
        for (String part : new String[] {"id=5", "orderDate=" + DATE, "status='NEW'", "customer=Customer{",
                "lines=[SalesOrderLine{"}) {
            contains(os, part);
        }
    }

    private static void t19() {
        SalesOrder o = order();
        List<SalesOrderLine> view = o.getLines();
        expectThrows(UnsupportedOperationException.class, () -> view.add(lineA()), "add on view");
        expectThrows(UnsupportedOperationException.class, () -> view.remove(0), "remove on view");
        eq(2, o.getLines().size(), "lines unchanged");
        o.addLine(new SalesOrderLine(103, "C-3", "Extra", 1, null, null));
        eq(3, view.size(), "view reflects later addLine");
    }

    private static void t20() {
        SalesOrder o = order();
        expectThrows(NullPointerException.class, () -> o.addLine(null), "addLine(null)");
        eq(2, o.getLines().size(), "lines unchanged");
    }

    private static void t21() {
        List<SalesOrderLine> source = new ArrayList<>(List.of(lineA(), lineB()));
        SalesOrder viaSetter = new SalesOrder();
        viaSetter.addLine(new SalesOrderLine(1, "OLD", "old", 1, null, null));
        viaSetter.setLines(source);
        eq(List.of(lineA(), lineB()), viaSetter.getLines(), "setLines replaces previous contents");
        source.add(new SalesOrderLine());
        eq(2, viaSetter.getLines().size(), "setLines copy unaffected by add");
        source.clear();
        eq(2, viaSetter.getLines().size(), "setLines copy unaffected by clear");

        List<SalesOrderLine> source2 = new ArrayList<>(List.of(lineA(), lineB()));
        SalesOrder viaCtor = new SalesOrder(1, DATE, "NEW", null, source2);
        source2.add(new SalesOrderLine());
        eq(2, viaCtor.getLines().size(), "constructor copy unaffected by add");
        source2.clear();
        eq(2, viaCtor.getLines().size(), "constructor copy unaffected by clear");
    }

    private static void t22() {
        SalesOrder fresh = new SalesOrder();
        check(fresh.getLines() != null && fresh.getLines().isEmpty(), "no-arg lines");
        fresh.addLine(lineA());
        eq(1, fresh.getLines().size(), "addLine after construction");

        SalesOrder viaSetter = order();
        viaSetter.setLines(null);
        check(viaSetter.getLines() != null && viaSetter.getLines().isEmpty(), "setLines(null)");

        SalesOrder viaCtor = new SalesOrder(1, DATE, "NEW", null, null);
        check(viaCtor.getLines() != null && viaCtor.getLines().isEmpty(), "constructor null lines");
        viaCtor.addLine(lineB());
        eq(1, viaCtor.getLines().size(), "addLine after null-lines construction");
    }

    private static void t23() {
        SalesOrder o = new SalesOrder();
        Customer c1 = customer();
        Customer c2 = new Customer(12, "Beta Inc", "b@example", "555-0200");
        o.setCustomer(c1);
        check(o.getCustomer() == c1, "c1");
        o.setCustomer(c2);
        check(o.getCustomer() == c2, "c2 replaces c1");
        o.setCustomer(null);
        check(o.getCustomer() == null, "cleared");
        o.setCustomer(c1);
        c1.setName("Renamed");
        eq("Renamed", o.getCustomer().getName(), "customer held by reference");
    }

    private static void t24() {
        SalesOrder empty = new SalesOrder();
        eq(false, empty.removeLine(lineA()), "empty order");
        eq(false, empty.removeLine(null), "null on empty order");

        SalesOrder o = order();
        eq(false, o.removeLine(null), "null on populated order");
        eq(2, o.getLines().size(), "unchanged after null remove");
        eq(true, o.removeLine(lineA()), "equal but separate line removed");
        eq(List.of(lineB()), o.getLines(), "remaining");

        SalesOrder dup = new SalesOrder();
        SalesOrderLine marker = new SalesOrderLine(7, "M", "mid", 1, null, null);
        dup.addLine(lineA());
        dup.addLine(marker);
        dup.addLine(lineA());
        eq(true, dup.removeLine(lineA()), "remove duplicate");
        eq(List.of(marker, lineA()), dup.getLines(), "only first equal removed, order kept");
    }

    private static void t25() {
        SalesOrderLine one = new SalesOrderLine(1, "A", "d", 1, new BigDecimal("1.0"), null);
        SalesOrderLine two = new SalesOrderLine(1, "A", "d", 1, new BigDecimal("1.00"), null);
        check(!one.equals(two), "different scale not equal");
        SalesOrderLine same = new SalesOrderLine(1, "A", "d", 1, new BigDecimal("1.0"), null);
        check(one.equals(same), "same value and scale equal");
        eq(one.hashCode(), same.hashCode(), "same value and scale hash");
    }
}

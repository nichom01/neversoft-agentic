package com.neversoft.sales;

import com.neversoft.customer.Customer;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * Plain Java object describing a sales order. It references one {@link Customer}
 * and owns a list of {@link SalesOrderLine}s. The field list is provisional and is
 * expected to change in a follow-up.
 * <p>
 * The line list is never null. {@link #getLines()} returns an unmodifiable view;
 * manage lines through {@link #addLine} and {@link #removeLine}.
 */
public class SalesOrder {

    private long id;
    private LocalDate orderDate;
    private String status;
    private Customer customer;
    private List<SalesOrderLine> lines = new ArrayList<>();

    public SalesOrder() {
    }

    public SalesOrder(long id, LocalDate orderDate, String status, Customer customer,
                      List<SalesOrderLine> lines) {
        this.id = id;
        this.orderDate = orderDate;
        this.status = status;
        this.customer = customer;
        this.lines = lines == null ? new ArrayList<>() : new ArrayList<>(lines);
    }

    public long getId() {
        return id;
    }

    public void setId(long id) {
        this.id = id;
    }

    public LocalDate getOrderDate() {
        return orderDate;
    }

    public void setOrderDate(LocalDate orderDate) {
        this.orderDate = orderDate;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Customer getCustomer() {
        return customer;
    }

    public void setCustomer(Customer customer) {
        this.customer = customer;
    }

    public List<SalesOrderLine> getLines() {
        return Collections.unmodifiableList(lines);
    }

    public void setLines(List<SalesOrderLine> lines) {
        this.lines = lines == null ? new ArrayList<>() : new ArrayList<>(lines);
    }

    public void addLine(SalesOrderLine line) {
        Objects.requireNonNull(line, "line");
        lines.add(line);
    }

    public boolean removeLine(SalesOrderLine line) {
        return lines.remove(line);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        SalesOrder other = (SalesOrder) o;
        return id == other.id
                && Objects.equals(orderDate, other.orderDate)
                && Objects.equals(status, other.status)
                && Objects.equals(customer, other.customer)
                && Objects.equals(lines, other.lines);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, orderDate, status, customer, lines);
    }

    @Override
    public String toString() {
        return "SalesOrder{id=" + id + ", orderDate=" + orderDate + ", status='" + status
                + "', customer=" + customer + ", lines=" + lines + "}";
    }
}

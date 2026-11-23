package com.neversoft.sales;

import java.math.BigDecimal;
import java.util.Objects;

/**
 * Plain Java object describing one line of a {@link SalesOrder}. It holds no
 * reference back to its order. The field list is provisional and is expected to
 * change in a follow-up.
 * <p>
 * {@code lineAmount} is a stored value, not derived from quantity and unit price.
 * {@link BigDecimal#equals(Object)} is scale-sensitive, so lines whose prices differ
 * only in scale (for example 1.0 and 1.00) are not equal.
 */
public class SalesOrderLine {

    private long id;
    private String itemCode;
    private String description;
    private int quantity;
    private BigDecimal unitPrice;
    private BigDecimal lineAmount;

    public SalesOrderLine() {
    }

    public SalesOrderLine(long id, String itemCode, String description, int quantity,
                          BigDecimal unitPrice, BigDecimal lineAmount) {
        this.id = id;
        this.itemCode = itemCode;
        this.description = description;
        this.quantity = quantity;
        this.unitPrice = unitPrice;
        this.lineAmount = lineAmount;
    }

    public long getId() {
        return id;
    }

    public void setId(long id) {
        this.id = id;
    }

    public String getItemCode() {
        return itemCode;
    }

    public void setItemCode(String itemCode) {
        this.itemCode = itemCode;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public int getQuantity() {
        return quantity;
    }

    public void setQuantity(int quantity) {
        this.quantity = quantity;
    }

    public BigDecimal getUnitPrice() {
        return unitPrice;
    }

    public void setUnitPrice(BigDecimal unitPrice) {
        this.unitPrice = unitPrice;
    }

    public BigDecimal getLineAmount() {
        return lineAmount;
    }

    public void setLineAmount(BigDecimal lineAmount) {
        this.lineAmount = lineAmount;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        SalesOrderLine other = (SalesOrderLine) o;
        return id == other.id
                && quantity == other.quantity
                && Objects.equals(itemCode, other.itemCode)
                && Objects.equals(description, other.description)
                && Objects.equals(unitPrice, other.unitPrice)
                && Objects.equals(lineAmount, other.lineAmount);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, itemCode, description, quantity, unitPrice, lineAmount);
    }

    @Override
    public String toString() {
        return "SalesOrderLine{id=" + id + ", itemCode='" + itemCode + "', description='" + description
                + "', quantity=" + quantity + ", unitPrice=" + unitPrice + ", lineAmount=" + lineAmount + "}";
    }
}

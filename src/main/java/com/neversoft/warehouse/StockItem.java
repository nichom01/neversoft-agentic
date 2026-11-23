package com.neversoft.warehouse;

import java.util.Objects;

/**
 * Plain Java object linking a location (by id) to a product and the quantity of
 * that product held there. The field list is provisional and is expected to
 * change in a follow-up.
 */
public class StockItem {

    private long locationId;
    private Product product;
    private int quantity;

    public StockItem() {
    }

    public StockItem(long locationId, Product product, int quantity) {
        this.locationId = locationId;
        this.product = product;
        this.quantity = quantity;
    }

    public long getLocationId() {
        return locationId;
    }

    public void setLocationId(long locationId) {
        this.locationId = locationId;
    }

    public Product getProduct() {
        return product;
    }

    public void setProduct(Product product) {
        this.product = product;
    }

    public int getQuantity() {
        return quantity;
    }

    public void setQuantity(int quantity) {
        this.quantity = quantity;
    }

    /**
     * Adds stock.
     *
     * @throws IllegalArgumentException if amount is not positive or the sum would
     *         exceed {@link Integer#MAX_VALUE}
     */
    public void addQuantity(int amount) {
        if (amount <= 0) {
            throw new IllegalArgumentException("amount must be positive: " + amount);
        }
        if (quantity > Integer.MAX_VALUE - amount) {
            throw new IllegalArgumentException("quantity would overflow: " + quantity + " + " + amount);
        }
        quantity += amount;
    }

    /**
     * Removes stock.
     *
     * @throws IllegalArgumentException if amount is not positive or exceeds the
     *         current quantity
     */
    public void removeQuantity(int amount) {
        if (amount <= 0) {
            throw new IllegalArgumentException("amount must be positive: " + amount);
        }
        if (amount > quantity) {
            throw new IllegalArgumentException("cannot remove " + amount + " from quantity " + quantity);
        }
        quantity -= amount;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        StockItem other = (StockItem) o;
        return locationId == other.locationId
                && quantity == other.quantity
                && Objects.equals(product, other.product);
    }

    @Override
    public int hashCode() {
        return Objects.hash(locationId, product, quantity);
    }

    @Override
    public String toString() {
        return "StockItem{locationId=" + locationId + ", product=" + product + ", quantity=" + quantity + "}";
    }
}

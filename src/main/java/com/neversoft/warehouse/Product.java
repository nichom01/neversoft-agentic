package com.neversoft.warehouse;

import java.util.Objects;

/**
 * Plain Java object describing a product that can be stocked. The field list is
 * provisional and is expected to change in a follow-up.
 */
public class Product {

    private long id;
    private String sku;
    private String name;
    private String description;
    private String unitOfMeasure;

    public Product() {
    }

    public Product(long id, String sku, String name, String description, String unitOfMeasure) {
        this.id = id;
        this.sku = sku;
        this.name = name;
        this.description = description;
        this.unitOfMeasure = unitOfMeasure;
    }

    public long getId() {
        return id;
    }

    public void setId(long id) {
        this.id = id;
    }

    public String getSku() {
        return sku;
    }

    public void setSku(String sku) {
        this.sku = sku;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getUnitOfMeasure() {
        return unitOfMeasure;
    }

    public void setUnitOfMeasure(String unitOfMeasure) {
        this.unitOfMeasure = unitOfMeasure;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        Product other = (Product) o;
        return id == other.id
                && Objects.equals(sku, other.sku)
                && Objects.equals(name, other.name)
                && Objects.equals(description, other.description)
                && Objects.equals(unitOfMeasure, other.unitOfMeasure);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, sku, name, description, unitOfMeasure);
    }

    @Override
    public String toString() {
        return "Product{id=" + id + ", sku='" + sku + "', name='" + name + "', description='" + description
                + "', unitOfMeasure='" + unitOfMeasure + "'}";
    }
}

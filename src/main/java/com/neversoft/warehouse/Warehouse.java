package com.neversoft.warehouse;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Plain Java object describing a warehouse. The field list is provisional and is
 * expected to change in a follow-up. The store list is never null.
 */
public class Warehouse {

    private long id;
    private String name;
    private String address;
    private List<Store> stores = new ArrayList<>();

    public Warehouse() {
    }

    public Warehouse(long id, String name, String address, List<Store> stores) {
        this.id = id;
        this.name = name;
        this.address = address;
        this.stores = stores == null ? new ArrayList<>() : stores;
    }

    public long getId() {
        return id;
    }

    public void setId(long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public List<Store> getStores() {
        return stores;
    }

    public void setStores(List<Store> stores) {
        this.stores = stores == null ? new ArrayList<>() : stores;
    }

    /**
     * Appends a store. Does not change the store's warehouseId.
     *
     * @throws NullPointerException if store is null
     */
    public void addStore(Store store) {
        stores.add(Objects.requireNonNull(store, "store"));
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        Warehouse other = (Warehouse) o;
        return id == other.id
                && Objects.equals(name, other.name)
                && Objects.equals(address, other.address)
                && Objects.equals(stores, other.stores);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, name, address, stores);
    }

    @Override
    public String toString() {
        return "Warehouse{id=" + id + ", name='" + name + "', address='" + address + "', stores=" + stores + "}";
    }
}

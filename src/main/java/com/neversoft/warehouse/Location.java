package com.neversoft.warehouse;

import java.util.Objects;

/**
 * Plain Java object describing a storage location within a store. The field list
 * is provisional and is expected to change in a follow-up. A null capacity means
 * no capacity has been set.
 */
public class Location {

    private long id;
    private String code;
    private long storeId;
    private Integer capacity;

    public Location() {
    }

    public Location(long id, String code, long storeId, Integer capacity) {
        this.id = id;
        this.code = code;
        this.storeId = storeId;
        this.capacity = capacity;
    }

    public long getId() {
        return id;
    }

    public void setId(long id) {
        this.id = id;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public long getStoreId() {
        return storeId;
    }

    public void setStoreId(long storeId) {
        this.storeId = storeId;
    }

    public Integer getCapacity() {
        return capacity;
    }

    public void setCapacity(Integer capacity) {
        this.capacity = capacity;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        Location other = (Location) o;
        return id == other.id
                && storeId == other.storeId
                && Objects.equals(code, other.code)
                && Objects.equals(capacity, other.capacity);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, code, storeId, capacity);
    }

    @Override
    public String toString() {
        return "Location{id=" + id + ", code='" + code + "', storeId=" + storeId + ", capacity=" + capacity + "}";
    }
}

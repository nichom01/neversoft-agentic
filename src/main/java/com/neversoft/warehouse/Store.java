package com.neversoft.warehouse;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Plain Java object describing a store within a warehouse. The field list is
 * provisional and is expected to change in a follow-up. The location list is
 * never null.
 */
public class Store {

    private long id;
    private String name;
    private long warehouseId;
    private List<Location> locations = new ArrayList<>();

    public Store() {
    }

    public Store(long id, String name, long warehouseId, List<Location> locations) {
        this.id = id;
        this.name = name;
        this.warehouseId = warehouseId;
        this.locations = locations == null ? new ArrayList<>() : locations;
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

    public long getWarehouseId() {
        return warehouseId;
    }

    public void setWarehouseId(long warehouseId) {
        this.warehouseId = warehouseId;
    }

    public List<Location> getLocations() {
        return locations;
    }

    public void setLocations(List<Location> locations) {
        this.locations = locations == null ? new ArrayList<>() : locations;
    }

    /**
     * Appends a location. Does not change the location's storeId.
     *
     * @throws NullPointerException if location is null
     */
    public void addLocation(Location location) {
        locations.add(Objects.requireNonNull(location, "location"));
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        Store other = (Store) o;
        return id == other.id
                && warehouseId == other.warehouseId
                && Objects.equals(name, other.name)
                && Objects.equals(locations, other.locations);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, name, warehouseId, locations);
    }

    @Override
    public String toString() {
        return "Store{id=" + id + ", name='" + name + "', warehouseId=" + warehouseId
                + ", locations=" + locations + "}";
    }
}

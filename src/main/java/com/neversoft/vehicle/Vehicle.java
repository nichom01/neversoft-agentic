package com.neversoft.vehicle;

import java.util.Objects;

/**
 * Plain Java object describing a vehicle. The field list is provisional and is
 * expected to change in a follow-up.
 */
public class Vehicle {

    private long id;
    private String make;
    private String model;
    private int year;
    private String vin;
    private String color;
    private long mileage;

    public Vehicle() {
    }

    public Vehicle(long id, String make, String model, int year, String vin, String color, long mileage) {
        this.id = id;
        this.make = make;
        this.model = model;
        this.year = year;
        this.vin = vin;
        this.color = color;
        this.mileage = mileage;
    }

    public long getId() {
        return id;
    }

    public void setId(long id) {
        this.id = id;
    }

    public String getMake() {
        return make;
    }

    public void setMake(String make) {
        this.make = make;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public int getYear() {
        return year;
    }

    public void setYear(int year) {
        this.year = year;
    }

    public String getVin() {
        return vin;
    }

    public void setVin(String vin) {
        this.vin = vin;
    }

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
    }

    public long getMileage() {
        return mileage;
    }

    public void setMileage(long mileage) {
        this.mileage = mileage;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        Vehicle other = (Vehicle) o;
        return id == other.id
                && year == other.year
                && mileage == other.mileage
                && Objects.equals(make, other.make)
                && Objects.equals(model, other.model)
                && Objects.equals(vin, other.vin)
                && Objects.equals(color, other.color);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, make, model, year, vin, color, mileage);
    }

    @Override
    public String toString() {
        return "Vehicle{id=" + id + ", make='" + make + "', model='" + model + "', year=" + year
                + ", vin='" + vin + "', color='" + color + "', mileage=" + mileage + "}";
    }
}

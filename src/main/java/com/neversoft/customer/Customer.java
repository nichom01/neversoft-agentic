package com.neversoft.customer;

import java.util.Objects;

/**
 * Plain Java object describing a customer. The field list is provisional and is
 * expected to change in a follow-up.
 */
public class Customer {

    private long id;
    private String name;
    private String email;
    private String phone;

    public Customer() {
    }

    public Customer(long id, String name, String email, String phone) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.phone = phone;
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

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        Customer other = (Customer) o;
        return id == other.id
                && Objects.equals(name, other.name)
                && Objects.equals(email, other.email)
                && Objects.equals(phone, other.phone);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, name, email, phone);
    }

    @Override
    public String toString() {
        return "Customer{id=" + id + ", name='" + name + "', email='" + email + "', phone='" + phone + "'}";
    }
}

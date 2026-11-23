import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "../components/Layout";
import { VehicleListPage } from "./VehicleListPage";
import { VehicleFormPage } from "./VehicleFormPage";
import type { Vehicle } from "../api";

function renderApp(initialEntry = "/") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<VehicleListPage />} />
              <Route path="/vehicles/new" element={<VehicleFormPage />} />
              <Route path="/vehicles/:id/edit" element={<VehicleFormPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

describe("UI Journeys (BDD)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // T-5: UI journey, browse, filter and page vehicles
  it("T-5: UI journey: browse, filter and page vehicles (BDD)", async () => {
    // Given the warehouse server holds 12 vehicles
    const vehicles: Vehicle[] = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      make: i < 3 ? "Ford" : `Make-${i + 1}`,
      model: `Model-${i + 1}`,
      year: 2020,
      vin: `VIN-${i + 1}`,
      color: "Blue",
      mileage: (i + 1) * 1000,
    }));

    const mockFetch = vi.fn(async (url: string) => {
      const urlObj = new URL(url, "http://localhost");
      const q = urlObj.searchParams.get("q") ?? "";
      const page = Number(urlObj.searchParams.get("page") ?? "1");
      const pageSize = Number(urlObj.searchParams.get("pageSize") ?? "10");

      let filtered = vehicles;
      if (q) {
        filtered = vehicles.filter(
          (v) =>
            v.make.toLowerCase().includes(q.toLowerCase()) ||
            v.model.toLowerCase().includes(q.toLowerCase()) ||
            v.vin.toLowerCase().includes(q.toLowerCase()) ||
            v.color.toLowerCase().includes(q.toLowerCase()),
        );
      }
      const start = (page - 1) * pageSize;
      const items = filtered.slice(start, start + pageSize);

      return new Response(
        JSON.stringify({ items, total: filtered.length, page, pageSize }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", mockFetch);

    // When the admin opens "/"
    renderApp("/");

    // Then the table shows the first 10 vehicles with columns id, make, model, year, VIN, color and mileage
    await waitFor(() => expect(screen.getByText("Model-1")).toBeDefined());
    expect(screen.getByText("Model-10")).toBeDefined();
    expect(screen.queryByText("Model-11")).toBeNull();

    // And the label reads "page 1 of 2"
    expect(screen.getByText("page 1 of 2")).toBeDefined();

    // When the admin clicks Next
    const nextBtn = screen.getByRole("button", { name: "Next" }) as HTMLButtonElement;
    fireEvent.click(nextBtn);

    // Then the second page with 2 vehicles is shown and Next is disabled
    await waitFor(() => expect(screen.getByText("Model-11")).toBeDefined());
    expect(screen.getByText("Model-12")).toBeDefined();
    expect(screen.queryByText("Model-1")).toBeNull();
    expect(nextBtn.disabled).toBe(true);

    // When the admin types "ford" in the search box
    const searchInput = screen.getByPlaceholderText("Search vehicles...");
    await userEvent.type(searchInput, "ford");

    // Then the page returns to 1 and the request carries q=ford
    await waitFor(() => expect(screen.getByText("page 1 of 1")).toBeDefined());
    expect(screen.getByText("Model-1")).toBeDefined();
    expect(screen.getByText("Model-2")).toBeDefined();
    expect(screen.getByText("Model-3")).toBeDefined();
    expect(screen.queryByText("Model-4")).toBeNull();
  });

  // T-6: UI journey, create a vehicle
  it("T-6: UI journey: create a vehicle (BDD)", async () => {
    let serverVehicles: Vehicle[] = [];

    const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST" && url === "/api/vehicles") {
        const body = JSON.parse(init.body as string);
        const created: Vehicle = { id: 101, ...body };
        serverVehicles.push(created);
        return new Response(JSON.stringify(created), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          items: serverVehicles,
          total: serverVehicles.length,
          page: 1,
          pageSize: 10,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", mockFetch);

    // Given the admin is on "/"
    renderApp("/");
    await waitFor(() => expect(screen.getByText("No vehicles found.")).toBeDefined());

    // When the admin clicks "New vehicle"
    const newBtn = screen.getByRole("link", { name: "New vehicle" });
    fireEvent.click(newBtn);

    // Then the create form is shown at /vehicles/new with empty fields
    await waitFor(() => expect(screen.getByRole("heading", { name: "New vehicle" })).toBeDefined());
    expect((screen.getByLabelText("Make") as HTMLInputElement).value).toBe("");

    // When the admin fills in all fields and submits
    await userEvent.type(screen.getByLabelText("Make"), "Ford");
    await userEvent.type(screen.getByLabelText("Model"), "Transit");
    await userEvent.type(screen.getByLabelText("Year"), "2020");
    await userEvent.type(screen.getByLabelText("VIN"), "VIN-NEW-1");
    await userEvent.type(screen.getByLabelText("Color"), "White");
    await userEvent.type(screen.getByLabelText("Mileage"), "12000");

    const submitBtn = screen.getByRole("button", { name: "Create vehicle" });
    fireEvent.click(submitBtn);

    // Then POST /api/vehicles is sent with typed values (year and mileage as numbers)
    // And the app navigates back to "/" and re-fetches
    await waitFor(() => expect(screen.getByRole("heading", { name: "Vehicles" })).toBeDefined());
    expect(screen.getByText("Ford")).toBeDefined();
    expect(screen.getByText("Transit")).toBeDefined();
    expect(screen.getByText("VIN-NEW-1")).toBeDefined();
    expect(screen.getByText("12,000")).toBeDefined();
  });

  // T-7: UI journey, edit a vehicle
  it("T-7: UI journey: edit a vehicle (BDD)", async () => {
    const vehicle7: Vehicle = {
      id: 7,
      make: "Tesla",
      model: "Model 3",
      year: 2022,
      vin: "VIN-TESLA-7",
      color: "White",
      mileage: 8000,
    };

    let currentVehicle = { ...vehicle7 };

    const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT" && url === "/api/vehicles/7") {
        const body = JSON.parse(init.body as string);
        currentVehicle = { ...currentVehicle, ...body };
        return new Response(JSON.stringify(currentVehicle), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url === "/api/vehicles/7") {
        return new Response(JSON.stringify(currentVehicle), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          items: [currentVehicle],
          total: 1,
          page: 1,
          pageSize: 10,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", mockFetch);

    // Given vehicle 7 exists, start on "/"
    renderApp("/");
    await waitFor(() => expect(screen.getByText("Tesla")).toBeDefined());

    // When admin clicks Edit on that row
    const editBtn = screen.getByRole("link", { name: "Edit" });
    fireEvent.click(editBtn);

    // Then form at /vehicles/7/edit is pre-filled with vehicle values
    await waitFor(() => expect(screen.getByRole("heading", { name: "Edit vehicle" })).toBeDefined());
    expect((screen.getByLabelText("Make") as HTMLInputElement).value).toBe("Tesla");
    expect((screen.getByLabelText("Color") as HTMLInputElement).value).toBe("White");

    // When the admin changes the color and submits
    const colorInput = screen.getByLabelText("Color");
    await userEvent.clear(colorInput);
    await userEvent.type(colorInput, "Midnight Silver");

    const submitBtn = screen.getByRole("button", { name: "Update vehicle" });
    fireEvent.click(submitBtn);

    // Then PUT /api/vehicles/7 is sent and app returns to "/" showing new color
    await waitFor(() => expect(screen.getByRole("heading", { name: "Vehicles" })).toBeDefined());
    expect(screen.getByText("Midnight Silver")).toBeDefined();
  });

  // T-8: UI journey, delete with confirmation
  it("T-8: UI journey: delete with confirmation (BDD)", async () => {
    let items: Vehicle[] = [
      { id: 1, make: "Ford", model: "Transit", year: 2020, vin: "VIN-1", color: "White", mileage: 12000 },
      { id: 2, make: "Toyota", model: "Hilux", year: 2021, vin: "VIN-2", color: "Silver", mileage: 25000 },
    ];

    const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "DELETE" && url === "/api/vehicles/1") {
        items = items.filter((v) => v.id !== 1);
        return new Response(null, { status: 204 });
      }

      return new Response(
        JSON.stringify({
          items,
          total: items.length,
          page: 1,
          pageSize: 10,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", mockFetch);

    // Given the list shows a Ford Transit with VIN "VIN-1"
    renderApp("/");
    await waitFor(() => expect(screen.getByText("Ford")).toBeDefined());
    expect(screen.getByText("VIN-1")).toBeDefined();

    // When the admin clicks Delete on that row
    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    fireEvent.click(deleteButtons[0]);

    // Then a confirmation overlay shows "Ford", "Transit" and "VIN-1" with Cancel and Confirm buttons
    expect(screen.getByText("Delete vehicle")).toBeDefined();
    expect(screen.getByText(/Ford Transit/)).toBeDefined();
    expect(screen.getByText("VIN-1")).toBeDefined();

    // And no DELETE request has been sent
    expect(mockFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/vehicles/1"),
      expect.objectContaining({ method: "DELETE" }),
    );

    // When the admin clicks Cancel
    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelBtn);

    // Then the overlay closes and the row is still listed
    expect(screen.queryByText("Delete vehicle")).toBeNull();
    expect(screen.getByText("VIN-1")).toBeDefined();

    // When the admin clicks Delete and then Confirm
    const deleteAgain = screen.getAllByRole("button", { name: "Delete" });
    fireEvent.click(deleteAgain[0]);
    const confirmBtn = screen.getByRole("button", { name: "Confirm" });
    fireEvent.click(confirmBtn);

    // Then DELETE /api/vehicles/{id} is sent and the list is re-fetched without that vehicle
    await waitFor(() => expect(screen.queryByText("Delete vehicle")).toBeNull());
    expect(screen.queryByText("VIN-1")).toBeNull();
    expect(screen.getByText("Toyota")).toBeDefined();
  });
});

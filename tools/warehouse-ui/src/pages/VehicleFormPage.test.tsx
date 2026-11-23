import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { VehicleFormPage } from "./VehicleFormPage";

function renderWithRouter(initialEntry: string) {
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
            <Route path="/vehicles/new" element={<VehicleFormPage />} />
            <Route path="/vehicles/:id/edit" element={<VehicleFormPage />} />
            <Route path="/" element={<div>Dashboard Home</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

describe("VehicleFormPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // T-15: VehicleFormPage validation and modes
  describe("T-15: VehicleFormPage validation and modes", () => {
    it("create mode shows empty fields", async () => {
      renderWithRouter("/vehicles/new");

      expect(screen.getByRole("heading", { name: "New vehicle" })).toBeDefined();
      expect((screen.getByLabelText("Make") as HTMLInputElement).value).toBe("");
      expect((screen.getByLabelText("Model") as HTMLInputElement).value).toBe("");
      expect((screen.getByLabelText("Year") as HTMLInputElement).value).toBe("");
      expect((screen.getByLabelText("VIN") as HTMLInputElement).value).toBe("");
      expect((screen.getByLabelText("Color") as HTMLInputElement).value).toBe("");
      expect((screen.getByLabelText("Mileage") as HTMLInputElement).value).toBe("");
    });

    it("edit mode loads vehicle and pre-fills fields; 404 shows ErrorBox", async () => {
      // 1. Success load
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          if (url === "/api/vehicles/7") {
            return new Response(
              JSON.stringify({
                id: 7,
                make: "Ford",
                model: "Transit",
                year: 2020,
                vin: "VIN-7",
                color: "White",
                mileage: 12000,
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          }
          return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
        }),
      );

      const { unmount } = renderWithRouter("/vehicles/7/edit");
      await waitFor(() => expect((screen.getByLabelText("Make") as HTMLInputElement).value).toBe("Ford"));
      expect((screen.getByLabelText("Model") as HTMLInputElement).value).toBe("Transit");
      expect((screen.getByLabelText("Year") as HTMLInputElement).value).toBe("2020");
      expect((screen.getByLabelText("VIN") as HTMLInputElement).value).toBe("VIN-7");
      expect((screen.getByLabelText("Color") as HTMLInputElement).value).toBe("White");
      expect((screen.getByLabelText("Mileage") as HTMLInputElement).value).toBe("12000");
      unmount();

      // 2. 404 load
      renderWithRouter("/vehicles/999/edit");
      await waitFor(() => expect(screen.getByText("Not found")).toBeDefined());
    });

    it("client-side validation blocks submit for invalid inputs", async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal("fetch", mockFetch);

      renderWithRouter("/vehicles/new");

      // Empty submission
      const submitBtn = screen.getByRole("button", { name: "Create vehicle" });
      fireEvent.click(submitBtn);

      await waitFor(() => expect(screen.getByText("Make must be between 1 and 100 characters")).toBeDefined());
      expect(mockFetch).not.toHaveBeenCalled();

      // Invalid year
      await userEvent.type(screen.getByLabelText("Make"), "Honda");
      await userEvent.type(screen.getByLabelText("Model"), "Civic");
      await userEvent.type(screen.getByLabelText("VIN"), "VIN-H1");
      await userEvent.type(screen.getByLabelText("Year"), "1800");
      await userEvent.type(screen.getByLabelText("Mileage"), "1000");

      fireEvent.click(submitBtn);
      await waitFor(() => expect(screen.getByText(/Year must be a valid integer between/)).toBeDefined());
      expect(mockFetch).not.toHaveBeenCalled();

      // Negative mileage
      await userEvent.clear(screen.getByLabelText("Year"));
      await userEvent.type(screen.getByLabelText("Year"), "2020");
      await userEvent.clear(screen.getByLabelText("Mileage"));
      await userEvent.type(screen.getByLabelText("Mileage"), "-50");

      fireEvent.click(submitBtn);
      await waitFor(() => expect(screen.getByText("Mileage must be a non-negative integer")).toBeDefined());
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("server 400 or 409 error is displayed in ErrorBox and user input is kept", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          return new Response(
            JSON.stringify({ error: "A vehicle with this VIN already exists" }),
            { status: 409, headers: { "Content-Type": "application/json" } },
          );
        }),
      );

      renderWithRouter("/vehicles/new");

      await userEvent.type(screen.getByLabelText("Make"), "Ford");
      await userEvent.type(screen.getByLabelText("Model"), "Focus");
      await userEvent.type(screen.getByLabelText("Year"), "2020");
      await userEvent.type(screen.getByLabelText("VIN"), "VIN-EXISTING");
      await userEvent.type(screen.getByLabelText("Color"), "Blue");
      await userEvent.type(screen.getByLabelText("Mileage"), "5000");

      const submitBtn = screen.getByRole("button", { name: "Create vehicle" });
      fireEvent.click(submitBtn);

      await waitFor(() =>
        expect(screen.getByText("A vehicle with this VIN already exists")).toBeDefined(),
      );

      // Verify input values are preserved
      expect((screen.getByLabelText("Make") as HTMLInputElement).value).toBe("Ford");
      expect((screen.getByLabelText("VIN") as HTMLInputElement).value).toBe("VIN-EXISTING");
    });

    it("Cancel button navigates to / and makes no request", async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal("fetch", mockFetch);

      renderWithRouter("/vehicles/new");

      const cancelBtn = screen.getByRole("button", { name: "Cancel" });
      fireEvent.click(cancelBtn);

      await waitFor(() => expect(screen.getByText("Dashboard Home")).toBeDefined());
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("submit button is disabled while pending", async () => {
      let resolvePromise: (val: Response) => void;
      const pendingPromise = new Promise<Response>((resolve) => {
        resolvePromise = resolve;
      });

      vi.stubGlobal("fetch", vi.fn(() => pendingPromise));

      renderWithRouter("/vehicles/new");

      await userEvent.type(screen.getByLabelText("Make"), "Toyota");
      await userEvent.type(screen.getByLabelText("Model"), "Corolla");
      await userEvent.type(screen.getByLabelText("Year"), "2021");
      await userEvent.type(screen.getByLabelText("VIN"), "VIN-TOYOTA");
      await userEvent.type(screen.getByLabelText("Color"), "White");
      await userEvent.type(screen.getByLabelText("Mileage"), "1000");

      const submitBtn = screen.getByRole("button", { name: "Create vehicle" }) as HTMLButtonElement;
      fireEvent.click(submitBtn);

      await waitFor(() => expect(submitBtn.disabled).toBe(true));
      expect(submitBtn.textContent).toBe("Saving...");

      resolvePromise!(
        new Response(
          JSON.stringify({
            id: 1,
            make: "Toyota",
            model: "Corolla",
            year: 2021,
            vin: "VIN-TOYOTA",
            color: "White",
            mileage: 1000,
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        ),
      );

      await waitFor(() => expect(screen.getByText("Dashboard Home")).toBeDefined());
    });
  });
});

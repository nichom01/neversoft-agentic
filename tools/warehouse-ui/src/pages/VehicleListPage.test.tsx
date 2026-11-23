import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { VehicleListPage } from "./VehicleListPage";

function renderWithProviders(ui: React.ReactElement) {
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
        <MemoryRouter>{ui}</MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

describe("VehicleListPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // T-14: VehicleListPage states
  describe("T-14: VehicleListPage states", () => {
    it("shows loading indicator while pending", async () => {
      // Pending promise
      vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));

      renderWithProviders(<VehicleListPage />);
      expect(screen.getByText("Loading vehicles...")).toBeDefined();
    });

    it("shows empty state message when list is empty", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          return new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 10 }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }),
      );

      renderWithProviders(<VehicleListPage />);
      await waitFor(() => expect(screen.getByText("No vehicles found.")).toBeDefined());
    });

    it("shows ErrorBox on failed fetch", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          return new Response(JSON.stringify({ error: "Server DB unavailable" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }),
      );

      renderWithProviders(<VehicleListPage />);
      await waitFor(() => expect(screen.getByText("Server DB unavailable")).toBeDefined());
    });

    it("handles Prev/Next button disabled states and page navigation", async () => {
      const mockFetch = vi.fn(async (url: string) => {
        const urlObj = new URL(url, "http://localhost");
        const page = Number(urlObj.searchParams.get("page") ?? "1");
        return new Response(
          JSON.stringify({
            items: [
              {
                id: page,
                make: `Make-${page}`,
                model: "Model",
                year: 2020,
                vin: `VIN-${page}`,
                color: "Red",
                mileage: 1000,
              },
            ],
            total: 20,
            page,
            pageSize: 10,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      });
      vi.stubGlobal("fetch", mockFetch);

      renderWithProviders(<VehicleListPage />);
      await waitFor(() => expect(screen.getByText("page 1 of 2")).toBeDefined());

      const prevBtn = screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement;
      const nextBtn = screen.getByRole("button", { name: "Next" }) as HTMLButtonElement;

      expect(prevBtn.disabled).toBe(true);
      expect(nextBtn.disabled).toBe(false);

      // Click next
      fireEvent.click(nextBtn);
      await waitFor(() => expect(screen.getByText("page 2 of 2")).toBeDefined());

      expect(prevBtn.disabled).toBe(false);
      expect(nextBtn.disabled).toBe(true);
    });

    it("resets page to 1 when search query changes", async () => {
      const mockFetch = vi.fn(async () => {
        return new Response(
          JSON.stringify({
            items: [
              { id: 1, make: "Ford", model: "Focus", year: 2020, vin: "V1", color: "Red", mileage: 1000 },
            ],
            total: 15,
            page: 2,
            pageSize: 10,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      });
      vi.stubGlobal("fetch", mockFetch);

      renderWithProviders(<VehicleListPage />);
      await waitFor(() => expect(screen.getByText("page 1 of 2")).toBeDefined());

      const nextBtn = screen.getByRole("button", { name: "Next" });
      fireEvent.click(nextBtn);
      await waitFor(() => expect(screen.getByText("page 2 of 2")).toBeDefined());

      const searchInput = screen.getByPlaceholderText("Search vehicles...");
      await userEvent.type(searchInput, "ford");

      await waitFor(() => expect(screen.getByText("page 1 of 2")).toBeDefined());
    });

    it("failed DELETE keeps overlay open and displays error in ErrorBox", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, init?: RequestInit) => {
          if (init?.method === "DELETE") {
            return new Response(JSON.stringify({ error: "Failed to delete: locked" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(
            JSON.stringify({
              items: [
                { id: 1, make: "Ford", model: "Focus", year: 2020, vin: "VIN-DEL", color: "Red", mileage: 1000 },
              ],
              total: 1,
              page: 1,
              pageSize: 10,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }),
      );

      renderWithProviders(<VehicleListPage />);
      await waitFor(() => expect(screen.getByText("Ford")).toBeDefined());

      // Click delete button on row
      const deleteBtn = screen.getByRole("button", { name: "Delete" });
      fireEvent.click(deleteBtn);

      // Overlay opens
      expect(screen.getByText("Delete vehicle")).toBeDefined();
      expect(screen.getByText(/Are you sure you want to delete/)).toBeDefined();

      // Click confirm in overlay
      const confirmBtn = screen.getByRole("button", { name: "Confirm" });
      fireEvent.click(confirmBtn);

      // Verify overlay is still open and error is shown
      await waitFor(() => expect(screen.getByText("Failed to delete: locked")).toBeDefined());
      expect(screen.getByText("Delete vehicle")).toBeDefined();
    });

    it("renders links for New vehicle and Edit", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          return new Response(
            JSON.stringify({
              items: [
                { id: 42, make: "Toyota", model: "Prius", year: 2021, vin: "VIN-PRIUS", color: "White", mileage: 5000 },
              ],
              total: 1,
              page: 1,
              pageSize: 10,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }),
      );

      renderWithProviders(<VehicleListPage />);
      await waitFor(() => expect(screen.getByText("Toyota")).toBeDefined());

      const newLink = screen.getByRole("link", { name: "New vehicle" });
      expect(newLink.getAttribute("href")).toBe("/vehicles/new");

      const editLink = screen.getByRole("link", { name: "Edit" });
      expect(editLink.getAttribute("href")).toBe("/vehicles/42/edit");
    });
  });
});

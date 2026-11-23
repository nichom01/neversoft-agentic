import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  api,
  useVehicles,
  useVehicle,
  useCreateVehicle,
  useUpdateVehicle,
  useDeleteVehicle,
} from "./api";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

describe("api.ts and hooks", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // T-13: UI API client and hooks contract
  describe("T-13: UI API client and hooks contract", () => {
    it("api.get/post/put/del send expected method, URL, headers and payload", async () => {
      const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "DELETE") {
          return new Response(null, { status: 204 });
        }
        return new Response(JSON.stringify({ ok: true, url, method: init?.method }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });
      vi.stubGlobal("fetch", mockFetch);

      // GET
      await api.get("/api/test-get");
      expect(mockFetch).toHaveBeenLastCalledWith("/api/test-get", {
        method: "GET",
        headers: undefined,
        body: undefined,
      });

      // POST
      await api.post("/api/test-post", { a: 1 });
      expect(mockFetch).toHaveBeenLastCalledWith("/api/test-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ a: 1 }),
      });

      // PUT
      await api.put("/api/test-put", { b: 2 });
      expect(mockFetch).toHaveBeenLastCalledWith("/api/test-put", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ b: 2 }),
      });

      // DELETE (204 response resolves without error)
      const delRes = await api.del("/api/test-del");
      expect(delRes).toBeUndefined();
      expect(mockFetch).toHaveBeenLastCalledWith("/api/test-del", {
        method: "DELETE",
        headers: undefined,
        body: undefined,
      });
    });

    it("surfaces non-2xx error JSON as Error.message and handles non-JSON gracefully", async () => {
      // JSON error
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          return new Response(JSON.stringify({ error: "Duplicate VIN" }), {
            status: 409,
            headers: { "Content-Type": "application/json" },
          });
        }),
      );
      await expect(api.get("/api/vehicles")).rejects.toThrow("Duplicate VIN");

      // Non-JSON error
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          return new Response("Bad Gateway", {
            status: 502,
            headers: { "Content-Type": "text/plain" },
          });
        }),
      );
      await expect(api.get("/api/vehicles")).rejects.toThrow("Bad Gateway");
    });

    it("useVehicles constructs relative /api URL with encoded params", async () => {
      const mockFetch = vi.fn(async () => {
        return new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 10 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });
      vi.stubGlobal("fetch", mockFetch);

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useVehicles({ q: "ford transit", page: 2, pageSize: 20 }), {
        wrapper,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/vehicles?q=ford+transit&page=2&pageSize=20",
        expect.anything(),
      );
    });

    it("useVehicle(undefined) does not fetch", async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal("fetch", mockFetch);

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useVehicle(undefined), { wrapper });

      expect(result.current.fetchStatus).toBe("idle");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("mutations invalidate ['vehicles'] query key", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, init?: RequestInit) => {
          if (init?.method === "DELETE") {
            return new Response(null, { status: 204 });
          }
          return new Response(JSON.stringify({ id: 1, make: "Ford" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }),
      );

      const { wrapper, queryClient } = createWrapper();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      // Create
      const { result: createHook } = renderHook(() => useCreateVehicle(), { wrapper });
      await createHook.current.mutateAsync({
        make: "Ford",
        model: "Focus",
        year: 2020,
        vin: "V1",
        color: "Blue",
        mileage: 100,
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["vehicles"] });

      // Update
      const { result: updateHook } = renderHook(() => useUpdateVehicle(1), { wrapper });
      await updateHook.current.mutateAsync({
        make: "Ford",
        model: "Focus",
        year: 2020,
        vin: "V1",
        color: "Red",
        mileage: 200,
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["vehicles"] });

      // Delete
      const { result: deleteHook } = renderHook(() => useDeleteVehicle(), { wrapper });
      await deleteHook.current.mutateAsync(1);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["vehicles"] });
    });
  });
});

import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";

// Mirrors tools/warehouse-server/src/types.ts
export interface Vehicle {
  id: number;
  make: string;
  model: string;
  year: number;
  vin: string;
  color: string;
  mileage: number;
}

export type VehicleInput = Omit<Vehicle, "id">;

export interface VehicleList {
  items: Vehicle[];
  total: number;
  page: number;
  pageSize: number;
}

export interface VehicleListParams {
  q?: string;
  page?: number;
  pageSize?: number;
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      msg = JSON.parse(text).error ?? text;
    } catch {
      /* plain text */
    }
    throw new Error(msg || res.statusText || "Request failed");
  }
  if (!text || res.status === 204) {
    return undefined as T;
  }
  const type = res.headers.get("content-type") ?? "";
  return (type.includes("json") ? JSON.parse(text) : text) as T;
}

export const api = {
  get: <T,>(url: string) => request<T>("GET", url),
  post: <T,>(url: string, body: unknown = {}) => request<T>("POST", url, body),
  put: <T,>(url: string, body: unknown = {}) => request<T>("PUT", url, body),
  del: (url: string) => request<void>("DELETE", url),
};

export function useVehicles(params: VehicleListParams = {}) {
  const q = params.q ?? "";
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 10;
  const queryParams = new URLSearchParams();
  if (q) queryParams.set("q", q);
  queryParams.set("page", String(page));
  queryParams.set("pageSize", String(pageSize));

  return useQuery({
    queryKey: ["vehicles", { q, page, pageSize }],
    queryFn: () => api.get<VehicleList>(`/api/vehicles?${queryParams.toString()}`),
    placeholderData: keepPreviousData,
  });
}

export function useVehicle(id: number | undefined) {
  return useQuery({
    queryKey: ["vehicles", id],
    queryFn: () => api.get<Vehicle>(`/api/vehicles/${id}`),
    enabled: id !== undefined && !Number.isNaN(id),
  });
}

export function useCreateVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: VehicleInput) => api.post<Vehicle>("/api/vehicles", input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });
}

export function useUpdateVehicle(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: VehicleInput) => api.put<Vehicle>(`/api/vehicles/${id}`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });
}

export function useDeleteVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/api/vehicles/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });
}

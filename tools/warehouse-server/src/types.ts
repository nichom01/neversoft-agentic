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

export interface VehicleQuery {
  q: string;
  page: number;
  pageSize: number;
}

export interface VehicleList {
  items: Vehicle[];
  total: number;
  page: number;
  pageSize: number;
}

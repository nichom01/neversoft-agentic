import type { VehicleInput, VehicleQuery } from "./types.js";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

const ALLOWED_FIELDS = new Set(["id", "make", "model", "year", "vin", "color", "mileage"]);
const REQUIRED_FIELDS = ["make", "model", "year", "vin", "color", "mileage"] as const;

export function parseVehicleInput(body: unknown): VehicleInput {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(400, "Request body must be an object");
  }

  const obj = body as Record<string, unknown>;

  for (const key of Object.keys(obj)) {
    if (!ALLOWED_FIELDS.has(key)) {
      throw new HttpError(400, `Unknown field: ${key}`);
    }
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in obj) || obj[field] === undefined) {
      throw new HttpError(400, `Missing required field: ${field}`);
    }
  }

  const { make, model, year, vin, color, mileage } = obj;

  if (typeof make !== "string") {
    throw new HttpError(400, "make must be a string");
  }
  const trimmedMake = make.trim();
  if (trimmedMake.length < 1 || trimmedMake.length > 100) {
    throw new HttpError(400, "make must be between 1 and 100 characters");
  }

  if (typeof model !== "string") {
    throw new HttpError(400, "model must be a string");
  }
  const trimmedModel = model.trim();
  if (trimmedModel.length < 1 || trimmedModel.length > 100) {
    throw new HttpError(400, "model must be between 1 and 100 characters");
  }

  if (typeof vin !== "string") {
    throw new HttpError(400, "vin must be a string");
  }
  const trimmedVin = vin.trim();
  if (trimmedVin.length < 1 || trimmedVin.length > 64) {
    throw new HttpError(400, "vin must be between 1 and 64 characters");
  }

  if (typeof color !== "string") {
    throw new HttpError(400, "color must be a string");
  }
  const trimmedColor = color.trim();
  if (trimmedColor.length > 50) {
    throw new HttpError(400, "color must be at most 50 characters");
  }

  if (typeof year !== "number" || !Number.isSafeInteger(year)) {
    throw new HttpError(400, "year must be a safe integer");
  }
  const maxYear = new Date().getFullYear() + 1;
  if (year < 1886 || year > maxYear) {
    throw new HttpError(400, `year must be between 1886 and ${maxYear}`);
  }

  if (typeof mileage !== "number" || !Number.isSafeInteger(mileage) || mileage < 0) {
    throw new HttpError(400, "mileage must be a safe non-negative integer");
  }

  return {
    make: trimmedMake,
    model: trimmedModel,
    year,
    vin: trimmedVin,
    color: trimmedColor,
    mileage,
  };
}

export function parseId(raw: unknown): number {
  if (typeof raw === "number") {
    if (Number.isSafeInteger(raw) && raw > 0) {
      return raw;
    }
    throw new HttpError(400, "Invalid id");
  }

  if (typeof raw === "string") {
    if (/^[1-9]\d*$/.test(raw)) {
      const n = Number(raw);
      if (Number.isSafeInteger(n) && n > 0) {
        return n;
      }
    }
  }

  throw new HttpError(400, "Invalid id");
}

export function parseVehicleQuery(query?: Record<string, unknown>): VehicleQuery {
  if (!query) {
    return { q: "", page: 1, pageSize: 10 };
  }

  let q = "";
  if (query.q !== undefined) {
    if (typeof query.q !== "string") {
      throw new HttpError(400, "Invalid query parameter");
    }
    q = query.q.trim();
    if (q.length > 100) {
      q = q.slice(0, 100);
    }
  }

  let page = 1;
  if (query.page !== undefined) {
    if (typeof query.page === "number") {
      if (!Number.isSafeInteger(query.page) || query.page < 1) {
        throw new HttpError(400, "Invalid page");
      }
      page = query.page;
    } else if (typeof query.page === "string" && /^[1-9]\d*$/.test(query.page)) {
      const n = Number(query.page);
      if (!Number.isSafeInteger(n) || n < 1) {
        throw new HttpError(400, "Invalid page");
      }
      page = n;
    } else {
      throw new HttpError(400, "Invalid page");
    }
  }

  let pageSize = 10;
  if (query.pageSize !== undefined) {
    if (typeof query.pageSize === "number") {
      if (!Number.isSafeInteger(query.pageSize) || query.pageSize < 1 || query.pageSize > 100) {
        throw new HttpError(400, "Invalid pageSize");
      }
      pageSize = query.pageSize;
    } else if (typeof query.pageSize === "string" && /^[1-9]\d*$/.test(query.pageSize)) {
      const n = Number(query.pageSize);
      if (!Number.isSafeInteger(n) || n < 1 || n > 100) {
        throw new HttpError(400, "Invalid pageSize");
      }
      pageSize = n;
    } else {
      throw new HttpError(400, "Invalid pageSize");
    }
  }

  return { q, page, pageSize };
}

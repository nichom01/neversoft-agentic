import { createRequire } from "node:module";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { Vehicle, VehicleInput, VehicleList, VehicleQuery } from "./types.js";

export class DuplicateVinError extends Error {
  constructor(message = "A vehicle with this VIN already exists") {
    super(message);
    this.name = "DuplicateVinError";
  }
}

export function likePattern(q: string): string {
  return q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function loadSqlite(): typeof import("node:sqlite") {
  const emit = process.emitWarning;
  process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
    if (String(warning).includes("SQLite is an experimental feature")) return;
    return (emit as (...a: unknown[]) => void).call(process, warning, ...rest);
  }) as typeof process.emitWarning;
  try {
    return createRequire(import.meta.url)("node:sqlite");
  } catch {
    throw new Error(`warehouse-server needs Node 22.13 or later for built-in SQLite (you have ${process.version}).`);
  } finally {
    process.emitWarning = emit;
  }
}

interface VehicleRow {
  id: number;
  make: string;
  model: string;
  year: number;
  vin: string;
  color: string;
  mileage: number;
}

export class WarehouseDb {
  private db: DatabaseSync;

  constructor(filename: string) {
    const { DatabaseSync } = loadSqlite();
    this.db = new DatabaseSync(filename);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        make TEXT NOT NULL,
        model TEXT NOT NULL,
        year INTEGER NOT NULL,
        vin TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL,
        mileage INTEGER NOT NULL CHECK (mileage >= 0)
      );
    `);
  }

  close(): void {
    this.db.close();
  }

  getVehicle(id: number): Vehicle | null {
    const row = this.db
      .prepare("SELECT id, make, model, year, vin, color, mileage FROM vehicles WHERE id = ?")
      .get(id) as unknown as VehicleRow | undefined;
    return row ? toVehicle(row) : null;
  }

  createVehicle(input: VehicleInput): Vehicle {
    try {
      const result = this.db
        .prepare("INSERT INTO vehicles (make, model, year, vin, color, mileage) VALUES (?, ?, ?, ?, ?, ?)")
        .run(input.make, input.model, input.year, input.vin, input.color, input.mileage);
      const id = Number(result.lastInsertRowid);
      return this.getVehicle(id)!;
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
        throw new DuplicateVinError();
      }
      throw err;
    }
  }

  updateVehicle(id: number, input: VehicleInput): Vehicle | null {
    if (!this.getVehicle(id)) {
      return null;
    }
    try {
      this.db
        .prepare("UPDATE vehicles SET make = ?, model = ?, year = ?, vin = ?, color = ?, mileage = ? WHERE id = ?")
        .run(input.make, input.model, input.year, input.vin, input.color, input.mileage, id);
      return this.getVehicle(id);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
        throw new DuplicateVinError();
      }
      throw err;
    }
  }

  deleteVehicle(id: number): boolean {
    const result = this.db.prepare("DELETE FROM vehicles WHERE id = ?").run(id);
    return Number(result.changes) > 0;
  }

  listVehicles(query: VehicleQuery): VehicleList {
    const { q, page, pageSize } = query;
    const hasFilter = q.trim().length > 0;
    const whereClause = hasFilter
      ? "WHERE (make LIKE ? ESCAPE '\\' OR model LIKE ? ESCAPE '\\' OR vin LIKE ? ESCAPE '\\' OR color LIKE ? ESCAPE '\\')"
      : "";
    const filterParam = hasFilter ? `%${likePattern(q)}%` : undefined;
    const filterArgs: SQLInputValue[] = hasFilter && filterParam !== undefined
      ? [filterParam, filterParam, filterParam, filterParam]
      : [];

    const countRow = this.db
      .prepare(`SELECT COUNT(*) AS total FROM vehicles ${whereClause}`)
      .get(...filterArgs) as unknown as { total: number };
    const total = Number(countRow.total);

    const offset = (page - 1) * pageSize;
    const selectArgs: SQLInputValue[] = [...filterArgs, pageSize, offset];
    const rows = this.db
      .prepare(`SELECT id, make, model, year, vin, color, mileage FROM vehicles ${whereClause} ORDER BY id LIMIT ? OFFSET ?`)
      .all(...selectArgs) as unknown as VehicleRow[];

    return {
      items: rows.map(toVehicle),
      total,
      page,
      pageSize,
    };
  }
}

function toVehicle(r: VehicleRow): Vehicle {
  return {
    id: Number(r.id),
    make: r.make,
    model: r.model,
    year: Number(r.year),
    vin: r.vin,
    color: r.color,
    mileage: Number(r.mileage),
  };
}

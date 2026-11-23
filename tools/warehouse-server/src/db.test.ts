import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { WarehouseDb, DuplicateVinError, likePattern, loadSqlite } from "./db.js";

describe("db.ts", () => {
  // T-30: loadSqlite returns a working DatabaseSync
  it("T-30: loadSqlite returns a working DatabaseSync and Node is >= 22.13", () => {
    const [major, minor] = process.versions.node.split(".").map(Number);
    assert.ok(major > 22 || (major === 22 && minor >= 13), `Node version must be >= 22.13, got ${process.version}`);

    const { DatabaseSync } = loadSqlite();
    assert.equal(typeof DatabaseSync, "function");
    const testDb = new DatabaseSync(":memory:");
    testDb.exec("CREATE TABLE test (id INT)");
    testDb.close();
  });

  // T-12: SQLite file persistence and schema match Vehicle.java
  it("T-12: SQLite file persistence and schema match Vehicle.java", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "warehouse-db-test-"));
    const dbPath = path.join(tmpDir, "test.sqlite");

    try {
      const db1 = new WarehouseDb(dbPath);
      const created = db1.createVehicle({
        make: "Toyota",
        model: "Camry",
        year: 2022,
        vin: "VIN-PERSIST-1",
        color: "Silver",
        mileage: 15000,
      });
      db1.close();

      // Reopen with new instance and verify data survived
      const db2 = new WarehouseDb(dbPath);
      const fetched = db2.getVehicle(created.id);
      assert.deepEqual(fetched, created);

      // Verify PRAGMA table_info and journal_mode
      const { DatabaseSync } = loadSqlite();
      const directDb = new DatabaseSync(dbPath);

      const journalMode = directDb.prepare("PRAGMA journal_mode").get() as { journal_mode: string };
      assert.equal(journalMode.journal_mode.toLowerCase(), "wal");

      const columns = directDb.prepare("PRAGMA table_info(vehicles)").all() as Array<{
        cid: number;
        name: string;
        type: string;
        notnull: number;
        dflt_value: unknown;
        pk: number;
      }>;

      const expectedColumnNames = ["id", "make", "model", "year", "vin", "color", "mileage"];
      assert.deepEqual(
        columns.map((c) => c.name),
        expectedColumnNames,
      );

      const idCol = columns.find((c) => c.name === "id");
      assert.equal(idCol?.pk, 1);

      // Verify vin is UNIQUE via index_list / index_info
      const indices = directDb.prepare("PRAGMA index_list(vehicles)").all() as Array<{
        name: string;
        unique: number;
      }>;
      const uniqueIndices = indices.filter((idx) => idx.unique === 1);
      assert.ok(uniqueIndices.length >= 1, "Must have a unique index on vin");

      directDb.close();
      db2.close();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // T-22: WarehouseDb create, get, update, delete round trip stores values unchanged
  it("T-22: WarehouseDb create, get, update, delete round trip stores values unchanged", () => {
    const db = new WarehouseDb(":memory:");
    const input = {
      make: "Ford",
      model: "Mustang",
      year: 2020,
      vin: "VIN-MUSTANG-1",
      color: "Red",
      mileage: 12000,
    };

    const created = db.createVehicle(input);
    assert.equal(typeof created.id, "number");
    assert.ok(created.id > 0);
    assert.equal(created.make, input.make);
    assert.equal(created.model, input.model);
    assert.equal(created.year, input.year);
    assert.equal(created.vin, input.vin);
    assert.equal(created.color, input.color);
    assert.equal(created.mileage, input.mileage);

    const fetched = db.getVehicle(created.id);
    assert.deepEqual(fetched, created);

    const updateInput = {
      make: "Ford",
      model: "Mustang GT",
      year: 2021,
      vin: "VIN-MUSTANG-1",
      color: "Black",
      mileage: 18000,
    };
    const updated = db.updateVehicle(created.id, updateInput);
    assert.deepEqual(updated, { id: created.id, ...updateInput });

    const deleted = db.deleteVehicle(created.id);
    assert.equal(deleted, true);
    assert.equal(db.getVehicle(created.id), null);

    // AUTOINCREMENT: next id is not reused
    const nextCreated = db.createVehicle(input);
    assert.ok(nextCreated.id > created.id);
  });

  // T-23: WarehouseDb filter matches make, model, vin and color
  it("T-23: WarehouseDb filter matches make, model, vin and color", () => {
    const db = new WarehouseDb(":memory:");
    db.createVehicle({ make: "SpecialMake", model: "CarA", year: 2020, vin: "VIN1", color: "Blue", mileage: 100 });
    db.createVehicle({ make: "OtherMake", model: "SpecialModel", year: 2020, vin: "VIN2", color: "Blue", mileage: 100 });
    db.createVehicle({ make: "OtherMake", model: "CarB", year: 2020, vin: "SpecialVIN", color: "Blue", mileage: 100 });
    db.createVehicle({ make: "OtherMake", model: "CarC", year: 2020, vin: "VIN4", color: "SpecialColor", mileage: 100 });
    db.createVehicle({ make: "Unrelated", model: "Plain", year: 2020, vin: "VIN5", color: "Green", mileage: 100 });

    const result = db.listVehicles({ q: "special", page: 1, pageSize: 10 });
    assert.equal(result.total, 4);
    assert.equal(result.items.length, 4);
    assert.ok(result.items.some((v) => v.make === "SpecialMake"));
    assert.ok(result.items.some((v) => v.model === "SpecialModel"));
    assert.ok(result.items.some((v) => v.vin === "SpecialVIN"));
    assert.ok(result.items.some((v) => v.color === "SpecialColor"));
  });

  // T-24: WarehouseDb pagination arithmetic and ordering
  it("T-24: WarehouseDb pagination arithmetic and ordering", () => {
    const db = new WarehouseDb(":memory:");
    for (let i = 1; i <= 25; i++) {
      db.createVehicle({
        make: `Make${i}`,
        model: `Model${i}`,
        year: 2000 + i,
        vin: `VIN-${i.toString().padStart(3, "0")}`,
        color: "White",
        mileage: i * 1000,
      });
    }

    const page1 = db.listVehicles({ q: "", page: 1, pageSize: 10 });
    assert.equal(page1.total, 25);
    assert.equal(page1.items.length, 10);
    assert.equal(page1.items[0].id, 1);
    assert.equal(page1.items[9].id, 10);

    const page2 = db.listVehicles({ q: "", page: 2, pageSize: 10 });
    assert.equal(page2.total, 25);
    assert.equal(page2.items.length, 10);
    assert.equal(page2.items[0].id, 11);
    assert.equal(page2.items[9].id, 20);

    const page3 = db.listVehicles({ q: "", page: 3, pageSize: 10 });
    assert.equal(page3.total, 25);
    assert.equal(page3.items.length, 5);
    assert.equal(page3.items[0].id, 21);
    assert.equal(page3.items[4].id, 25);

    const page4 = db.listVehicles({ q: "", page: 4, pageSize: 10 });
    assert.equal(page4.total, 25);
    assert.equal(page4.items.length, 0);
  });

  // T-25: likePattern and LIKE wildcards are treated literally
  it("T-25: likePattern and LIKE wildcards are treated literally", () => {
    assert.equal(likePattern("50%"), "50\\%");
    assert.equal(likePattern("a_b"), "a\\_b");
    assert.equal(likePattern("a\\b"), "a\\\\b");

    const db = new WarehouseDb(":memory:");
    db.createVehicle({ make: "100% Ford", model: "F150", year: 2020, vin: "VIN-PERCENT", color: "Blue", mileage: 100 });
    db.createVehicle({ make: "Ford", model: "Focus", year: 2020, vin: "VIN-NORMAL", color: "Red", mileage: 100 });

    const percentResult = db.listVehicles({ q: "%", page: 1, pageSize: 10 });
    assert.equal(percentResult.total, 1);
    assert.equal(percentResult.items[0].make, "100% Ford");

    const underscoreResult = db.listVehicles({ q: "_", page: 1, pageSize: 10 });
    assert.equal(underscoreResult.total, 0);
  });

  // T-26: Duplicate VIN is rejected on create and update
  it("T-26: Duplicate VIN is rejected on create and update", () => {
    const db = new WarehouseDb(":memory:");
    const v1 = db.createVehicle({ make: "Ford", model: "F150", year: 2020, vin: "VIN-DUP", color: "Blue", mileage: 100 });
    const v2 = db.createVehicle({ make: "Chevy", model: "Silverado", year: 2020, vin: "VIN-OTHER", color: "Red", mileage: 100 });

    // Create duplicate
    assert.throws(
      () => db.createVehicle({ make: "Toyota", model: "Tundra", year: 2020, vin: "VIN-DUP", color: "Black", mileage: 100 }),
      DuplicateVinError,
    );

    // Update v2 to duplicate v1 VIN
    assert.throws(
      () => db.updateVehicle(v2.id, { make: "Chevy", model: "Silverado", year: 2020, vin: "VIN-DUP", color: "Red", mileage: 100 }),
      DuplicateVinError,
    );

    // Update v1 keeping own VIN succeeds
    const updated = db.updateVehicle(v1.id, { make: "Ford", model: "F150", year: 2021, vin: "VIN-DUP", color: "Green", mileage: 200 });
    assert.equal(updated?.color, "Green");
  });

  // T-27: Missing-row behaviour
  it("T-27: Missing-row behaviour returns null/false and does not throw", () => {
    const db = new WarehouseDb(":memory:");
    assert.equal(db.getVehicle(999), null);
    assert.equal(
      db.updateVehicle(999, { make: "Ford", model: "Focus", year: 2020, vin: "VIN-999", color: "White", mileage: 100 }),
      null,
    );
    assert.equal(db.deleteVehicle(999), false);
  });

  // T-28: SQL metacharacters in input are stored and searched literally
  it("T-28: SQL metacharacters in input are stored and searched literally", () => {
    const db = new WarehouseDb(":memory:");
    const injectionMake = "Robert'); DROP TABLE vehicles;--";
    const v1 = db.createVehicle({ make: injectionMake, model: "Injected", year: 2020, vin: "VIN-SQLI", color: "Black", mileage: 10 });
    const v2 = db.createVehicle({ make: "Safe", model: "SafeCar", year: 2020, vin: "VIN-SAFE", color: "White", mileage: 20 });

    const fetched = db.getVehicle(v1.id);
    assert.equal(fetched?.make, injectionMake);

    const search = db.listVehicles({ q: "DROP TABLE", page: 1, pageSize: 10 });
    assert.equal(search.total, 1);
    assert.equal(search.items[0].make, injectionMake);

    // Verify other rows still exist
    assert.equal(db.getVehicle(v2.id)?.make, "Safe");
  });

  // T-29: Mileage CHECK constraint at DB level
  it("T-29: Mileage CHECK constraint at DB level throws and is not DuplicateVinError", () => {
    const db = new WarehouseDb(":memory:");
    assert.throws(
      () => db.createVehicle({ make: "Ford", model: "Focus", year: 2020, vin: "VIN-NEG", color: "White", mileage: -1 }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(!(err instanceof DuplicateVinError));
        assert.ok(err.message.includes("CHECK constraint failed"));
        return true;
      },
    );
    assert.equal(db.listVehicles({ q: "", page: 1, pageSize: 10 }).total, 0);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { WarehouseDb } from "./db.js";
import { buildApp } from "./app.js";

describe("app.ts", () => {
  // T-3: API journey: create, read, update, delete a vehicle
  it("T-3: API journey: create, read, update, delete a vehicle (BDD)", async () => {
    // Given an empty warehouse database
    const db = new WarehouseDb(":memory:");
    const app = await buildApp(db);

    // When a client POSTs a valid vehicle
    const postRes = await app.inject({
      method: "POST",
      url: "/api/vehicles",
      payload: {
        make: "Ford",
        model: "Transit",
        year: 2020,
        vin: "VIN-1",
        color: "White",
        mileage: 12000,
      },
    });

    // Then the response is 201 and contains a generated id plus the submitted fields
    assert.equal(postRes.statusCode, 201);
    const created = JSON.parse(postRes.payload);
    assert.equal(typeof created.id, "number");
    assert.equal(created.make, "Ford");
    assert.equal(created.model, "Transit");
    assert.equal(created.year, 2020);
    assert.equal(created.vin, "VIN-1");
    assert.equal(created.color, "White");
    assert.equal(created.mileage, 12000);

    // When the client GETs /api/vehicles/{id}
    const getRes = await app.inject({
      method: "GET",
      url: `/api/vehicles/${created.id}`,
    });

    // Then the response is 200 with the same vehicle
    assert.equal(getRes.statusCode, 200);
    const fetched = JSON.parse(getRes.payload);
    assert.deepEqual(fetched, created);

    // When the client PUTs the same id with mileage 15000
    const putRes = await app.inject({
      method: "PUT",
      url: `/api/vehicles/${created.id}`,
      payload: {
        make: "Ford",
        model: "Transit",
        year: 2020,
        vin: "VIN-1",
        color: "White",
        mileage: 15000,
      },
    });

    // Then the response is 200 and mileage is 15000
    assert.equal(putRes.statusCode, 200);
    const updated = JSON.parse(putRes.payload);
    assert.equal(updated.mileage, 15000);

    // When the client DELETEs the id
    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/api/vehicles/${created.id}`,
    });

    // Then the response is 204
    assert.equal(deleteRes.statusCode, 204);
    assert.equal(deleteRes.payload, "");

    // And a following GET of that id returns 404 {"error": ...}
    const getAfterDelete = await app.inject({
      method: "GET",
      url: `/api/vehicles/${created.id}`,
    });
    assert.equal(getAfterDelete.statusCode, 404);
    assert.ok(JSON.parse(getAfterDelete.payload).error);
  });

  // T-4: API journey: filter and page the list
  it("T-4: API journey: filter and page the list (BDD)", async () => {
    // Given vehicles Ford Transit, Ford Focus and Toyota Hilux exist
    const db = new WarehouseDb(":memory:");
    const app = await buildApp(db);

    const v1 = db.createVehicle({ make: "Ford", model: "Transit", year: 2020, vin: "VIN-1", color: "White", mileage: 10000 });
    const v2 = db.createVehicle({ make: "Ford", model: "Focus", year: 2019, vin: "VIN-2", color: "Blue", mileage: 20000 });
    const v3 = db.createVehicle({ make: "Toyota", model: "Hilux", year: 2021, vin: "VIN-3", color: "Silver", mileage: 30000 });

    // When a client GETs /api/vehicles?q=ford
    const searchRes = await app.inject({
      method: "GET",
      url: "/api/vehicles?q=ford",
    });

    // Then total is 2 and items contain only the two Fords
    assert.equal(searchRes.statusCode, 200);
    const searchBody = JSON.parse(searchRes.payload);
    assert.equal(searchBody.total, 2);
    assert.equal(searchBody.items.length, 2);
    assert.ok(searchBody.items.every((v: { make: string }) => v.make === "Ford"));

    // When a client GETs /api/vehicles?pageSize=1&page=2
    const pageRes = await app.inject({
      method: "GET",
      url: "/api/vehicles?pageSize=1&page=2",
    });

    // Then items has exactly one vehicle, total is 3, page is 2 and pageSize is 1
    assert.equal(pageRes.statusCode, 200);
    const pageBody = JSON.parse(pageRes.payload);
    assert.equal(pageBody.total, 3);
    assert.equal(pageBody.page, 2);
    assert.equal(pageBody.pageSize, 1);
    assert.equal(pageBody.items.length, 1);
    assert.equal(pageBody.items[0].id, v2.id);

    // When a client edits one vehicle and deletes another
    await app.inject({
      method: "PUT",
      url: `/api/vehicles/${v1.id}`,
      payload: { make: "Ford", model: "Transit Custom", year: 2020, vin: "VIN-1", color: "Black", mileage: 11000 },
    });
    await app.inject({
      method: "DELETE",
      url: `/api/vehicles/${v3.id}`,
    });

    // Then the list and total reflect each step
    const listFinal = await app.inject({
      method: "GET",
      url: "/api/vehicles",
    });
    const finalBody = JSON.parse(listFinal.payload);
    assert.equal(finalBody.total, 2);
    assert.equal(finalBody.items.length, 2);
    const updatedV1 = finalBody.items.find((v: { id: number }) => v.id === v1.id);
    assert.equal(updatedV1.model, "Transit Custom");
    assert.equal(updatedV1.color, "Black");
    assert.ok(!finalBody.items.some((v: { id: number }) => v.id === v3.id));
  });

  // T-10: HTTP contract: status code matrix for all five endpoints
  it("T-10: HTTP contract: status code matrix for all five endpoints", async () => {
    const db = new WarehouseDb(":memory:");
    const app = await buildApp(db);

    const validPayload = {
      make: "Honda",
      model: "Civic",
      year: 2020,
      vin: "VIN-CIVIC-1",
      color: "Blue",
      mileage: 5000,
    };

    // GET /api/vehicles -> 200 VehicleList
    const listRes = await app.inject({ method: "GET", url: "/api/vehicles" });
    assert.equal(listRes.statusCode, 200);

    // POST valid -> 201
    const postRes = await app.inject({ method: "POST", url: "/api/vehicles", payload: validPayload });
    assert.equal(postRes.statusCode, 201);
    const createdId = JSON.parse(postRes.payload).id;

    // GET /api/vehicles/:id existing -> 200
    const getRes = await app.inject({ method: "GET", url: `/api/vehicles/${createdId}` });
    assert.equal(getRes.statusCode, 200);

    // GET /api/vehicles/:id missing -> 404
    const getMissing = await app.inject({ method: "GET", url: "/api/vehicles/999" });
    assert.equal(getMissing.statusCode, 404);
    assert.ok(JSON.parse(getMissing.payload).error);

    // GET /api/vehicles/abc -> 400
    const getBadId = await app.inject({ method: "GET", url: "/api/vehicles/abc" });
    assert.equal(getBadId.statusCode, 400);
    assert.equal(JSON.parse(getBadId.payload).error, "Invalid id");

    // POST invalid body -> 400
    const postBad = await app.inject({ method: "POST", url: "/api/vehicles", payload: { make: "" } });
    assert.equal(postBad.statusCode, 400);

    // POST duplicate VIN -> 409
    const postDup = await app.inject({ method: "POST", url: "/api/vehicles", payload: validPayload });
    assert.equal(postDup.statusCode, 409);
    assert.equal(JSON.parse(postDup.payload).error, "A vehicle with this VIN already exists");

    // PUT valid -> 200
    const putRes = await app.inject({
      method: "PUT",
      url: `/api/vehicles/${createdId}`,
      payload: { ...validPayload, mileage: 6000 },
    });
    assert.equal(putRes.statusCode, 200);

    // PUT missing id -> 404
    const putMissing = await app.inject({
      method: "PUT",
      url: "/api/vehicles/999",
      payload: { ...validPayload, vin: "VIN-CIVIC-2" },
    });
    assert.equal(putMissing.statusCode, 404);

    // Create second vehicle for duplicate check on PUT
    const post2 = await app.inject({
      method: "POST",
      url: "/api/vehicles",
      payload: { ...validPayload, vin: "VIN-CIVIC-2" },
    });
    const secondId = JSON.parse(post2.payload).id;

    // PUT duplicate VIN of another row -> 409
    const putDup = await app.inject({
      method: "PUT",
      url: `/api/vehicles/${secondId}`,
      payload: { ...validPayload, vin: "VIN-CIVIC-1" },
    });
    assert.equal(putDup.statusCode, 409);
    assert.equal(JSON.parse(putDup.payload).error, "A vehicle with this VIN already exists");

    // DELETE existing -> 204
    const delRes = await app.inject({ method: "DELETE", url: `/api/vehicles/${createdId}` });
    assert.equal(delRes.statusCode, 204);
    assert.equal(delRes.payload, "");

    // DELETE missing -> 404
    const delMissing = await app.inject({ method: "DELETE", url: `/api/vehicles/${createdId}` });
    assert.equal(delMissing.statusCode, 404);

    // DELETE /api/vehicles/-1 -> 400
    const delBad = await app.inject({ method: "DELETE", url: "/api/vehicles/-1" });
    assert.equal(delBad.statusCode, 400);
  });

  // T-11: Error handling and static and SPA fallback
  it("T-11: Error handling and static and SPA fallback", async () => {
    // 1. Throwing DB stub gives 500 with generic error and no SQL/stack leakage
    const throwingDb = {
      listVehicles() {
        throw new Error("SELECT * FROM vehicles secret at /server/src/db.ts:42");
      },
      getVehicle() { return null; },
      createVehicle() { throw new Error("INSERT secret"); },
      updateVehicle() { return null; },
      deleteVehicle() { return false; },
      close() {},
    } as unknown as WarehouseDb;

    const errorApp = await buildApp(throwingDb);
    const errRes = await errorApp.inject({ method: "GET", url: "/api/vehicles" });
    assert.equal(errRes.statusCode, 500);
    const errBody = JSON.parse(errRes.payload);
    assert.equal(errBody.error, "Internal server error");
    assert.ok(!errRes.payload.includes("SELECT"));
    assert.ok(!errRes.payload.includes("vehicles"));
    assert.ok(!errRes.payload.includes("at "));

    // 2. Malformed JSON body gives 400 Bad request
    const normalDb = new WarehouseDb(":memory:");
    const app = await buildApp(normalDb);
    const malformedRes = await app.inject({
      method: "POST",
      url: "/api/vehicles",
      headers: { "Content-Type": "application/json" },
      payload: "not json {",
    });
    assert.equal(malformedRes.statusCode, 400);
    assert.equal(JSON.parse(malformedRes.payload).error, "Bad request");

    // 3. GET /api/nope gives 404 Not found
    const notFoundApi = await app.inject({ method: "GET", url: "/api/nope" });
    assert.equal(notFoundApi.statusCode, 404);
    assert.equal(JSON.parse(notFoundApi.payload).error, "Not found");

    // 4. With webDist pointing to a temp dir holding index.html, SPA fallback works
    const tmpDist = fs.mkdtempSync(path.join(os.tmpdir(), "warehouse-webdist-"));
    fs.writeFileSync(path.join(tmpDist, "index.html"), "<html><body>Warehouse admin</body></html>");
    try {
      const spaApp = await buildApp(normalDb, { webDist: tmpDist });
      const rootRes = await spaApp.inject({ method: "GET", url: "/" });
      assert.equal(rootRes.statusCode, 200);
      assert.ok(rootRes.payload.includes("Warehouse admin"));

      const spaRes = await spaApp.inject({ method: "GET", url: "/vehicles/new" });
      assert.equal(spaRes.statusCode, 200);
      assert.ok(spaRes.payload.includes("Warehouse admin"));

      const spaApiNotFound = await spaApp.inject({ method: "GET", url: "/api/nonexistent" });
      assert.equal(spaApiNotFound.statusCode, 404);
      assert.equal(JSON.parse(spaApiNotFound.payload).error, "Not found");
    } finally {
      fs.rmSync(tmpDist, { recursive: true, force: true });
    }

    // 5. Without webDist, the app still builds
    const noDistApp = await buildApp(normalDb);
    assert.ok(noDistApp);
  });
});

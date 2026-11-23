import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HttpError, parseId, parseVehicleInput, parseVehicleQuery } from "./validate.js";

describe("validate.ts", () => {
  // T-16: parseVehicleInput accepts valid input, trims and ignores client id
  it("T-16: parseVehicleInput accepts valid input, trims and ignores client id", () => {
    const input = {
      id: 999,
      make: "  Ford  ",
      model: "  Focus  ",
      year: 2020,
      vin: "  1FA6P8CF5H5100001  ",
      color: "  Blue  ",
      mileage: 15000,
    };
    const parsed = parseVehicleInput(input);
    assert.deepEqual(parsed, {
      make: "Ford",
      model: "Focus",
      year: 2020,
      vin: "1FA6P8CF5H5100001",
      color: "Blue",
      mileage: 15000,
    });
    assert.equal("id" in parsed, false);
  });

  // T-17: parseVehicleInput string length boundaries
  describe("T-17: parseVehicleInput string length boundaries", () => {
    const validBase = {
      make: "Toyota",
      model: "Corolla",
      year: 2021,
      vin: "1234567890ABCDEFG",
      color: "Silver",
      mileage: 5000,
    };

    it("make: 1 and 100 characters pass, 0, 101 and whitespace-only fail", () => {
      assert.equal(parseVehicleInput({ ...validBase, make: "A" }).make, "A");
      assert.equal(parseVehicleInput({ ...validBase, make: "A".repeat(100) }).make, "A".repeat(100));

      assert.throws(() => parseVehicleInput({ ...validBase, make: "" }), (err: unknown) => err instanceof HttpError && err.status === 400);
      assert.throws(() => parseVehicleInput({ ...validBase, make: "   " }), (err: unknown) => err instanceof HttpError && err.status === 400);
      assert.throws(() => parseVehicleInput({ ...validBase, make: "A".repeat(101) }), (err: unknown) => err instanceof HttpError && err.status === 400);
      assert.throws(() => parseVehicleInput({ ...validBase, make: 123 as unknown as string }), (err: unknown) => err instanceof HttpError && err.status === 400);
    });

    it("model: 1 and 100 characters pass, 0, 101 and whitespace-only fail", () => {
      assert.equal(parseVehicleInput({ ...validBase, model: "B" }).model, "B");
      assert.equal(parseVehicleInput({ ...validBase, model: "B".repeat(100) }).model, "B".repeat(100));

      assert.throws(() => parseVehicleInput({ ...validBase, model: "" }), (err: unknown) => err instanceof HttpError && err.status === 400);
      assert.throws(() => parseVehicleInput({ ...validBase, model: "   " }), (err: unknown) => err instanceof HttpError && err.status === 400);
      assert.throws(() => parseVehicleInput({ ...validBase, model: "B".repeat(101) }), (err: unknown) => err instanceof HttpError && err.status === 400);
      assert.throws(() => parseVehicleInput({ ...validBase, model: null as unknown as string }), (err: unknown) => err instanceof HttpError && err.status === 400);
    });

    it("vin: 1 and 64 characters pass, 65 fails, non-string fails", () => {
      assert.equal(parseVehicleInput({ ...validBase, vin: "V" }).vin, "V");
      assert.equal(parseVehicleInput({ ...validBase, vin: "V".repeat(64) }).vin, "V".repeat(64));

      assert.throws(() => parseVehicleInput({ ...validBase, vin: "" }), (err: unknown) => err instanceof HttpError && err.status === 400);
      assert.throws(() => parseVehicleInput({ ...validBase, vin: "   " }), (err: unknown) => err instanceof HttpError && err.status === 400);
      assert.throws(() => parseVehicleInput({ ...validBase, vin: "V".repeat(65) }), (err: unknown) => err instanceof HttpError && err.status === 400);
      assert.throws(() => parseVehicleInput({ ...validBase, vin: 12345 as unknown as string }), (err: unknown) => err instanceof HttpError && err.status === 400);
    });

    it("color: 0 and 50 characters pass, 51 fails, non-string fails", () => {
      assert.equal(parseVehicleInput({ ...validBase, color: "" }).color, "");
      assert.equal(parseVehicleInput({ ...validBase, color: "C".repeat(50) }).color, "C".repeat(50));

      assert.throws(() => parseVehicleInput({ ...validBase, color: "C".repeat(51) }), (err: unknown) => err instanceof HttpError && err.status === 400);
      assert.throws(() => parseVehicleInput({ ...validBase, color: true as unknown as string }), (err: unknown) => err instanceof HttpError && err.status === 400);
    });
  });

  // T-18: parseVehicleInput year and mileage rules
  describe("T-18: parseVehicleInput year and mileage rules", () => {
    const validBase = {
      make: "Toyota",
      model: "Corolla",
      year: 2021,
      vin: "1234567890ABCDEFG",
      color: "Silver",
      mileage: 5000,
    };
    const maxYear = new Date().getFullYear() + 1;

    it("year: 1886 and currentYear + 1 pass; 1885, currentYear + 2, floats and strings fail", () => {
      assert.equal(parseVehicleInput({ ...validBase, year: 1886 }).year, 1886);
      assert.equal(parseVehicleInput({ ...validBase, year: maxYear }).year, maxYear);

      assert.throws(() => parseVehicleInput({ ...validBase, year: 1885 }), (err: unknown) => err instanceof HttpError && err.status === 400);
      assert.throws(() => parseVehicleInput({ ...validBase, year: maxYear + 1 }), (err: unknown) => err instanceof HttpError && err.status === 400);
      assert.throws(() => parseVehicleInput({ ...validBase, year: 2020.5 }), (err: unknown) => err instanceof HttpError && err.status === 400);
      assert.throws(() => parseVehicleInput({ ...validBase, year: "2020" as unknown as number }), (err: unknown) => err instanceof HttpError && err.status === 400);
      assert.throws(() => parseVehicleInput({ ...validBase, year: NaN }), (err: unknown) => err instanceof HttpError && err.status === 400);
      assert.throws(() => parseVehicleInput({ ...validBase, year: Infinity }), (err: unknown) => err instanceof HttpError && err.status === 400);
    });

    it("mileage: 0 and MAX_SAFE_INTEGER pass; negative, float, unsafe int, string fail", () => {
      assert.equal(parseVehicleInput({ ...validBase, mileage: 0 }).mileage, 0);
      assert.equal(parseVehicleInput({ ...validBase, mileage: Number.MAX_SAFE_INTEGER }).mileage, Number.MAX_SAFE_INTEGER);

      assert.throws(() => parseVehicleInput({ ...validBase, mileage: -1 }), (err: unknown) => err instanceof HttpError && err.status === 400);
      assert.throws(() => parseVehicleInput({ ...validBase, mileage: 1.5 }), (err: unknown) => err instanceof HttpError && err.status === 400);
      assert.throws(() => parseVehicleInput({ ...validBase, mileage: Number.MAX_SAFE_INTEGER + 1 }), (err: unknown) => err instanceof HttpError && err.status === 400);
      assert.throws(() => parseVehicleInput({ ...validBase, mileage: "5" as unknown as number }), (err: unknown) => err instanceof HttpError && err.status === 400);
    });
  });

  // T-19: parseVehicleInput rejects bad shapes
  it("T-19: parseVehicleInput rejects bad shapes", () => {
    const validBase = {
      make: "Toyota",
      model: "Corolla",
      year: 2021,
      vin: "1234567890ABCDEFG",
      color: "Silver",
      mileage: 5000,
    };

    assert.throws(() => parseVehicleInput(null), (err: unknown) => err instanceof HttpError && err.status === 400);
    assert.throws(() => parseVehicleInput(undefined), (err: unknown) => err instanceof HttpError && err.status === 400);
    assert.throws(() => parseVehicleInput([]), (err: unknown) => err instanceof HttpError && err.status === 400);
    assert.throws(() => parseVehicleInput("not an object"), (err: unknown) => err instanceof HttpError && err.status === 400);

    // Missing field
    const missingMake = { ...validBase } as Partial<typeof validBase>;
    delete missingMake.make;
    assert.throws(() => parseVehicleInput(missingMake), (err: unknown) => err instanceof HttpError && err.status === 400);

    // Unknown extra field
    assert.throws(() => parseVehicleInput({ ...validBase, admin: true }), (err: unknown) => err instanceof HttpError && err.status === 400);
  });

  // T-20: parseId
  it("T-20: parseId parses positive safe integers and rejects invalid values", () => {
    assert.equal(parseId("1"), 1);
    assert.equal(parseId(1), 1);
    assert.equal(parseId("42"), 42);
    assert.equal(parseId(42), 42);

    const invalid = ["0", 0, "-1", -1, "1.5", 1.5, "abc", "", "1e3", "9007199254740993", undefined, null, {}, []];
    for (const val of invalid) {
      assert.throws(
        () => parseId(val),
        (err: unknown) => err instanceof HttpError && err.status === 400 && err.message === "Invalid id",
        `Expected ${String(val)} to throw HttpError(400, "Invalid id")`,
      );
    }
  });

  // T-21: parseVehicleQuery
  it("T-21: parseVehicleQuery provides defaults and validates bounds", () => {
    assert.deepEqual(parseVehicleQuery(), { q: "", page: 1, pageSize: 10 });
    assert.deepEqual(parseVehicleQuery({}), { q: "", page: 1, pageSize: 10 });

    // Trimming and capping q
    assert.deepEqual(parseVehicleQuery({ q: "  ford  ", page: "2", pageSize: "20" }), {
      q: "ford",
      page: 2,
      pageSize: 20,
    });
    const longQ = "a".repeat(150);
    assert.equal(parseVehicleQuery({ q: longQ }).q, "a".repeat(100));

    // Page validation
    assert.throws(() => parseVehicleQuery({ page: 0 }), (err: unknown) => err instanceof HttpError && err.status === 400);
    assert.throws(() => parseVehicleQuery({ page: -1 }), (err: unknown) => err instanceof HttpError && err.status === 400);
    assert.throws(() => parseVehicleQuery({ page: "x" }), (err: unknown) => err instanceof HttpError && err.status === 400);
    assert.throws(() => parseVehicleQuery({ page: ["1", "2"] as unknown as string }), (err: unknown) => err instanceof HttpError && err.status === 400);

    // PageSize validation
    assert.throws(() => parseVehicleQuery({ pageSize: 0 }), (err: unknown) => err instanceof HttpError && err.status === 400);
    assert.throws(() => parseVehicleQuery({ pageSize: 101 }), (err: unknown) => err instanceof HttpError && err.status === 400);
    assert.throws(() => parseVehicleQuery({ pageSize: "x" }), (err: unknown) => err instanceof HttpError && err.status === 400);
    assert.throws(() => parseVehicleQuery({ pageSize: ["10", "20"] as unknown as string }), (err: unknown) => err instanceof HttpError && err.status === 400);

    // PageSize boundaries 1 and 100 pass
    assert.equal(parseVehicleQuery({ pageSize: 1 }).pageSize, 1);
    assert.equal(parseVehicleQuery({ pageSize: 100 }).pageSize, 100);
    assert.equal(parseVehicleQuery({ pageSize: "1" }).pageSize, 1);
    assert.equal(parseVehicleQuery({ pageSize: "100" }).pageSize, 100);
  });
});

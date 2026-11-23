import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../../..");

describe("warehouse-server conformance", () => {
  // T-34: Root package.json registers the workspaces and stays additive
  it("T-34: Root package.json registers the workspaces and stays additive", () => {
    const rootPkgPath = path.join(rootDir, "package.json");
    const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf-8"));

    assert.equal(rootPkg.name, "neversoft-agentic");
    assert.equal(rootPkg.private, true);
    assert.equal(rootPkg.version, "0.0.0");

    assert.deepEqual(rootPkg.workspaces, ["tools/warehouse-server", "tools/warehouse-ui"]);

    assert.ok(rootPkg.scripts.test.includes("src/main/java/com/neversoft/vehicle/Vehicle.java"));
    assert.ok(rootPkg.scripts["test:warehouse"]);
    assert.ok(rootPkg.scripts.typecheck);
    assert.ok(rootPkg.scripts.build);
    assert.ok(rootPkg.scripts.start);

    // Workspace package.json files
    const serverPkgPath = path.join(rootDir, "tools/warehouse-server/package.json");
    const serverPkg = JSON.parse(fs.readFileSync(serverPkgPath, "utf-8"));
    assert.equal(serverPkg.type, "module");
    assert.equal(serverPkg.engines?.node, ">=22.13");

    const uiPkgPath = path.join(rootDir, "tools/warehouse-ui/package.json");
    if (fs.existsSync(uiPkgPath)) {
      const uiPkg = JSON.parse(fs.readFileSync(uiPkgPath, "utf-8"));
      assert.equal(uiPkg.type, "module");
    }
  });

  // T-35: Server entry binds to loopback only and the host is not configurable
  it("T-35: Server entry binds to loopback only and the host is not configurable", () => {
    const indexPath = path.join(__dirname, "index.ts");
    const content = fs.readFileSync(indexPath, "utf-8");

    assert.ok(content.includes('host: "127.0.0.1"'), 'index.ts must bind to host: "127.0.0.1"');
    assert.ok(!content.includes("0.0.0.0"), "index.ts must not contain 0.0.0.0");
    assert.ok(!content.includes("process.env.HOST"), "index.ts must not read process.env.HOST");
  });
});

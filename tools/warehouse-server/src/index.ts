import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WarehouseDb } from "./db.js";
import { buildApp } from "./app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.WAREHOUSE_DATA_DIR ?? path.resolve(__dirname, "..", ".data");
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "warehouse.sqlite");
const db = new WarehouseDb(dbPath);

const webDist = path.resolve(__dirname, "..", "..", "warehouse-ui", "dist");
const app = await buildApp(db, { webDist });

const port = Number(process.env.PORT ?? 4323);
await app.listen({ host: "127.0.0.1", port });
console.log(`warehouse-server on http://localhost:${port}`);

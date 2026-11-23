import fs from "node:fs";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import { type WarehouseDb, DuplicateVinError } from "./db.js";
import { HttpError, parseId, parseVehicleInput, parseVehicleQuery } from "./validate.js";

export interface BuildAppOptions {
  webDist?: string;
}

export async function buildApp(db: WarehouseDb, opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "warn" } });

  app.setErrorHandler((err: Error & { statusCode?: number; status?: number }, _req, reply) => {
    if (err instanceof HttpError) {
      return reply.status(err.status).send({ error: err.message });
    }
    if (err instanceof DuplicateVinError) {
      return reply.status(409).send({ error: "A vehicle with this VIN already exists" });
    }
    const status = err.statusCode ?? err.status ?? 500;
    if (status >= 400 && status < 500) {
      return reply.status(status).send({ error: "Bad request" });
    }
    app.log.error(err);
    return reply.status(500).send({ error: "Internal server error" });
  });

  app.get("/api/vehicles", async (req) => {
    const query = parseVehicleQuery(req.query as Record<string, unknown>);
    return db.listVehicles(query);
  });

  app.get<{ Params: { id: string } }>("/api/vehicles/:id", async (req) => {
    const id = parseId(req.params.id);
    const vehicle = db.getVehicle(id);
    if (!vehicle) {
      throw new HttpError(404, "Vehicle not found");
    }
    return vehicle;
  });

  app.post("/api/vehicles", async (req, reply) => {
    const input = parseVehicleInput(req.body);
    const vehicle = db.createVehicle(input);
    return reply.status(201).send(vehicle);
  });

  app.put<{ Params: { id: string } }>("/api/vehicles/:id", async (req) => {
    const id = parseId(req.params.id);
    const input = parseVehicleInput(req.body);
    const updated = db.updateVehicle(id, input);
    if (!updated) {
      throw new HttpError(404, "Vehicle not found");
    }
    return updated;
  });

  app.delete<{ Params: { id: string } }>("/api/vehicles/:id", async (req, reply) => {
    const id = parseId(req.params.id);
    const deleted = db.deleteVehicle(id);
    if (!deleted) {
      throw new HttpError(404, "Vehicle not found");
    }
    return reply.status(204).send();
  });

  if (opts.webDist && fs.existsSync(opts.webDist)) {
    await app.register(fastifyStatic, { root: opts.webDist });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/")) {
        return reply.status(404).send({ error: "Not found" });
      }
      return reply.sendFile("index.html");
    });
  } else {
    app.setNotFoundHandler((_req, reply) => {
      return reply.status(404).send({ error: "Not found" });
    });
  }

  return app;
}

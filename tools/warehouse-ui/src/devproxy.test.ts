// @vitest-environment node
import { describe, it, expect, afterAll } from "vitest";
import http from "node:http";
import { createServer, type ViteDevServer } from "vite";
import viteConfig from "../vite.config";

describe("dev server proxy", () => {
  let stubServer: http.Server | undefined;
  let viteDevServer: ViteDevServer | undefined;

  afterAll(async () => {
    if (viteDevServer) {
      await viteDevServer.close();
    }
    if (stubServer) {
      await new Promise<void>((resolve) => stubServer!.close(() => resolve()));
    }
  });

  // T-9: Dev server proxies /api to the warehouse server
  it("T-9: Dev server proxies /api to the warehouse server (BDD)", async () => {
    // Given a stub HTTP server on 127.0.0.1:4323
    const expectedResponse = { items: [], total: 0, page: 1, pageSize: 10 };
    stubServer = http.createServer((req, res) => {
      if (req.url?.startsWith("/api/vehicles")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(expectedResponse));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((resolve) => {
      stubServer!.listen(4323, "127.0.0.1", () => resolve());
    });

    // And the warehouse-ui Vite dev server is started programmatically from vite.config.ts
    viteDevServer = await createServer({
      ...viteConfig,
      configFile: false,
      server: {
        ...viteConfig.server,
        port: 4322,
      },
    });
    await viteDevServer.listen();

    // When a developer requests http://127.0.0.1:4322/api/vehicles
    const res = await fetch("http://127.0.0.1:4322/api/vehicles");
    expect(res.status).toBe(200);
    const body = await res.json();

    // Then the response body is the stub's body
    expect(body).toEqual(expectedResponse);
  });
});

import fs from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { allLabels, type ServerEvent } from "@bob-pipeline/shared";
import { loadConfig, MACHINE, TOOL_DIR } from "./config.js";
import { GitHub } from "./github.js";
import { Git } from "./git.js";
import { Db } from "./db.js";
import { bus } from "./events.js";
import { HttpError, PipelineService } from "./service.js";
import { validatePipeline } from "./validate.js";

const cfg = loadConfig();
const validation = validatePipeline(cfg);
for (const w of validation.warnings) console.warn(`pipeline warning: ${w}`);
if (validation.errors.length) {
  console.error(`pipeline.yaml has errors:\n${validation.errors.map((e) => `  - ${e}`).join("\n")}`);
  process.exit(1);
}

const gh = await GitHub.create(cfg);
const git = new Git(cfg);
const db = new Db(cfg.dataDir);
const service = new PipelineService({ cfg, gh, git, db });
const user = await gh.whoami().catch(() => "unknown");

await service.queue.recoverInterrupted();

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "warn" } });

app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
  const status = err instanceof HttpError ? err.status : err.statusCode ?? 500;
  if (status >= 500) app.log.error(err);
  reply.status(status).send({ error: err.message });
});

const num = (v: unknown) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "Bad issue number");
  return n;
};
type Body = { blockedBy?: number; stage?: string; comment?: string; note?: string; runNow?: boolean; resume?: boolean; parked?: boolean; enabled?: boolean };

app.get("/api/pipeline", async () => ({
  pipeline: cfg.pipeline,
  labels: allLabels(cfg.pipeline),
  repo: { owner: gh.owner, name: gh.repo, path: cfg.repoPath, base: cfg.pipeline.repo.base_branch },
  user,
  machine: MACHINE,
  warnings: validation.warnings,
}));

app.get("/api/issues", async () => service.listIssues());
app.get<{ Params: { n: string } }>("/api/issues/:n", async (req) => service.issueDetail(num(req.params.n)));
app.get<{ Params: { n: string } }>("/api/issues/:n/diff", async (req, reply) => {
  reply.type("text/plain").send(await service.branchDiff(num(req.params.n)));
});

app.post<{ Params: { n: string }; Body: Body }>("/api/issues/:n/start", async (req) => {
  await service.start(num(req.params.n), req.body?.runNow ?? true);
  return { ok: true };
});
app.post<{ Params: { n: string }; Body: Body }>("/api/issues/:n/run", async (req) => {
  return { run: await service.runNext(num(req.params.n)) };
});
app.post<{ Params: { n: string }; Body: Body }>("/api/issues/:n/approve", async (req) => {
  if (!req.body?.stage) throw new HttpError(400, "stage is required");
  const messages = await service.approve(num(req.params.n), req.body.stage, req.body.note, req.body.runNow ?? true);
  return { ok: true, messages };
});
app.post<{ Params: { n: string }; Body: Body }>("/api/issues/:n/request-changes", async (req) => {
  if (!req.body?.stage) throw new HttpError(400, "stage is required");
  await service.requestChanges(num(req.params.n), req.body.stage, req.body.comment ?? "", req.body.runNow ?? true);
  return { ok: true };
});
app.post<{ Params: { n: string }; Body: Body }>("/api/issues/:n/park", async (req) => {
  await service.park(num(req.params.n), req.body?.parked ?? true);
  return { ok: true };
});
app.post<{ Params: { n: string }; Body: Body }>("/api/issues/:n/retry", async (req) => {
  await service.retry(num(req.params.n), req.body?.resume ?? false);
  return { ok: true };
});
app.post<{ Params: { n: string } }>("/api/issues/:n/unlock", async (req) => {
  await service.unlock(num(req.params.n));
  return { ok: true };
});

app.get<{ Querystring: { refresh?: string } }>("/api/dependencies", async (req) => service.dependencies(req.query.refresh === "1"));
app.post<{ Params: { n: string }; Body: Body }>("/api/issues/:n/dependencies", async (req) => {
  await service.addDependency(num(req.params.n), num(req.body?.blockedBy));
  return { ok: true };
});

app.get<{ Params: { id: string } }>("/api/runs/:id/logs", async (req) => db.logs(req.params.id));
app.post<{ Params: { id: string } }>("/api/runs/:id/cancel", async (req) => ({ cancelled: service.queue.cancel(req.params.id) }));

app.get("/api/poller", async () => service.pollerStatus());
app.post<{ Body: Body }>("/api/poller", async (req) => {
  service.setPolling(!!req.body?.enabled);
  return service.pollerStatus();
});
app.post("/api/poller/poll-now", async () => {
  await service.pollOnce();
  return service.pollerStatus();
});
app.post("/api/refresh", async () => {
  service.invalidate();
  return { ok: true };
});

// Live updates for the UI.
app.get("/api/events", (req, reply) => {
  reply.hijack();
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const send = (e: ServerEvent) => reply.raw.write(`data: ${JSON.stringify(e)}\n\n`);
  send({ type: "poller", status: service.pollerStatus() });
  const unsub = bus.subscribe(send);
  const ping = setInterval(() => reply.raw.write(": ping\n\n"), 25_000);
  req.raw.on("close", () => {
    clearInterval(ping);
    unsub();
  });
});

// The built UI (npm run build). In dev, Vite serves it and proxies /api here.
const webDist = path.join(TOOL_DIR, "apps", "web", "dist");
if (fs.existsSync(webDist)) {
  await app.register(fastifyStatic, { root: webDist });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith("/api/")) return reply.status(404).send({ error: "Not found" });
    return reply.sendFile("index.html");
  });
}

const autoPoll =
  process.argv.includes("--auto-poll") || process.env.BOB_PIPELINE_AUTOPOLL === "1" || db.getSetting("autoPoll") === "1";
service.setPolling(autoPoll);

const port = Number(process.env.PORT ?? 4321);
// Local only: the app acts with your GitHub identity and has no login of its own.
await app.listen({ host: "127.0.0.1", port });
console.log(`bob-pipeline on http://localhost:${port}  (${gh.owner}/${gh.repo}, ${user} on ${MACHINE}, auto-poll ${autoPoll ? "on" : "off"})`);

# High-level plan: #17 open telemetry

## Summary
Add OpenTelemetry tracing and metrics to the only running service in the repo, `tools/warehouse-server` (Fastify and built-in SQLite). Export over OTLP, configured through standard `OTEL_*` environment variables, and disabled by default so existing behaviour and tests are unchanged.

## Approach
The issue is one line ("implement open telemetry on this project") with no scope. The repo has one runtime service: the Fastify API in `tools/warehouse-server`, which `tools/warehouse-ui` and the root `npm start` use. The Java domain model in `src/main/java` is a plain library with no process to instrument. `sales-orders-ui` is a standalone browser app with localStorage only. This plan therefore scopes to the server.

Add the OpenTelemetry Node SDK as a small, separate bootstrap module in the server. It registers a tracer and meter provider with a `service.name` resource and an OTLP exporter, and starts only when telemetry is enabled by configuration. The bootstrap must be loaded before Fastify and `node:http` are imported. The package is ESM and runs under `tsx`, so it should be preloaded with Node's `--import` flag in the `dev` and `start` scripts, rather than imported from `index.ts` after other modules. The HTTP and Fastify instrumentations then give a span per request with route, method and status, plus standard HTTP server metrics. The existing error handler in `app.ts` already logs 5xx errors, so those spans pick up error status without changing its responses.

`node:sqlite` has no auto-instrumentation. If database spans are wanted, they are added manually in a thin way around `WarehouseDb` calls. They are optional and kept to a minimum (see open questions).

Export goes to an OTLP endpoint taken from `OTEL_EXPORTER_OTLP_ENDPOINT`. There is no hardcoded endpoint. Non-local endpoints must use HTTPS. Any auth headers come from `OTEL_EXPORTER_OTLP_HEADERS` and are never committed or logged. Telemetry is off unless configured, and a graceful shutdown flushes pending data. Existing tests build the app through `buildApp` and must not need a collector.

## Alternatives considered
- Instrument the Java domain model in `src/main/java` — rejected: it is a dependency-free library with no runtime, no build tool and no process. Adding the OpenTelemetry Java API would break the repo's no-dependency `javac` harness.
- Add browser instrumentation to `warehouse-ui` and `sales-orders-ui` — rejected for this issue: the issue gives no signal that frontend telemetry is wanted. It adds bundle weight and needs CORS and collector exposure. It can be a follow-up.
- Manual spans only, with no auto-instrumentation — rejected: more code to maintain, and it misses the standard HTTP semantic conventions.
- Import the SDK at the top of `index.ts` instead of preloading — rejected: under ESM the HTTP and Fastify modules would already be loaded, so auto-instrumentation would silently not patch them.
- Always-on telemetry with a default collector endpoint — rejected: it would add startup noise and failed export attempts for developers and CI, and a default endpoint is a hardcoded network target.
- Vendor-specific agent or SDK — rejected: OTLP is vendor-neutral, and the issue names OpenTelemetry.

## Components affected
- `tools/warehouse-server` telemetry bootstrap (new) — configures the Node SDK, resource attributes, OTLP trace and metric exporters, HTTP and Fastify instrumentations, enable/disable switch and shutdown flush.
- `tools/warehouse-server` start-up scripts and `package.json` — add OpenTelemetry dependencies and preload the bootstrap in `dev` and `start`.
- `tools/warehouse-server/src/index.ts` — flush and shut down telemetry on process exit. No change to routes or response bodies.
- `tools/warehouse-server/src/app.ts` — expected to need no change, because auto-instrumentation attaches externally. A small change is possible only if span error status or route naming needs help.
- `tools/warehouse-server` tests (new) — check that telemetry is off by default, that spans are produced for API requests when enabled (in-memory exporter), and that existing suites pass unchanged.
- Root `package-lock.json` and workspace install — new dependencies are resolved at the workspace root.
- Documentation (new section) — describe the `OTEL_*` variables, how to run a local collector and how to turn telemetry on.
- `src/main/java`, `sales-orders-ui`, `tools/warehouse-ui`, `tools/bob-pipeline` — read only, no changes.

## Acceptance criteria
- AC-1: With no `OTEL_*` configuration, the server starts and serves requests exactly as before, makes no network calls to any collector, and logs no telemetry errors.
- AC-2: When telemetry is enabled by configuration, each request to an `/api/vehicles` route produces a trace span with HTTP method, route and status code, under a configurable `service.name` (default `warehouse-server`).
- AC-3: HTTP server request metrics, such as request count and duration, are recorded and exported when telemetry is enabled.
- AC-4: A request that ends in a 5xx response produces a span with error status. A 4xx response (validation, 404, 409) is not marked as a server error.
- AC-5: The export endpoint, protocol, headers and sampling are set only through standard `OTEL_*` environment variables. No endpoint, credential or token is hardcoded or committed, and header values are never logged.
- AC-6: Non-local OTLP endpoints must use HTTPS. Exporter timeouts are bounded, so an unreachable collector cannot hang requests or shutdown.
- AC-7: If the collector is unreachable, API responses and latency are unaffected, and the server does not crash.
- AC-8: On normal termination the server flushes pending telemetry and shuts the SDK down.
- AC-9: The telemetry bootstrap loads before Fastify and the HTTP module in both `npm run dev` and `npm run start`, so auto-instrumentation takes effect.
- AC-10: Request bodies, query strings containing user data, and VIN values are not added to span attributes beyond default HTTP semantic conventions.
- AC-11: Existing `tools/warehouse-server` tests, `typecheck`, and root `npm run test:warehouse` and `npm run typecheck` pass with no new warnings. New tests cover the default-off behaviour and span creation using an in-memory exporter and no network.
- AC-12: Documentation lists the supported environment variables and how to try it against a local collector.
- AC-13: New dependencies are the latest stable, actively maintained OpenTelemetry packages, are pinned through the lock file, and have no known high or critical vulnerabilities.

## Dependencies on other issues
- None known.

## Assumptions
- "This project" means the runnable service, `tools/warehouse-server`. The Java library and the frontends are out of scope.
- Traces and metrics are wanted. Logs signal export is not required, because the server uses Fastify's own logger.
- OTLP is the export protocol. An OTLP-compatible collector or backend exists outside this repo, and no collector is bundled here.
- Telemetry is opt-in through environment configuration, in line with the existing environment-driven settings (`PORT`, `LOG_LEVEL`, `WAREHOUSE_DATA_DIR`).
- Node 22.13 or later (the current engine requirement) is compatible with the current OpenTelemetry JS SDK.
- The server keeps binding to `127.0.0.1`, and telemetry adds no new listening ports.

## Risks
| Risk | Severity | Mitigation |
|---|---|---|
| The issue is under-specified, so the intended scope (server only, frontends, Java) may differ from this plan | medium | State the scope assumption explicitly and raise it in the open questions before implementation |
| ESM and `tsx` can stop auto-instrumentation from patching modules if the SDK loads too late | high | Preload the bootstrap with `--import` in all start scripts and test that spans are produced through the real server entry path |
| The OpenTelemetry JS packages move quickly and have separate experimental and stable version lines, so versions may be mismatched | medium | Use matching current releases, pin them via the lock file, and verify with a spans test |
| The exporter adds overhead or fails when the collector is down | medium | Use batch processors with bounded timeouts, opt-in enablement, and a test with an unreachable endpoint |
| Telemetry leaks sensitive data (headers, credentials, VINs, query strings) | medium | Rely on default semantic-convention attributes only, never log exporter headers, and add an assertion test on span attributes |
| The `node:sqlite` driver has no auto-instrumentation, so database time is invisible | low | Accept for the first iteration, or add a thin manual span around `WarehouseDb` as a follow-up |
| New dependencies enlarge the workspace install and the lock file | low | Add dependencies only to `tools/warehouse-server` and keep them limited to the SDK, OTLP exporters and the two instrumentations |

## Open questions
- Is the scope the warehouse server only, or should the browser UIs and the Java model also be instrumented?
- Which backend or collector will receive the data (for example an OpenTelemetry Collector, Jaeger or a vendor)? This affects the protocol (HTTP or gRPC) and the documentation examples.
- Are database spans around `WarehouseDb` operations wanted in this issue?
- Are metrics wanted as well as traces, or traces only? This plan assumes both.

## Complexity
M — one service, a small number of new files and dependencies, but ESM preload ordering, opt-in config, shutdown handling and test isolation need care.

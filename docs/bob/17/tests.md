# Test plan: #17 open telemetry

## Summary
37 tests: 2 smoke, 12 BDD, 9 component, 14 unit. All new tests live in `tools/warehouse-server/src/` and use the existing `node:test` + `node:assert/strict` setup run by `tsx --test "src/**/*.test.ts"` (see [`package.json`](../../../tools/warehouse-server/package.json)). Three new files are used: `telemetry.test.ts` (unit and in-process component), `telemetry.e2e.test.ts` (real server process against a loopback fake collector, covering smoke and BDD), and `telemetry.repo.test.ts` (static repo checks, a small addition to the LLP file list). The existing suites (`app.test.ts`, `conformance.test.ts`, `db.test.ts`, `validate.test.ts`) are not edited and act as the regression check for AC-11.

Approach: pure config rules are proved at unit level. Span and metric content is proved in-process with in-memory exporters and `app.inject` (no network). Only behaviour that depends on the real process (preload ordering under `tsx --import`, real `node:http`, OTLP over the wire, signals, unreachable collectors) is pushed up to the e2e layer. All sockets are on `127.0.0.1`; no test needs an external collector.

## Smoke
### T-1: Default-off server starts and serves `/api/vehicles` with no telemetry output
- Target: `tools/warehouse-server/src/telemetry.e2e.test.ts` (spawns `tsx --import ./src/instrument.ts src/index.ts`, the `npm run start` command shape; `GET /api/vehicles`)
- Why this layer: "is it alive" with the preload wired in must be proved through the real entry path. A unit test cannot show that adding the preload leaves the default server unchanged.
- Covers: AC-1

### T-2: Enabled server exports a span for `/api/vehicles` to a loopback collector
- Target: `tools/warehouse-server/src/telemetry.e2e.test.ts` (same spawn, `OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:<port>`, `http/json`)
- Why this layer: the critical path (preload, instrumentation patching, OTLP export) only works end to end in a real process. This is the single "feature is alive" check.
- Covers: AC-2, AC-9, risk: ESM and `tsx` can stop auto-instrumentation from patching modules if the SDK loads too late

## BDD
All BDD tests are scenarios in `tools/warehouse-server/src/telemetry.e2e.test.ts`. They share the helpers from the LLP (free port, wait for `warehouse-server on`, temp `WAREHOUSE_DATA_DIR`, kill child in `after`, loopback `node:http` fake collector).

### T-3: Disabled telemetry makes no connection to a collector
```gherkin
Given a fake collector is listening on 127.0.0.1
And the server is started with OTEL_EXPORTER_OTLP_ENDPOINT pointing at it and OTEL_SDK_DISABLED=true
When the client calls GET /api/vehicles several times
Then every response is 200
And the collector has accepted zero connections
And the server's stdout and stderr contain no "telemetry" text
```
- Target: `telemetry.e2e.test.ts`
- Why this layer: "makes no network calls" can only be observed from outside the process, with a listening socket to count connections. The unit layer proves the decision, not the absence of traffic.
- Covers: AC-1

### T-4: Request produces a span with method, route, status and service name
```gherkin
Given the server is running with telemetry enabled against the fake collector
And OTEL_SERVICE_NAME=warehouse-server-test
When the client calls GET /api/vehicles
Then the collector receives POST /v1/traces
And the payload contains a server span with http method GET, a route containing /api/vehicles and status code 200
And the resource service.name is "warehouse-server-test"
```
- Target: `telemetry.e2e.test.ts`
- Why this layer: proves the OTLP payload as a collector sees it, which the in-memory component test cannot (serialisation, resource, real HTTP).
- Covers: AC-2, risk: The OpenTelemetry JS packages move quickly and have separate experimental and stable version lines, so versions may be mismatched

### T-5: HTTP server metrics are exported
```gherkin
Given the server is running with telemetry enabled and a short OTEL_METRIC_EXPORT_INTERVAL
When the client calls GET /api/vehicles
Then the collector receives POST /v1/metrics
And the payload contains an HTTP server request duration metric with at least one data point
```
- Target: `telemetry.e2e.test.ts`
- Why this layer: the HTTP server metrics come from `instrumentation-http` on real `node:http`. `app.inject` may not drive them (LLP says so), so the real path is the reliable proof.
- Covers: AC-3

### T-6: A 5xx response is an error span and a 4xx is not
```gherkin
Given the fixture server (src/test-support/server-fixture.ts) is running with FIXTURE_FAIL_LIST=1 and the preload flag
When the client calls GET /api/vehicles and receives 500
And the client calls GET /api/vehicles/999999 and receives 404
Then the collector receives a span for the 500 request with error status
And the span for the 404 request does not have error status
```
- Target: `telemetry.e2e.test.ts` with `src/test-support/server-fixture.ts`
- Why this layer: confirms the error status survives export over real HTTP. The status-mapping logic itself is proved lower (T-17, T-18).
- Covers: AC-4

### T-7: Exporter headers are applied but never logged
```gherkin
Given the server is running with OTEL_EXPORTER_OTLP_HEADERS="authorization=Bearer secret-test-token"
When the client calls GET /api/vehicles and the exporter flushes
Then the collector receives the authorization header on its export request
And the server's stdout and stderr do not contain "secret-test-token"
```
- Target: `telemetry.e2e.test.ts`
- Why this layer: needs the real exporter to show the header is sent, and real process output to show it is not logged.
- Covers: AC-5, risk: Telemetry leaks sensitive data (headers, credentials, VINs, query strings)

### T-8: Request bodies, VINs and query strings are not exported
```gherkin
Given the server is running with telemetry enabled
When the client POSTs a vehicle with a known VIN in the body
And the client calls GET /api/vehicles?make=Ford
Then the exported trace payload does not contain the VIN or any part of the request body
And no exported attribute holds the query string value
```
- Target: `telemetry.e2e.test.ts`
- Why this layer: repeats the in-process leakage check (T-19) over real HTTP, where `instrumentation-http` records `url.query`/`http.target` differently from `inject`.
- Covers: AC-10, risk: Telemetry leaks sensitive data (headers, credentials, VINs, query strings)

### T-9: Non-local plain-HTTP endpoint is refused and the server still runs
```gherkin
Given OTEL_EXPORTER_OTLP_ENDPOINT=http://collector.example.com
When the server is started
Then it serves GET /api/vehicles with 200
And it prints exactly one "telemetry disabled" warning
And the warning does not contain the endpoint URL
And no outbound connection to that host is attempted
```
- Target: `telemetry.e2e.test.ts`
- Why this layer: "no connection attempted" and "server keeps running" are process-level facts. The rule itself is unit-tested (T-27).
- Covers: AC-6

### T-10: Unreachable collector does not affect responses or crash the server
```gherkin
Given the server is running with the collector endpoint pointing at a closed loopback port
When the client sends several requests
Then every response is 200 within a loose latency bound
And the server process is still running afterwards
```
- Target: `telemetry.e2e.test.ts`
- Why this layer: failed exports happen on background timers in the real batch processors. Only a real process shows they do not surface in request handling.
- Covers: AC-7, risk: The exporter adds overhead or fails when the collector is down

### T-11: SIGTERM flushes pending telemetry and exits 0
```gherkin
Given the server is running against the fake collector with a long OTEL_BSP_SCHEDULE_DELAY
And one request has been served
When the process receives SIGTERM
Then it exits with code 0 within 10 seconds
And the collector has received the span for that request
```
- Target: `telemetry.e2e.test.ts`
- Why this layer: signal handling in `index.ts` and the real batch flush cannot be proved in-process.
- Covers: AC-8

### T-12: Shutdown stays bounded when the collector never replies
```gherkin
Given a collector that accepts connections but never responds
And the server is running against it and has served a request
When the process receives SIGTERM
Then the process exits within the shutdown bound
```
- Target: `telemetry.e2e.test.ts`
- Why this layer: proves the real process cannot hang on a stuck collector. The timeout logic is unit-tested separately (T-21).
- Covers: AC-6, AC-8, risk: The exporter adds overhead or fails when the collector is down

### T-13: Preload makes both HTTP and Fastify instrumentation take effect
```gherkin
Given the server is started with the start-script command shape (--import ./src/instrument.ts)
And telemetry is enabled against the fake collector
When the client calls GET /api/vehicles
Then the exported spans include one from the HTTP instrumentation scope
And the exported spans include one from the Fastify instrumentation scope with the route name
```
- Target: `telemetry.e2e.test.ts`
- Why this layer: AC-9 is about load order in the real entry path. Both scopes present shows both `node:http` and Fastify were patched, so a late-loaded SDK would fail here.
- Covers: AC-9, risk: ESM and `tsx` can stop auto-instrumentation from patching modules if the SDK loads too late

### T-14: Standard sampler variable is honoured
```gherkin
Given the server is running with telemetry enabled and OTEL_TRACES_SAMPLER=always_off
When the client calls GET /api/vehicles
Then the collector receives no trace spans for the request
```
- Target: `telemetry.e2e.test.ts`
- Why this layer: shows sampling is controlled only by `OTEL_*` variables in the real SDK. There is no repo code to unit test, since the SDK does the selection.
- Covers: AC-5

## Component
All in `tools/warehouse-server/src/telemetry.test.ts` unless stated. They run sequentially, call `initTelemetry(env, overrides)` before `buildApp(new WarehouseDb(":memory:"))`, inject `InMemorySpanExporter` / `InMemoryMetricExporter`, and end with `shutdownTelemetry()` plus `trace.disable()` / `metrics.disable()`. No network.

### T-15: Default-off `initTelemetry({})` returns undefined and emits nothing
- Target: `telemetry.test.ts` (`initTelemetry`, `shutdownTelemetry`, `buildApp`)
- Why this layer: the `initTelemetry` and `buildApp` boundary is what existing tests rely on. Proves they need no collector, so existing suites are unaffected. Spies on `console.warn` and checks the memory exporter is empty after `app.inject`.
- Covers: AC-1, AC-11

### T-16: `GET /api/vehicles` span carries method, route, status and default service name
- Target: `telemetry.test.ts` (`initTelemetry` + `buildApp` + `app.inject`)
- Why this layer: span content can be asserted exactly with an in-memory exporter, without a process or network. Checks `http.route` (or installed equivalent) contains `/api/vehicles`, method, status 200, and resource `service.name === "warehouse-server"`.
- Covers: AC-2, AC-11, risk: The OpenTelemetry JS packages move quickly and have separate experimental and stable version lines, so versions may be mismatched

### T-17: Handled 4xx responses are not error spans
- Target: `telemetry.test.ts` (404 on `/api/vehicles/999999`, a validation 400, and a duplicate-VIN 409)
- Why this layer: this is the open question in the LLP (does `@fastify/otel` mark handled 4xx as `ERROR`?). It must be decided before the contingent `app.ts` change, and the in-memory exporter answers it fastest. Asserts no span has status code `ERROR`.
- Covers: AC-4

### T-18: A 5xx response produces a span with error status
- Target: `telemetry.test.ts` (stub `db.listVehicles` to throw, then `app.inject` `GET /api/vehicles`)
- Why this layer: the existing error handler logs and returns 500 without help from the test, so the logic is provable in-process. The response body must also still be the existing generic 500 body.
- Covers: AC-4

### T-19: No VIN, body or query string appears in span attributes
- Target: `telemetry.test.ts` (`POST /api/vehicles` with a VIN, `GET /api/vehicles?make=Ford`)
- Why this layer: a cheap assertion over every attribute key and value of every finished span. It runs far faster than the e2e version (T-8) and fails first if an option such as `requestHook` is added.
- Covers: AC-10, risk: Telemetry leaks sensitive data (headers, credentials, VINs, query strings)

### T-20: Metrics are recorded and flushed on shutdown
- Target: `telemetry.test.ts` (`InMemoryMetricExporter` via `PeriodicExportingMetricReader` with a short interval; `shutdownTelemetry`)
- Why this layer: shows the metric reader is wired and that `shutdownTelemetry()` flushes data points. If `inject` does not drive HTTP server metrics, this test is dropped in favour of T-5 and T-11, and the LLP note applies.
- Covers: AC-3, AC-8

### T-21: `shutdownTelemetry` is bounded when an exporter never finishes
- Target: `telemetry.test.ts` (span processor override whose `shutdown()` never resolves; `shutdownTelemetry(100)`)
- Why this layer: exercises the `Promise.race` timeout and the `unref`'d timer deterministically, which an e2e run can only show with timing slack. Asserts it resolves in roughly the timeout and does not reject.
- Covers: AC-6, AC-8, risk: The exporter adds overhead or fails when the collector is down

### T-22: Invalid endpoint leaves telemetry off with one safe warning
- Target: `telemetry.test.ts` (`initTelemetry({ OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector.example.com", OTEL_EXPORTER_OTLP_HEADERS: "authorization=Bearer secret-test-token" })`)
- Why this layer: crosses the `resolveTelemetryConfig` and `initTelemetry` boundary. Asserts it returns `undefined`, does not throw, calls `console.warn` once, the message has neither the URL nor the header value, and no span is recorded.
- Covers: AC-5, AC-6, AC-7

### T-23: `initTelemetry` is idempotent and `shutdownTelemetry` acts on the same instance
- Target: `telemetry.test.ts`
- Why this layer: the preload and `index.ts` share one module-level SDK. If a second call created a second SDK, `index.ts` would flush the wrong one. Asserts a second `initTelemetry` returns the existing handle and one `shutdownTelemetry` flushes spans.
- Covers: AC-8

## Unit
`resolveTelemetryConfig` tests are pure (no SDK, no network) in `telemetry.test.ts`. Static repo checks are in `telemetry.repo.test.ts`.

### T-24: No endpoint, or only empty endpoint values, gives disabled with no reason
- Target: `telemetry.test.ts` (`resolveTelemetryConfig({})`, empty-string values for the three endpoint variables)
- Why this layer: pure branching logic. This is the default-off decision, and the missing `reason` is what makes `initTelemetry` silent.
- Covers: AC-1

### T-25: `OTEL_SDK_DISABLED` overrides a valid endpoint, case-insensitive
- Target: `telemetry.test.ts` (`"true"`, `"TRUE"`, `"True"`; also `"false"` leaves it enabled)
- Why this layer: a single pure branch.
- Covers: AC-1

### T-26: Loopback HTTP and any HTTPS endpoint are accepted
- Target: `telemetry.test.ts` (`http://127.0.0.1:4318`, `http://localhost:4318`, `http://[::1]:4318`, `https://collector.example.com`)
- Why this layer: boundary table of the HTTPS rule, no I/O needed.
- Covers: AC-6

### T-27: Non-local plain HTTP is rejected with a reason that omits the URL
- Target: `telemetry.test.ts` (`http://collector.example.com` gives `{ enabled: false, reason }`; `reason` does not contain the host or URL)
- Why this layer: pure function with a security-relevant output (fail closed, no leakage).
- Covers: AC-5, AC-6

### T-28: Unparsable, lookalike-host and userinfo endpoints are rejected safely
- Target: `telemetry.test.ts` (`not a url`; `http://localhost.evil.com`; `http://127.0.0.1.evil.com`; `http://user:pass@collector.example.com`)
- Why this layer: edge cases for the hostname allow-list (exact match, not prefix) and credential-in-URL. Asserts the reason never contains `pass` or the URL, and that the function does not throw.
- Covers: AC-5, AC-6

### T-29: Traces-only and metrics-only endpoint variables get the same check
- Target: `telemetry.test.ts` (`OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` and `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` alone; a valid general endpoint plus an invalid per-signal one gives disabled)
- Why this layer: validates every set endpoint, so one bad value cannot slip through behind a good one.
- Covers: AC-6

### T-30: `service.name` defaults to `warehouse-server` and honours `OTEL_SERVICE_NAME`
- Target: `telemetry.test.ts` (unset, custom, and empty-string values)
- Why this layer: pure default/override logic.
- Covers: AC-2

### T-31: Header values never appear in a config result
- Target: `telemetry.test.ts` (`OTEL_EXPORTER_OTLP_HEADERS` set alongside both valid and invalid endpoints; `JSON.stringify` of the result must not contain the value)
- Why this layer: cheap guard against a regression that echoes the environment into a reason or config object.
- Covers: AC-5, risk: Telemetry leaks sensitive data (headers, credentials, VINs, query strings)

### T-32: `shutdownTelemetry` is a no-op when nothing was started
- Target: `telemetry.test.ts` (resolves, does not throw, no timer left open)
- Why this layer: pure guard branch. It matters because `index.ts` calls it on every shutdown, including the default-off path.
- Covers: AC-1, AC-8

### T-33: `dev` and `start` scripts preload `instrument.ts`; other scripts are unchanged
- Target: `tools/warehouse-server/src/telemetry.repo.test.ts` (parse `package.json`)
- Why this layer: `npm run dev` uses `tsx watch`, which is slow and flaky to spawn in a test. A static check on the script strings is the lowest layer that proves `dev` is wired, while T-2 and T-13 prove the same flag works for `start`. The test accepts the documented fallback form (`node --import tsx --import ./src/instrument.ts`). It asserts the `--import` of `instrument.ts` comes before `src/index.ts` and that `typecheck` and `test` are unchanged.
- Covers: AC-9, AC-11

### T-34: Import graph keeps the load-order guarantee
- Target: `telemetry.repo.test.ts` (read `instrument.ts`, `index.ts`, `telemetry.ts`, `app.ts` sources)
- Why this layer: static check. `instrument.ts` imports only `./telemetry.js` (plus optional `node:module`), `index.ts` does not import `instrument.ts`, and `telemetry.ts` does not import `fastify` or `node:http`. Any of these breaking would silently disable instrumentation.
- Covers: AC-9, risk: ESM and `tsx` can stop auto-instrumentation from patching modules if the SDK loads too late

### T-35: No hardcoded endpoint, token or credential in new source
- Target: `telemetry.repo.test.ts` (scan `telemetry.ts`, `instrument.ts`, `server-fixture.ts`; check `.gitignore` still ignores `.env`)
- Why this layer: static scan. Asserts no `http(s)://` literal other than the loopback allow-list names, no `Bearer`, and no `OTEL_EXPORTER_OTLP_HEADERS` value being logged (`console.*` calls do not reference `env` headers).
- Covers: AC-5

### T-36: Dependencies are declared only in the server package and resolved in the lock file
- Target: `telemetry.repo.test.ts` (read `tools/warehouse-server/package.json`, root `package.json`, root `package-lock.json`)
- Why this layer: offline check. Asserts the four runtime packages are in the server's `dependencies` with caret ranges, nothing is added to the root `package.json`, each resolves in `package-lock.json`, and the `@opentelemetry/*` experimental and stable lines resolve to one version each (no duplicate majors of `@opentelemetry/api`).
- Covers: AC-13, risk: New dependencies enlarge the workspace install and the lock file, risk: The OpenTelemetry JS packages move quickly and have separate experimental and stable version lines, so versions may be mismatched

### T-37: README documents the variables, the HTTPS rule and a local collector example
- Target: `telemetry.repo.test.ts` (read `tools/warehouse-server/README.md`)
- Why this layer: documentation content is a static check. Asserts every `OTEL_*` variable from the LLP list appears, the HTTPS-for-non-local rule and the default-off statement are present, a loopback example (`127.0.0.1:4318`) exists, and any container image named uses `registry.redhat.io`.
- Covers: AC-12

## Coverage
| Criterion / risk | Smoke | BDD | Component | Unit |
|---|---|---|---|---|
| AC-1 | T-1 | T-3 | T-15 | T-24, T-25, T-32 |
| AC-2 | T-2 | T-4 | T-16 | T-30 |
| AC-3 | | T-5 | T-20 | |
| AC-4 | | T-6 | T-17, T-18 | |
| AC-5 | | T-7, T-14 | T-22 | T-27, T-28, T-31, T-35 |
| AC-6 | | T-9, T-12 | T-21, T-22 | T-26, T-27, T-28, T-29 |
| AC-7 | | T-10 | T-22 | |
| AC-8 | | T-11, T-12 | T-20, T-21, T-23 | T-32 |
| AC-9 | T-2 | T-13 | | T-33, T-34 |
| AC-10 | | T-8 | T-19 | |
| AC-11 | | | T-15, T-16 | T-33 (plus unchanged existing suites) |
| AC-12 | | | | T-37 |
| AC-13 | | | | T-36 |
| Risk: ESM and `tsx` late SDK load | T-2 | T-13 | | T-34 |
| Risk: package version mismatch | | T-4 | T-16 | T-36 |
| Risk: exporter overhead or collector down | | T-10, T-12 | T-21 | |
| Risk: telemetry leaks sensitive data | | T-7, T-8 | T-19 | T-31 |
| Risk: dependencies enlarge install | | | | T-36 |

## Gaps
- AC-13 "latest stable", "actively maintained" and "no known high or critical vulnerabilities" are not automated. They depend on the live registry and advisory database, so a test would be non-deterministic and need network. They are checked at implementation time with `npm outdated` and `npm audit` (LLP rollout step 1). T-36 covers only the offline parts (declared, pinned by lock file, scoped to the server).
- AC-11 "no new warnings" and "existing suites pass unchanged" are not a new test. They are proved by running the existing `npm run test:warehouse`, `npm run typecheck` and `npm test -w @warehouse/server`. New tests (T-15, T-16, T-33) cover only the new-test part of the criterion.
- The `npm run dev` command (`tsx watch`) is not spawned. Its preload is checked statically (T-33) and the same flag is exercised through the `start` shape (T-2, T-13). Spawning a file watcher in CI is flaky and adds nothing beyond that.
- The SDK start-failure branch in `initTelemetry` (`sdk.start()` throwing, warn and return `undefined`) has no dedicated test. It cannot be induced without mocking the SDK, which the repo does not do elsewhere. T-10 and T-22 cover the user-visible fail-closed behaviour for the realistic failures.
- Risk: the issue is under-specified and the scope may differ. This is a product decision, not testable. It remains an open question in the plans.
- Risk: no `node:sqlite` auto-instrumentation, so database time is invisible. Accepted in the HLP, with no database spans in this issue, so there is nothing to test.
- OTLP over gRPC is not tested. The plans document HTTP (JSON or protobuf) only.
- Frontends (`sales-orders-ui`, `tools/warehouse-ui`) and the Java model are out of scope and not tested.
- The contingent `app.ts` change for 4xx spans has no separate test. T-17 is the test that triggers it and then verifies it. T-18 also guards that the 500 response body is unchanged.

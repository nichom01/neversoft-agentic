# Test plan: #6 ui for warehouse maintenance

## Summary
36 tests: 2 smoke, 7 BDD, 6 component, 21 unit. Most behaviour is proved at the lowest layer. Server logic runs against `WarehouseDb(":memory:")` and Fastify `app.inject`, with no network. UI behaviour runs in jsdom with a fake `fetch`. Only two checks need a real build and a real process (T-1, T-2), plus one real Vite dev server for the proxy (T-9).

**Framework decisions.** The repo has no existing test files under `tools/` or `src/` apart from the Java `VehicleTest`, and no UI test runner. The LLP deferred UI testing to this plan, so this plan decides:
- **Server** (`tools/warehouse-server`): `node:test` run through `tsx --test "src/**/*.test.ts"`, exactly as the LLP specifies. Assertions use `node:assert/strict`.
- **UI** (`tools/warehouse-ui`): Vitest plus React Testing Library plus jsdom, because the package is already Vite-based and Vitest reuses `vite.config.ts`. This needs **new devDependencies** in `tools/warehouse-ui/package.json` (`vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`) and a `test` script (`vitest run`). Use the latest stable releases compatible with Vite 6 and React 18 at implementation time. They do not conflict with AC-1, which constrains the runtime stack's dependency ranges, not the test tooling.
- **Root script.** The LLP's `test:warehouse` (`npm run test -w @warehouse/server`) must become `npm run test --workspaces --if-present` so that both packages' tests run. This is an additive scripts change to the root `package.json` and stays within AC-7. The existing Java `test` script is untouched.
- **UI test files must import `describe`/`it`/`expect` from `vitest` explicitly.** This keeps `tsc` (AC-6) green without global type tweaks, because `tsconfig.include` is `src` and so covers the test files.

**BDD coverage note.** AC-2, AC-3 and AC-4 have user-visible behaviour and get scenarios. AC-5 gets one scenario against a real Vite dev server. AC-1, AC-6 and AC-7 are build and repo-shape properties with no user journey, so their primary proof is smoke (T-1, T-2) or unit (T-32 to T-36), not BDD.

## Smoke

### T-1: Root typecheck passes for both new packages
- Target: `npm run typecheck` at the repo root, which runs `tsc -p tsconfig.json` in `@warehouse/server` and `@warehouse/ui`. Run after `npm install`.
- Why this layer: AC-6 is defined as "this command passes", so the command is the test. It also catches broken imports or types across the whole change, including the test files.
- Covers: AC-6

### T-2: Built app starts and serves UI and API on loopback only
- Target: shell script or CI step: `npm run build && npm run start`, with `WAREHOUSE_DATA_DIR` set to a temp dir. Then:
  - `curl http://127.0.0.1:4323/api/vehicles` returns 200 and `{"items":[],"total":0,"page":1,"pageSize":10}`.
  - `curl http://127.0.0.1:4323/` returns 200 HTML containing "Warehouse admin".
  - `curl http://127.0.0.1:4323/vehicles/new` returns the same `index.html` (SPA fallback).
  - `lsof -nP -iTCP:4323 -sTCP:LISTEN` shows only `127.0.0.1`.
  - `<tempdir>/warehouse.sqlite` exists.
- Why this layer: this is the only test that proves the whole deployed path works. It covers the Vite build output, the Fastify static serving, the real `index.ts` wiring (host, port, data dir) and a real `node:sqlite` file. None of that can be proved by `inject` tests.
- Covers: AC-1, AC-2, AC-3

## BDD

### T-3: API journey, create, read, update, delete a vehicle
```gherkin
Given an empty warehouse database
When a client POSTs a valid vehicle {make: "Ford", model: "Transit", year: 2020, vin: "VIN-1", color: "White", mileage: 12000}
Then the response is 201 and contains a generated id plus the submitted fields
When the client GETs /api/vehicles/{id}
Then the response is 200 with the same vehicle
When the client PUTs the same id with mileage 15000
Then the response is 200 and mileage is 15000
When the client DELETEs the id
Then the response is 204
And a following GET of that id returns 404 {"error": ...}
```
- Target: `tools/warehouse-server/src/app.test.ts` (`node:test`, `buildApp(new WarehouseDb(":memory:"))`, `app.inject`)
- Why this layer: the journey spans route, validation and DB together, which is what "CRUD works" means for a caller. It can run in-process, so no real server is needed.
- Covers: AC-2, AC-3

### T-4: API journey, filter and page the list
```gherkin
Given vehicles Ford Transit, Ford Focus and Toyota Hilux exist
When a client GETs /api/vehicles?q=ford
Then total is 2 and items contain only the two Fords
When a client GETs /api/vehicles?pageSize=1&page=2
Then items has exactly one vehicle, total is 3, page is 2 and pageSize is 1
When a client edits one vehicle and deletes another
Then the list and total reflect each step
```
- Target: `tools/warehouse-server/src/app.test.ts`
- Why this layer: the UI's "paginated/filterable list" depends on this server contract, so it is proved through the HTTP surface. Paging arithmetic details are left to unit tests (T-23, T-24).
- Covers: AC-2, AC-4

### T-5: UI journey, browse, filter and page vehicles
```gherkin
Given the warehouse server holds 12 vehicles (a fake fetch emulating GET /api/vehicles)
When the admin opens "/"
Then the table shows the first 10 vehicles with columns id, make, model, year, VIN, color and mileage
And the label reads "page 1 of 2"
When the admin clicks Next
Then the second page with 2 vehicles is shown and Next is disabled
When the admin types "ford" in the search box
Then the page returns to 1 and the request carries q=ford
```
- Target: `tools/warehouse-ui/src/pages/vehicles.journey.test.tsx` (Vitest, RTL, `MemoryRouter`, `vi.stubGlobal("fetch", ...)`)
- Why this layer: the user sees this behaviour. It spans the page, the React Query hooks, `api.ts` and the router. No browser is needed because jsdom is enough for this DOM-level proof.
- Covers: AC-4

### T-6: UI journey, create a vehicle
```gherkin
Given the admin is on "/"
When the admin clicks "New vehicle"
Then the create form is shown at /vehicles/new with empty fields
When the admin fills in all fields and submits
Then POST /api/vehicles is sent with the typed values (year and mileage as numbers)
And the app navigates back to "/"
And the vehicle list is re-fetched
```
- Target: `tools/warehouse-ui/src/pages/vehicles.journey.test.tsx`
- Why this layer: it proves routing, form, mutation and cache invalidation work together, which no single component test can prove.
- Covers: AC-4

### T-7: UI journey, edit a vehicle
```gherkin
Given vehicle 7 exists
When the admin clicks Edit on that row
Then the form at /vehicles/7/edit is pre-filled with the vehicle's values
When the admin changes the color and submits
Then PUT /api/vehicles/7 is sent with the full input
And the app returns to "/" showing the new color
```
- Target: `tools/warehouse-ui/src/pages/vehicles.journey.test.tsx`
- Why this layer: same reason as T-6. It also proves that the `:id` param switches the single form component into edit mode.
- Covers: AC-4

### T-8: UI journey, delete with confirmation
```gherkin
Given the list shows a Ford Transit with VIN "VIN-1"
When the admin clicks Delete on that row
Then a confirmation overlay shows "Ford", "Transit" and "VIN-1" with Cancel and Confirm buttons
And no DELETE request has been sent
When the admin clicks Cancel
Then the overlay closes and the row is still listed
When the admin clicks Delete and then Confirm
Then DELETE /api/vehicles/{id} is sent and the list is re-fetched without that vehicle
```
- Target: `tools/warehouse-ui/src/pages/vehicles.journey.test.tsx`
- Why this layer: the "no request until Confirm" guarantee is a user-facing safety behaviour that spans page state and mutation.
- Covers: AC-4

### T-9: Dev server proxies /api to the warehouse server
```gherkin
Given a stub HTTP server on 127.0.0.1:4323 that answers GET /api/vehicles with {"items":[],"total":0,"page":1,"pageSize":10}
And the warehouse-ui Vite dev server is started programmatically from vite.config.ts
When a developer requests http://127.0.0.1:4322/api/vehicles
Then the response body is the stub's body
And no request is made to port 4321 (the pipeline server)
```
- Target: `tools/warehouse-ui/src/devproxy.test.ts` (Vitest, node environment via `// @vitest-environment node`; `createServer` from `vite`, `node:http` stub; closes both servers in `after`)
- Why this layer: AC-5 is about runtime proxy behaviour. A config-value assertion (T-33) alone would not prove that the proxy really forwards. It needs a real Vite server, but not a browser or the real backend.
- Covers: AC-5, risk: Vite port conflict between warehouse-ui dev server and pipeline web app dev server

## Component

### T-10: HTTP contract, status code matrix for all five endpoints
- Target: `tools/warehouse-server/src/app.test.ts`. Table-driven `app.inject` cases:

| Request | Expected |
|---|---|
| `GET /api/vehicles` | 200 `VehicleList` |
| `GET /api/vehicles/:id` for an existing id | 200 `Vehicle` |
| `GET /api/vehicles/:id` for a missing id | 404 `{error}` |
| `GET /api/vehicles/abc` | 400 `{error: "Invalid id"}` |
| `POST` valid | 201 |
| `POST` invalid body | 400 |
| `POST` duplicate VIN | 409 `{error: "A vehicle with this VIN already exists"}` |
| `PUT` valid | 200 |
| `PUT` missing id | 404 |
| `PUT` duplicate VIN of another row | 409 |
| `DELETE` existing | 204 with empty body |
| `DELETE` missing | 404 |
| `DELETE /api/vehicles/-1` | 400 |

- Why this layer: this is the REST boundary the plan introduces and the UI depends on. The routes, validation and DB are wired by `buildApp`, so a handler-level test is the lowest layer that can check the statuses. Each individual rule is proved by a unit test.
- Covers: AC-2

### T-11: Error handling and static and SPA fallback
- Target: `tools/warehouse-server/src/app.test.ts`. Cases:
  - A DB stub that throws `new Error("SELECT * FROM vehicles secret")` gives 500 `{error: "Internal server error"}`. The body must not contain "SELECT", "vehicles" or "at " stack text.
  - Malformed JSON body gives 400 `{error: "Bad request"}`.
  - `GET /api/nope` gives 404 `{error: "Not found"}`.
  - With `webDist` pointing to a temp dir holding an `index.html`, `GET /vehicles/new` gives 200 HTML.
  - Without `webDist`, the app still builds.
- Why this layer: this is the error contract of the new boundary. It is a security requirement (no stack traces or SQL text to clients) that needs the real Fastify error handler, so it cannot be a pure unit test.
- Covers: AC-2

### T-12: SQLite file persistence and schema match Vehicle.java
- Target: `tools/warehouse-server/src/db.test.ts`. Uses a temp file path. After creating a vehicle, close the connection and reopen the same path. Then open the file directly with `node:sqlite` and run `PRAGMA table_info(vehicles)`.
- Assertions:
  - The record is still there after reopening.
  - The columns are exactly `id, make, model, year, vin, color, mileage`, in that order.
  - `id` is the primary key.
  - `vin` is unique.
  - `PRAGMA journal_mode` is `wal`.
  - A second `new WarehouseDb(samePath)` does not fail or wipe data (`CREATE TABLE IF NOT EXISTS`).
- Why this layer: the DB-access boundary is the real file and the real engine. `:memory:` cannot prove persistence or the on-disk schema. The test uses real `node:sqlite` and no mocks.
- Covers: AC-3

### T-13: UI API client and hooks contract
- Target: `tools/warehouse-ui/src/api.test.ts` (Vitest, fake `fetch`, `QueryClientProvider` wrapper, `renderHook`).
- Assertions:
  - `api.get/post/put/del` use the right method, URL and JSON headers.
  - `useVehicles` builds `/api/vehicles?q=...&page=...&pageSize=...` with encoded `q`. All requests use relative `/api/...` URLs, so the Vite proxy handles them.
  - A 204 response from `del` resolves with no JSON parse error.
  - A non-2xx `{error}` body becomes `Error.message`.
  - A non-JSON error body falls back to a generic message and does not throw a parse error.
  - Each mutation invalidates `["vehicles"]`.
  - `useVehicle(undefined)` does not fetch.
- Why this layer: this is the UI-to-server boundary. The tests prove the client matches the server contract without rendering any page.
- Covers: AC-4, AC-5

### T-14: VehicleListPage states
- Target: `tools/warehouse-ui/src/pages/VehicleListPage.test.tsx`
- Assertions:
  - A loading indicator shows while pending.
  - An empty list shows an empty-state message.
  - A failed fetch shows the `ErrorBox` with the server message.
  - Prev is disabled on page 1 and Next is disabled on the last page.
  - `page` resets to 1 when `q` changes.
  - A failed DELETE keeps the overlay open and shows the error in an `ErrorBox`.
  - The "New vehicle" button links to `/vehicles/new` and the Edit link to `/vehicles/:id/edit`.
- Why this layer: these are state branches of one component that the journey tests (T-5, T-8) do not exercise, such as errors, the empty state and disabled controls. Each can be proved against a fake fetch without the router journey.
- Covers: AC-4

### T-15: VehicleFormPage validation and modes
- Target: `tools/warehouse-ui/src/pages/VehicleFormPage.test.tsx`
- Assertions:
  - Create mode (no `:id`) shows empty fields.
  - Edit mode loads the vehicle and pre-fills the fields. A 404 on load shows an `ErrorBox`.
  - The client-side checks block submission and make no request for: empty make/model/VIN, non-integer or out-of-range year, negative mileage.
  - A server 400 or 409 message (for example the duplicate VIN) is shown in the `ErrorBox`, and the form stays on the page with the user's input kept.
  - Cancel navigates to `/` and sends no request.
  - The submit button is disabled while the mutation is pending, so there is no double submit.
- Why this layer: the form has the most branches in the UI, and most are error paths. They can be proved in one rendered component without the whole app.
- Covers: AC-4

## Unit

### T-16: parseVehicleInput accepts valid input, trims and ignores client id
- Target: `tools/warehouse-server/src/validate.test.ts`
- Why this layer: pure function with no I/O. Covers trimming of make, model, vin and color, and `{id: 999, ...}` returning an object without `id` (a client cannot choose the primary key).
- Covers: AC-2

### T-17: parseVehicleInput string length boundaries
- Target: `tools/warehouse-server/src/validate.test.ts`
- Why this layer: boundary-value tests of pure logic.
  - `make` and `model`: 1 and 100 characters pass; 0, 101 and whitespace-only fail.
  - `vin`: 1 and 64 pass; 65 fails.
  - `color`: 0 and 50 pass; 51 fails.
  - Non-string values fail.
- Covers: AC-2

### T-18: parseVehicleInput year and mileage rules
- Target: `tools/warehouse-server/src/validate.test.ts`
- Why this layer: numeric edge cases of pure logic.
  - `year`: 1886 and current year + 1 pass. 1885, current year + 2, 2020.5, `"2020"`, `NaN` and `Infinity` fail.
  - `mileage`: 0 and `Number.MAX_SAFE_INTEGER` pass. -1, 1.5, `MAX_SAFE_INTEGER + 1` and `"5"` fail.
- Covers: AC-2

### T-19: parseVehicleInput rejects bad shapes
- Target: `tools/warehouse-server/src/validate.test.ts`
- Why this layer: allow-list validation of pure logic. Rejected inputs: `null`, `undefined`, arrays, strings, a missing required field, and an unknown extra field (for example `{..., admin: true}`). Each throws `HttpError` with status 400.
- Covers: AC-2

### T-20: parseId
- Target: `tools/warehouse-server/src/validate.test.ts`
- Why this layer: pure function. `"1"` and `"42"` give a number. Each of `"0"`, `"-1"`, `"1.5"`, `"abc"`, `""`, `"1e3"`, `"9007199254740993"` and `undefined` throws `HttpError(400, "Invalid id")`.
- Covers: AC-2

### T-21: parseVehicleQuery
- Target: `tools/warehouse-server/src/validate.test.ts`
- Why this layer: pure function with defaults and bounds.
  - Defaults are `q ""`, `page 1`, `pageSize 10`.
  - `q` is trimmed and a `q` over 100 characters is capped.
  - `page` 0, -1 and `"x"` give 400.
  - `pageSize` 0, 101 and `"x"` give 400, while 1 and 100 pass.
  - Array-valued params (`?page=1&page=2`) give 400.
- Covers: AC-2

### T-22: WarehouseDb create, get, update, delete round trip stores values unchanged
- Target: `tools/warehouse-server/src/db.test.ts` (`:memory:`)
- Why this layer: data-access logic without HTTP. The values returned by `createVehicle` and `getVehicle` equal the input plus a positive integer `id`. `updateVehicle` changes all fields and keeps the `id`. `deleteVehicle` returns `true` and the row is gone. Ids are not reused after a delete (`AUTOINCREMENT`).
- Covers: AC-3

### T-23: WarehouseDb filter matches make, model, vin and color
- Target: `tools/warehouse-server/src/db.test.ts`
- Why this layer: one query with four OR branches. The test needs one fixture row per column where only that column matches `q`, so a dropped branch is caught. Matching is case-insensitive. The same `q` yields the same `total` as `items.length` when all fit on one page.
- Covers: AC-3, AC-4

### T-24: WarehouseDb pagination arithmetic and ordering
- Target: `tools/warehouse-server/src/db.test.ts`
- Why this layer: pure data-access logic. With 25 rows and `pageSize` 10, pages 1, 2 and 3 return 10, 10 and 5 items. Items are ordered by `id`. `total` is 25 on every page. A page beyond the end returns `items: []` and `total: 25`. The filter and `total` stay consistent (`COUNT(*)` uses the same `WHERE`).
- Covers: AC-4

### T-25: likePattern and LIKE wildcards are treated literally
- Target: `tools/warehouse-server/src/db.test.ts`
- Why this layer: the escaping function is pure, and the filter query depends on it. `likePattern("50%")`, `likePattern("a_b")` and `likePattern("a\\b")` escape `%`, `_` and `\`. With rows "100% Ford" and "Ford", `q="%"` returns only the first row, and `q="_"` does not match every row.
- Covers: AC-3

### T-26: Duplicate VIN is rejected on create and update
- Target: `tools/warehouse-server/src/db.test.ts`
- Why this layer: this is a DB-constraint-to-domain-error mapping.
  - `createVehicle` with an existing VIN throws `DuplicateVinError`.
  - `updateVehicle` that moves one row onto another row's VIN throws `DuplicateVinError`.
  - Updating a row while keeping its own VIN succeeds.
  - Other constraint errors are not converted into `DuplicateVinError`.
- Covers: AC-3

### T-27: Missing-row behaviour
- Target: `tools/warehouse-server/src/db.test.ts`
- Why this layer: simple branch coverage that the route handlers depend on for their 404s. `getVehicle(999)` returns `null`, `updateVehicle(999, ...)` returns `null` and `deleteVehicle(999)` returns `false`. None of them throws.
- Covers: AC-3

### T-28: SQL metacharacters in input are stored and searched literally
- Target: `tools/warehouse-server/src/db.test.ts`
- Why this layer: this proves the parameterised-query security requirement at the lowest layer. A vehicle with make `Robert'); DROP TABLE vehicles;--` is created and read back verbatim. Searching for that string as `q` returns it. The table still has its other rows afterwards.
- Covers: AC-3

### T-29: Mileage CHECK constraint at DB level
- Target: `tools/warehouse-server/src/db.test.ts`
- Why this layer: this proves the schema protects itself if validation is bypassed. Calling `createVehicle` directly with `mileage: -1` (skipping `parseVehicleInput`) throws, and no row is stored. The error is not a `DuplicateVinError`.
- Covers: AC-3

### T-30: loadSqlite returns a working DatabaseSync
- Target: `tools/warehouse-server/src/db.test.ts`
- Why this layer: pure environment check. `loadSqlite()` returns an object with a constructor `DatabaseSync` that opens `:memory:` on the current Node. It also asserts `process.versions.node` is at least 22.13, so a wrong CI Node version fails with a clear message. The failure branch is a gap (see Gaps).
- Covers: AC-3, risk: Node 22.13+ node:sqlite not available on the developer's machine

### T-31: UI primitives Button, Card and ErrorBox match the pipeline classes
- Target: `tools/warehouse-ui/src/components/ui.test.tsx`
- Why this layer: pure rendering of leaf components, and the cheapest guard against drift. For each of the four Button variants (default, primary, danger, ghost) it asserts the same class tokens as `tools/bob-pipeline/apps/web/src/components/ui.tsx`. Examples: `bg-emerald-600` and `border-emerald-700` for primary, and `border-red-300 text-red-700` for danger. `Card` has `rounded-lg border border-slate-200 bg-white shadow-sm` and merges `className`. `ErrorBox` renders nothing for a falsy error, shows `Error.message`, and shows `String(x)` for a non-Error. The expected strings are written into the test, so it does not import the pipeline's `ui.tsx` (which pulls in `@bob-pipeline/shared`).
- Covers: AC-4, risk: Duplicated UI primitives drift from the pipeline web app over time

### T-32: UI dependency ranges match the pipeline web app
- Target: `tools/warehouse-ui/src/conformance.test.ts` (node environment). Reads both `package.json` files via `node:fs`.
- Why this layer: static file check with no runtime needed. For `react`, `react-dom`, `react-router-dom`, `@tanstack/react-query`, `tailwindcss`, `@tailwindcss/vite`, `vite`, `@vitejs/plugin-react`, `@types/react`, `@types/react-dom` and `typescript`, the range in `@warehouse/ui` equals the range in `@bob-pipeline/web` (typescript is compared against the pipeline's root or server range, whichever declares it). The test also asserts that the pipeline-only packages (`@bob-pipeline/shared`, `@xyflow/react`, `@dagrejs/dagre`, `diff`, `react-markdown`, `remark-gfm`) are absent from `@warehouse/ui`.
- Covers: AC-1

### T-33: vite.config.ts static settings
- Target: `tools/warehouse-ui/src/conformance.test.ts`. Imports the default export of `../vite.config.ts` (it must be an object or `defineConfig({...})` form).
- Why this layer: pure config assertion. It checks `server.port === 4322`, `server.strictPort === true`, `server.proxy["/api"].target === "http://127.0.0.1:4323"`, and that no proxy target contains `4321`. It also checks that the plugin list includes the React and Tailwind plugins. T-9 covers the runtime forwarding.
- Covers: AC-1, AC-5, risk: Vite port conflict between warehouse-ui dev server and pipeline web app dev server

### T-34: Root package.json registers the workspaces and stays additive
- Target: `tools/warehouse-server/src/conformance.test.ts`. Reads the root `package.json`.
- Why this layer: static file check. `workspaces` equals `["tools/warehouse-server", "tools/warehouse-ui"]`, so `tools/bob-pipeline` is not included. The scripts `typecheck`, `build`, `start` and `test:warehouse` exist. The existing Java `test` script is byte-identical to the base branch value, and root `name`, `private` and `version` are unchanged. It also checks that both workspace `package.json` files declare `"type": "module"` and that `@warehouse/server` has `engines.node` `>=22.13`.
- Covers: AC-1, AC-2, AC-6, AC-7

### T-35: Server entry binds to loopback only and the host is not configurable
- Target: `tools/warehouse-server/src/conformance.test.ts`. Reads `src/index.ts` as text.
- Why this layer: `index.ts` calls `listen` at import time, so it cannot be imported in a unit test. A source-text check is the cheapest guard for the security rule "never bind 0.0.0.0". It asserts the file contains `host: "127.0.0.1"`, does not contain `0.0.0.0`, and does not read a `HOST` env var. T-2 proves the real socket.
- Covers: AC-2

### T-36: No existing file is modified except root package.json
- Target: script or CI step: `git diff --name-status <base-branch>...HEAD`. Success means every `M`/`D`/`R` entry is `package.json` and everything else is `A` (new files under `tools/warehouse-server/`, `tools/warehouse-ui/`, `docs/bob/6/`, and the generated root `package-lock.json`).
- Why this layer: AC-7 is a repo-state property. It has no runtime behaviour, so this is the only possible proof. It runs once before merge, not on each test run.
- Covers: AC-7

## Coverage

| Criterion / risk | Smoke | BDD | Component | Unit |
|---|---|---|---|---|
| AC-1 | T-2 | | | T-32, T-33, T-34 |
| AC-2 | T-2 | T-3, T-4 | T-10, T-11 | T-16, T-17, T-18, T-19, T-20, T-21, T-34, T-35 |
| AC-3 | T-2 | T-3 | T-12 | T-22, T-23, T-25, T-26, T-27, T-28, T-29, T-30 |
| AC-4 | | T-4, T-5, T-6, T-7, T-8 | T-13, T-14, T-15 | T-23, T-24, T-31 |
| AC-5 | | T-9 | T-13 | T-33 |
| AC-6 | T-1 | | | T-34 |
| AC-7 | | | | T-34, T-36 |
| risk: "Warehouse classes" means something other than the Java POJOs | | | | |
| risk: Node 22.13+ node:sqlite not available on the developer's machine | T-2 | | | T-30 |
| risk: Duplicated UI primitives drift from the pipeline web app | | | | T-31, T-32 |
| risk: Vite port conflict between warehouse-ui dev server and pipeline web app dev server | | T-9 | | T-33 |

## Gaps
- Risk "'Warehouse classes' turns out to mean something other than the Java POJOs": this is a requirements question for the issue author, not a behaviour code can prove. It is not testable.
- Risk "Node 22.13+ `node:sqlite` not available": only the success path is tested (T-30). The failure branch ("warehouse-server needs Node 22.13 or later...") cannot be reached on a Node that has `node:sqlite` unless `loadSqlite()` accepts an injected loader. The LLP copies the pipeline's non-injectable function, and this plan does not change the design. It is accepted, low severity, and mirrors the untested pipeline code. If the implementer adds an optional loader argument at no cost, a unit test for the message text would be trivial to add.
- AC-4 "same visual primitives": T-31 checks the class tokens of `Button`, `Card` and `ErrorBox`, and T-5 to T-8 prove the pages use them. Pixel-level visual parity and Tailwind compilation of the classes (Vite build output) are not checked, because there is no visual regression tool in the repo. T-2 only proves that the build succeeds.
- No browser-level end-to-end test (Playwright or similar) is planned. The repo has no browser tooling, and the jsdom journeys (T-5 to T-8) plus the real-server smoke (T-2) cover the behaviour. Real-browser layout, the overlay's visual stacking and keyboard focus are not tested.
- Concurrency (two writers racing on the same VIN) is not tested beyond the DB `UNIQUE` constraint (T-26), because this is a single-user local tool.
- The Java `Vehicle.java` to TypeScript type mirror is not machine-checked. There is no tool to compare them, and `Vehicle.java` is not allowed to change. The column-name check in T-12 is the nearest proxy.

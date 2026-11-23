# Low-level plan: #6 ui for warehouse maintenance

## Overview
The approved high-level plan adds two new npm workspace packages, both under `tools/`, and touches only the root [`package.json`](package.json) among existing files (AC-7).

- `tools/warehouse-server` (`@warehouse/server`): a Fastify 5 REST API that binds to `127.0.0.1`. It stores `Vehicle` rows in its own SQLite file through `node:sqlite`. The structure copies [`tools/bob-pipeline/apps/server`](tools/bob-pipeline/apps/server/src/index.ts). It reuses that package's `loadSqlite()` pattern from [`db.ts`](tools/bob-pipeline/apps/server/src/db.ts), its `@fastify/static` SPA fallback, and its `{ error }` error shape.
- `tools/warehouse-ui` (`@warehouse/ui`): a React 18, Vite 6, Tailwind v4, React Router v6 and React Query v5 SPA. It copies the structure of [`tools/bob-pipeline/apps/web`](tools/bob-pipeline/apps/web/src/main.tsx). The `Button`, `Card` and `ErrorBox` primitives are copied from [`ui.tsx`](tools/bob-pipeline/apps/web/src/components/ui.tsx). The `request()` helper is copied from [`api.ts`](tools/bob-pipeline/apps/web/src/api.ts).

The Java file [`Vehicle.java`](src/main/java/com/neversoft/vehicle/Vehicle.java) is the source of truth for the shape: `id` (long), `make`, `model`, `vin`, `color` (String), `year` (int), `mileage` (long). The Java file is not modified. Its shape is mirrored by hand in TypeScript. The UI keeps its own copy of the type, so it does not import from the server package.

Design decisions the implementer must follow, so nothing is re-decided:
- **Workspaces.** The root `package.json` gains `"workspaces": ["tools/warehouse-server", "tools/warehouse-ui"]`. `tools/bob-pipeline` has its own workspaces and is not listed, so it stays independent. Each new package has its own `typescript` devDependency, so root devDependencies stay empty.
- **tsconfig.** Both new tsconfigs extend `../bob-pipeline/tsconfig.base.json`, which already has the right strict settings, so no base file is created or modified.
- **Ports.** The warehouse server defaults to `4323` (`PORT` env var). The warehouse UI Vite dev server uses `4322` with `strictPort: true`, which avoids clashing with the pipeline's 4321 and 5173. The Vite proxy for `/api` points at `http://127.0.0.1:4323`.
- **Database.** A separate file, `warehouse.sqlite`, lives in `WAREHOUSE_DATA_DIR`, which defaults to `tools/warehouse-server/.data`. That path is already ignored by the root `.gitignore` entry `.data/`. This answers the HLP open question: the warehouse server does not share a database with the pipeline.
- **Scope.** Only `Vehicle` is covered, as the HLP assumes.
- **List query.** The list endpoint paginates and filters on the server. `GET /api/vehicles?q=&page=&pageSize=` returns `{ items, total, page, pageSize }`.
- **Validation.** Hand-written, with no new validation dependency. Errors are generic and carry no stack traces.

## Changes by file

### package.json (modify)
- Add a `workspaces` array listing the two new packages.
- Add scripts `typecheck` (`npm run typecheck --workspaces --if-present`), `build` (`npm run build -w @warehouse/ui`) and `start` (`npm run build && npm run start -w @warehouse/server`).
- Add `test:warehouse` (`npm run test -w @warehouse/server`).
- Leave the existing Java `test` script untouched. Issue #3 also edits this file's `scripts`, so keep every addition purely additive to reduce merge conflicts.
- Covers: AC-6, AC-7

### tools/warehouse-server/package.json (create)
- Name `@warehouse/server`, `private`, `"type": "module"`, `engines.node >=22.13`.
- Scripts: `dev` (`tsx watch src/index.ts`), `start` (`tsx src/index.ts`), `typecheck` (`tsc -p tsconfig.json`), `test` (`tsx --test "src/**/*.test.ts"`).
- Dependencies: `fastify ^5.2.1`, `@fastify/static ^8.1.0`, `tsx ^4.19.2`. These are the same versions as the pipeline server.
- Dev dependencies: `@types/node ^22.10.7`, `typescript ^5.7.3`.
- Covers: AC-2, AC-3, AC-6

### tools/warehouse-server/tsconfig.json (create)
- `extends ../bob-pipeline/tsconfig.base.json`, `types: ["node"]`, `include: ["src"]`.
- Covers: AC-6

### tools/warehouse-server/src/types.ts (create)
- Mirrors `Vehicle.java`.
- Symbols: `Vehicle`, `VehicleInput`, `VehicleList`, `VehicleQuery`
- Covers: AC-3

### tools/warehouse-server/src/validate.ts (create)
- `HttpError` is an `Error` with a `status`.
- `parseVehicleInput(body)` is an allow-list validator. It rejects non-objects and unknown or missing fields, and it ignores a client-supplied `id`. It enforces:
  - `make` and `model`: trimmed, 1–100 characters
  - `vin`: trimmed, 1–64 characters
  - `color`: trimmed, 0–50 characters
  - `year`: safe integer from 1886 to the current year + 1
  - `mileage`: safe integer ≥ 0
- `parseId(raw)` accepts only a positive safe integer. Anything else gives `HttpError(400, "Invalid id")`.
- `parseVehicleQuery(query)`: `q` is trimmed and capped at 100 characters. `page` defaults to 1 and must be ≥ 1. `pageSize` defaults to 10 and must be 1–100. Invalid values give `HttpError(400)`.
- Symbols: `HttpError`, `parseVehicleInput`, `parseId`, `parseVehicleQuery`
- Covers: AC-2

### tools/warehouse-server/src/db.ts (create)
- `WarehouseDb` takes a file path, or `":memory:"` for tests. It calls a local `loadSqlite()` copied from the pipeline server. That function throws "warehouse-server needs Node 22.13 or later for built-in SQLite (you have X)" when `node:sqlite` is missing. The constructor runs `PRAGMA journal_mode = WAL` and then the `CREATE TABLE IF NOT EXISTS` below.
- All SQL uses `?` placeholders. The filter uses `WHERE make LIKE ? ESCAPE '\' OR model LIKE ? ... OR vin ... OR color ...`. The helper `likePattern(q)` escapes `\`, `%` and `_`. Results are ordered by `id`, with `LIMIT ? OFFSET ?` and a `COUNT(*)` query using the same filter.
- A unique-VIN violation (`message` contains `UNIQUE constraint failed`) is rethrown as `DuplicateVinError`.
- Symbols: `WarehouseDb`, `DuplicateVinError`, `loadSqlite`, `likePattern`
- Covers: AC-2, AC-3

### tools/warehouse-server/src/app.ts (create)
- `buildApp(db, opts)` builds the Fastify instance without listening, so it can be tested with `app.inject`.
- Routes:
  - `GET /api/vehicles` returns `VehicleList`.
  - `GET /api/vehicles/:id` returns `Vehicle` or 404.
  - `POST /api/vehicles` returns 201 with the created `Vehicle`.
  - `PUT /api/vehicles/:id` returns the updated `Vehicle` or 404.
  - `DELETE /api/vehicles/:id` returns 204, or 404 when the row is missing.
- Error handler: `HttpError` gives its status with `{ error: message }`. `DuplicateVinError` gives 409 `{ error: "A vehicle with this VIN already exists" }`. Any other 4xx gives `{ error: "Bad request" }`. Anything else is logged server-side and returns 500 `{ error: "Internal server error" }`. No stack traces or SQL text reach clients.
- If `opts.webDist` exists, register `@fastify/static`. The not-found handler returns `{ error: "Not found" }` with 404 for `/api/*` and `index.html` otherwise, matching the pipeline server.
- Symbols: `buildApp`, `BuildAppOptions`
- Covers: AC-2, AC-3

### tools/warehouse-server/src/index.ts (create)
- Entry point. It resolves `WAREHOUSE_DATA_DIR`, defaulting to `../.data` relative to the file via `import.meta.url`, and creates the directory with `fs.mkdirSync(..., { recursive: true })`. It constructs `WarehouseDb(path.join(dir, "warehouse.sqlite"))`.
- It calls `buildApp(db, { webDist: ../../warehouse-ui/dist })`, then `app.listen({ host: "127.0.0.1", port: Number(process.env.PORT ?? 4323) })`. The host is never configurable and never `0.0.0.0`.
- It logs `warehouse-server on http://localhost:<port>`.
- Covers: AC-2, AC-3

### tools/warehouse-server/src/validate.test.ts (create)
- `node:test` unit tests for `parseVehicleInput`, `parseId` and `parseVehicleQuery`.
- Covers: AC-2

### tools/warehouse-server/src/db.test.ts (create)
- Unit tests against `new WarehouseDb(":memory:")`: CRUD round trip; column values match the input; the `q` filter matches make, model, vin and color; LIKE wildcards are treated literally; pagination `total` and `items`; a duplicate VIN throws `DuplicateVinError`.
- Covers: AC-2, AC-3

### tools/warehouse-server/src/app.test.ts (create)
- Smoke and scenario tests using `buildApp(new WarehouseDb(":memory:"))` and `app.inject`.
- Covers the full CRUD lifecycle with status codes, 400 on bad input, 404 on a missing id, 409 on a duplicate VIN, and a generic 500 body.
- Covers: AC-2, AC-3

### tools/warehouse-ui/package.json (create)
- Name `@warehouse/ui`, `private`, `"type": "module"`. Scripts: `dev` (`vite`), `build` (`vite build`), `typecheck` (`tsc -p tsconfig.json`).
- Dependencies, with the same ranges as `tools/bob-pipeline/apps/web/package.json` (AC-1): `@tanstack/react-query ^5.64.1`, `react ^18.3.1`, `react-dom ^18.3.1`, `react-router-dom ^6.28.2`.
- Dev dependencies, same ranges: `@tailwindcss/vite ^4.0.0`, `tailwindcss ^4.0.0`, `@types/react ^18.3.18`, `@types/react-dom ^18.3.5`, `@vitejs/plugin-react ^4.3.4`, `vite ^6.0.7`, plus `typescript ^5.7.3`.
- Excluded from the pipeline web app's list: `@bob-pipeline/shared`, `@dagrejs/dagre`, `@xyflow/react`, `diff`, `react-markdown`, `remark-gfm`, `@tailwindcss/typography` and `@types/diff`.
- Covers: AC-1, AC-6

### tools/warehouse-ui/tsconfig.json (create)
- `extends ../bob-pipeline/tsconfig.base.json`, `jsx: react-jsx`, `lib: [ES2022, DOM, DOM.Iterable]`, `types: ["vite/client"]`, `include: ["src"]`. This matches the pipeline web app.
- Covers: AC-6

### tools/warehouse-ui/vite.config.ts (create)
- Plugins `react()` and `tailwindcss()`.
- `server: { port: 4322, strictPort: true, proxy: { "/api": { target: "http://127.0.0.1:4323", changeOrigin: false } } }`.
- Covers: AC-1, AC-5

### tools/warehouse-ui/index.html (create)
- Copy of the pipeline's `index.html` with title "Warehouse admin" and the same body classes `bg-slate-50 text-slate-900 antialiased`.
- Covers: AC-1, AC-4

### tools/warehouse-ui/src/index.css (create)
- `@import "tailwindcss";` plus the same `:root` font-family rule. No typography plugin.
- Covers: AC-1, AC-4

### tools/warehouse-ui/src/main.tsx (create)
- `QueryClientProvider`, `BrowserRouter` and a `Layout` route wrapping three routes: `/` (`VehicleListPage`), `/vehicles/new` (`VehicleFormPage`) and `/vehicles/:id/edit` (`VehicleFormPage`).
- It copies the `QueryClient` defaults from the pipeline's `main.tsx`.
- Covers: AC-1, AC-4

### tools/warehouse-ui/src/components/Layout.tsx (create)
- Header bar with the title "Warehouse admin" and a link to `/`, plus `<Outlet />` inside `max-w-5xl` main content. It uses the same Tailwind slate palette as the pipeline `Layout`.
- Symbols: `Layout`
- Covers: AC-4

### tools/warehouse-ui/src/components/ui.tsx (create)
- Copies `Button` (variants default, primary, danger and ghost, with identical class strings), `Card` and `ErrorBox` from the pipeline's `ui.tsx`. It leaves out `StatusBadge`, `timeAgo` and `duration`, which depend on pipeline types.
- Symbols: `Button`, `Card`, `ErrorBox`
- Covers: AC-4

### tools/warehouse-ui/src/api.ts (create)
- Copies the `request<T>()` helper and the `api` object. It adds `put` and `del`, handles 204 responses with empty text, and surfaces `{ error }` as `Error.message`.
- Redeclares the `Vehicle`, `VehicleInput` and `VehicleList` types, with a comment that they mirror `tools/warehouse-server/src/types.ts`.
- Hooks (React Query v5) invalidate `["vehicles"]` on every mutation. `useVehicles` uses `placeholderData: keepPreviousData` for stable paging.
- Symbols: `api`, `Vehicle`, `VehicleInput`, `VehicleList`, `VehicleListParams`, `useVehicles`, `useVehicle`, `useCreateVehicle`, `useUpdateVehicle`, `useDeleteVehicle`
- Covers: AC-4, AC-5

### tools/warehouse-ui/src/pages/VehicleListPage.tsx (create)
- Card containing a search input, a vehicles table and Prev/Next controls with a "page X of Y" label. The columns are id, make, model, year, VIN, color and mileage, plus an actions column with an Edit link and a Delete button. A "New vehicle" button links to `/vehicles/new`.
- Search state is `q`, with `page` reset to 1 whenever `q` changes. Page size is fixed at 10. Loading, empty and `ErrorBox` states are all shown.
- Delete confirmation: clicking Delete sets `pendingDelete`. An inline confirmation Card (a fixed overlay) then shows the vehicle's make, model and VIN with Cancel and a danger Confirm button. Confirm calls `useDeleteVehicle` and shows any error in an `ErrorBox`.
- Symbols: `VehicleListPage`
- Covers: AC-4

### tools/warehouse-ui/src/pages/VehicleFormPage.tsx (create)
- One component serves both create and edit. It is in edit mode when the `:id` route param is present, in which case it loads `useVehicle(id)` and pre-fills the form.
- Controlled inputs for make, model, year, vin, color and mileage. Light client-side checks mirror the server rules, but the server is authoritative. Server errors are shown in `ErrorBox`.
- Submit calls `useCreateVehicle` or `useUpdateVehicle`, then navigates to `/`. Cancel is a ghost Button.
- Symbols: `VehicleFormPage`
- Covers: AC-4

## Interfaces

REST API served by `tools/warehouse-server` on `127.0.0.1:4323`:

| Method and path | Request | Response |
|---|---|---|
| `GET /api/vehicles?q=&page=&pageSize=` | query params, all optional | 200 `VehicleList` |
| `GET /api/vehicles/:id` | none | 200 `Vehicle`, 400 or 404 |
| `POST /api/vehicles` | `VehicleInput` JSON | 201 `Vehicle`, 400, 409 |
| `PUT /api/vehicles/:id` | `VehicleInput` JSON | 200 `Vehicle`, 400, 404, 409 |
| `DELETE /api/vehicles/:id` | none | 204, 400, 404 |

Every error body is `{ "error": string }`.

```ts
// tools/warehouse-server/src/types.ts
export interface Vehicle { id: number; make: string; model: string; year: number; vin: string; color: string; mileage: number }
export type VehicleInput = Omit<Vehicle, "id">;
export interface VehicleQuery { q: string; page: number; pageSize: number }
export interface VehicleList { items: Vehicle[]; total: number; page: number; pageSize: number }

// tools/warehouse-server/src/validate.ts
export class HttpError extends Error { constructor(public status: number, message: string) }
export function parseVehicleInput(body: unknown): VehicleInput;
export function parseId(raw: unknown): number;
export function parseVehicleQuery(query: Record<string, unknown>): VehicleQuery;

// tools/warehouse-server/src/db.ts
export class DuplicateVinError extends Error {}
export class WarehouseDb {
  constructor(filename: string);
  listVehicles(query: VehicleQuery): VehicleList;
  getVehicle(id: number): Vehicle | null;
  createVehicle(input: VehicleInput): Vehicle;
  updateVehicle(id: number, input: VehicleInput): Vehicle | null;
  deleteVehicle(id: number): boolean;
}

// tools/warehouse-server/src/app.ts
export interface BuildAppOptions { webDist?: string }
export function buildApp(db: WarehouseDb, opts?: BuildAppOptions): Promise<import("fastify").FastifyInstance>;

// tools/warehouse-ui/src/api.ts
export interface VehicleListParams { q: string; page: number; pageSize: number }
export const api: { get<T>(url: string): Promise<T>; post<T>(url: string, body: unknown): Promise<T>; put<T>(url: string, body: unknown): Promise<T>; del(url: string): Promise<void> };
export function useVehicles(params: VehicleListParams): UseQueryResult<VehicleList>;
export function useVehicle(id: number | undefined): UseQueryResult<Vehicle>;
export function useCreateVehicle(): UseMutationResult<Vehicle, Error, VehicleInput>;
export function useUpdateVehicle(id: number): UseMutationResult<Vehicle, Error, VehicleInput>;
export function useDeleteVehicle(): UseMutationResult<void, Error, number>;
```

## Data and configuration changes
- New SQLite file `warehouse.sqlite` (gitignored through the existing `.data/` rule). It is created on startup with `CREATE TABLE IF NOT EXISTS`, so no migration tooling is needed (AC-3):
  ```sql
  CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL,
    vin TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL,
    mileage INTEGER NOT NULL CHECK (mileage >= 0)
  );
  ```
- Env vars, all optional: `PORT` (default 4323), `WAREHOUSE_DATA_DIR` (default `tools/warehouse-server/.data`), `LOG_LEVEL` (default `warn`).
- Root `package.json`: the `workspaces` array and the scripts listed above. A new root `package-lock.json` is generated by `npm install`. It is a new file, not a modification of an existing one.
- No feature flags.

## Test approach
| Layer | What | Covers |
|---|---|---|
| smoke | `npm run typecheck` at the repo root exits 0 for both packages (the `tsc` run is the AC-6 gate). | AC-6 |
| smoke | `npm run build` produces `tools/warehouse-ui/dist`. `npm run start` serves `/` and `GET /api/vehicles` on `127.0.0.1:4323` and returns `[]` items on a fresh database. | AC-1, AC-2, AC-3 |
| smoke | `app.test.ts`: `buildApp` with an in-memory database responds to all five endpoints with the expected status codes (200, 201, 204, 400, 404, 409). | AC-2 |
| bdd | Scenario in `app.test.ts`: a user creates two vehicles, filters by `q=ford`, pages with `pageSize=1`, edits one with PUT, deletes it, and the list and `total` reflect each step. | AC-2, AC-3, AC-4 |
| component | `VehicleListPage` and `VehicleFormPage` rendering (list, create, edit, delete confirmation) is not testable today because the repo has no UI test runner. Deferred to the test-plan stage. For this issue the UI is gated by `tsc` and `vite build`. | AC-4 |
| unit | `validate.test.ts`: field limits, unknown and missing fields, ignored client `id`, bad ids and bad query params rejected. | AC-2 |
| unit | `db.test.ts`: persisted column values equal the input, LIKE escaping, pagination arithmetic, duplicate VIN, `deleteVehicle` returns false for a missing id, `loadSqlite()` error message. | AC-3 |
| unit | Manual or scripted check of `vite.config.ts`: `server.proxy["/api"].target` is `http://127.0.0.1:4323`, which is not the pipeline's 4321. | AC-5 |
| unit | Root `git status` after implementation shows only `package.json` modified plus new files. | AC-7 |

## Rollout
1. Land the changes in dependency order. Issue #1 (`Vehicle.java`) is already on the base branch. Issue #3, which also edits the root `package.json` scripts, should merge first if possible; otherwise resolve the additive conflict.
2. Implementation order:
   1. Root `package.json` workspaces and scripts.
   2. `tools/warehouse-server`, with its tests.
   3. `tools/warehouse-ui`.
   4. Run `npm install` at the repo root, then `npm run typecheck`, `npm run test:warehouse` and `npm run build`.
3. Nothing is pushed, deployed or enabled by default. The app runs only on demand through `npm run start` or the two `dev` scripts.
4. Backwards compatibility: the existing Java `test` script, the pipeline server and the pipeline web app are unchanged. Rollback is deleting the two directories and reverting the root `package.json`.

## Open questions
- None. Both HLP open questions are resolved here with the HLP's own recommendations. The warehouse server uses its own SQLite file, and only `Vehicle` is scaffolded in this issue.

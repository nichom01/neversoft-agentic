# What has changed: #6 ui for warehouse maintenance

## Summary
Created a standalone warehouse administration tool consisting of a React + Vite single-page application (`tools/warehouse-ui`) and a lightweight Fastify backend (`tools/warehouse-server`). The system provides full CRUD management for warehouse domain entities (starting with `Vehicle`), storing records in a local SQLite database via Node's built-in `node:sqlite`. The tech stack and visual design directly replicate the existing Bob pipeline web application without altering any existing codebase files outside of root workspace registration.

## Changes
| Area | Files | What changed | Why |
|---|---|---|---|
| Workspace & Root Config | [`package.json`](package.json) | Added workspace definitions for `tools/warehouse-server` and `tools/warehouse-ui`, and added additive npm scripts (`test:warehouse`, `typecheck`, `build`, `start`). | Register the new workspace packages and provide uniform lifecycle commands across the monorepo without impacting existing scripts. |
| Backend Configuration & Types | [`tools/warehouse-server/package.json`](tools/warehouse-server/package.json), [`tools/warehouse-server/tsconfig.json`](tools/warehouse-server/tsconfig.json), [`tools/warehouse-server/src/types.ts`](tools/warehouse-server/src/types.ts) | Created the server package manifest, TypeScript configuration extending base settings, and TypeScript data models (`Vehicle`, `VehicleInput`, `VehicleQuery`, `VehicleList`) mirroring `Vehicle.java`. | Establish the `@warehouse/server` package and define typed domain representations. |
| Backend Persistence & Validation | [`tools/warehouse-server/src/validate.ts`](tools/warehouse-server/src/validate.ts), [`tools/warehouse-server/src/db.ts`](tools/warehouse-server/src/db.ts) | Implemented strict allow-list payload validation, route ID parsing, query pagination/filtering validation, and `WarehouseDb` SQLite persistence using `node:sqlite` with parameterised queries and unique VIN conflict detection. | Enforce input sanitisation, prevent SQL injection, and reliably persist vehicle records to SQLite in WAL mode. |
| Backend HTTP API & Entrypoint | [`tools/warehouse-server/src/app.ts`](tools/warehouse-server/src/app.ts), [`tools/warehouse-server/src/index.ts`](tools/warehouse-server/src/index.ts) | Implemented Fastify application factory (`buildApp`) with CRUD REST routes (`GET /api/vehicles`, `GET /api/vehicles/:id`, `POST /api/vehicles`, `PUT /api/vehicles/:id`, `DELETE /api/vehicles/:id`), generic error formatting, static SPA serving, and loopback listener on `127.0.0.1:4323`. | Expose REST endpoints for vehicle maintenance and serve the built UI assets in production while enforcing loopback-only network binding. |
| Backend Tests | [`tools/warehouse-server/src/validate.test.ts`](tools/warehouse-server/src/validate.test.ts), [`tools/warehouse-server/src/db.test.ts`](tools/warehouse-server/src/db.test.ts), [`tools/warehouse-server/src/app.test.ts`](tools/warehouse-server/src/app.test.ts), [`tools/warehouse-server/src/conformance.test.ts`](tools/warehouse-server/src/conformance.test.ts) | Added `node:test` suites covering input validation, DB CRUD operations, pagination, search filtering, LIKE wildcard escaping, HTTP status code contracts, SPA fallbacks, and workspace conformance checks. | Ensure backend correctness, security invariants, and regressions prevention. |
| Frontend Configuration & Shell | [`tools/warehouse-ui/package.json`](tools/warehouse-ui/package.json), [`tools/warehouse-ui/tsconfig.json`](tools/warehouse-ui/tsconfig.json), [`tools/warehouse-ui/vite.config.ts`](tools/warehouse-ui/vite.config.ts), [`tools/warehouse-ui/index.html`](tools/warehouse-ui/index.html), [`tools/warehouse-ui/src/index.css`](tools/warehouse-ui/src/index.css), [`tools/warehouse-ui/src/main.tsx`](tools/warehouse-ui/src/main.tsx) | Created the Vite + React SPA setup with Tailwind CSS v4, React Router v6, React Query v5, dev server proxying `/api` to port 4323, and main router definitions. | Establish the `@warehouse/ui` client matching the Bob pipeline web app stack and configure dev proxying. |
| Frontend Components & API Layer | [`tools/warehouse-ui/src/components/Layout.tsx`](tools/warehouse-ui/src/components/Layout.tsx), [`tools/warehouse-ui/src/components/ui.tsx`](tools/warehouse-ui/src/components/ui.tsx), [`tools/warehouse-ui/src/api.ts`](tools/warehouse-ui/src/api.ts) | Created navigation layout, shared UI primitives (`Button`, `Card`, `ErrorBox`), and REST API client hooks (`useVehicles`, `useVehicle`, `useCreateVehicle`, `useUpdateVehicle`, `useDeleteVehicle`) with query cache invalidation. | Replicate existing UI styling primitives and provide typed data fetching and mutation hooks. |
| Frontend Pages | [`tools/warehouse-ui/src/pages/VehicleListPage.tsx`](tools/warehouse-ui/src/pages/VehicleListPage.tsx), [`tools/warehouse-ui/src/pages/VehicleFormPage.tsx`](tools/warehouse-ui/src/pages/VehicleFormPage.tsx) | Implemented the paginated vehicle table with search filtering and delete confirmation overlay, alongside a unified create/edit vehicle form with client validation. | Provide user-facing CRUD administrative interfaces for managing warehouse vehicles. |
| Frontend Tests | [`tools/warehouse-ui/src/components/ui.test.tsx`](tools/warehouse-ui/src/components/ui.test.tsx), [`tools/warehouse-ui/src/conformance.test.ts`](tools/warehouse-ui/src/conformance.test.ts), [`tools/warehouse-ui/src/devproxy.test.ts`](tools/warehouse-ui/src/devproxy.test.ts), [`tools/warehouse-ui/src/api.test.ts`](tools/warehouse-ui/src/api.test.ts), [`tools/warehouse-ui/src/pages/VehicleListPage.test.tsx`](tools/warehouse-ui/src/pages/VehicleListPage.test.tsx), [`tools/warehouse-ui/src/pages/VehicleFormPage.test.tsx`](tools/warehouse-ui/src/pages/VehicleFormPage.test.tsx), [`tools/warehouse-ui/src/pages/vehicles.journey.test.tsx`](tools/warehouse-ui/src/pages/vehicles.journey.test.tsx) | Added Vitest and React Testing Library tests covering UI primitives, dependency conformance, dev proxy forwarding, API hooks, page state transitions, and end-to-end user journeys. | Validate UI behavior, form validation, error handling, and component rendering without requiring browser automation. |

## Acceptance criteria
| Criterion | Status | Evidence (file, test) |
|---|---|---|
| AC-1 | Met | [`tools/warehouse-ui/package.json`](tools/warehouse-ui/package.json), [`tools/warehouse-ui/src/conformance.test.ts`](tools/warehouse-ui/src/conformance.test.ts:13) (T-32), T-2 |
| AC-2 | Met | [`tools/warehouse-server/src/app.ts`](tools/warehouse-server/src/app.ts), [`tools/warehouse-server/src/index.ts`](tools/warehouse-server/src/index.ts), [`tools/warehouse-server/src/app.test.ts`](tools/warehouse-server/src/app.test.ts:11) (T-3, T-4, T-10, T-11), [`tools/warehouse-server/src/conformance.test.ts`](tools/warehouse-server/src/conformance.test.ts:42) (T-35) |
| AC-3 | Met | [`tools/warehouse-server/src/db.ts`](tools/warehouse-server/src/db.ts), [`tools/warehouse-server/src/db.test.ts`](tools/warehouse-server/src/db.test.ts:22) (T-12, T-22, T-23, T-25, T-26, T-27, T-28, T-29, T-30) |
| AC-4 | Met | [`tools/warehouse-ui/src/pages/VehicleListPage.tsx`](tools/warehouse-ui/src/pages/VehicleListPage.tsx), [`tools/warehouse-ui/src/pages/VehicleFormPage.tsx`](tools/warehouse-ui/src/pages/VehicleFormPage.tsx), [`tools/warehouse-ui/src/components/ui.tsx`](tools/warehouse-ui/src/components/ui.tsx), [`tools/warehouse-ui/src/components/ui.test.tsx`](tools/warehouse-ui/src/components/ui.test.tsx:7) (T-31), [`tools/warehouse-ui/src/pages/VehicleListPage.test.tsx`](tools/warehouse-ui/src/pages/VehicleListPage.test.tsx:32) (T-14), [`tools/warehouse-ui/src/pages/VehicleFormPage.test.tsx`](tools/warehouse-ui/src/pages/VehicleFormPage.test.tsx:39) (T-15), [`tools/warehouse-ui/src/pages/vehicles.journey.test.tsx`](tools/warehouse-ui/src/pages/vehicles.journey.test.tsx:44) (T-5, T-6, T-7, T-8) |
| AC-5 | Met | [`tools/warehouse-ui/vite.config.ts`](tools/warehouse-ui/vite.config.ts), [`tools/warehouse-ui/src/conformance.test.ts`](tools/warehouse-ui/src/conformance.test.ts:70) (T-33), [`tools/warehouse-ui/src/devproxy.test.ts`](tools/warehouse-ui/src/devproxy.test.ts:21) (T-9) |
| AC-6 | Met | [`package.json`](package.json:12), [`tools/warehouse-server/tsconfig.json`](tools/warehouse-server/tsconfig.json), [`tools/warehouse-ui/tsconfig.json`](tools/warehouse-ui/tsconfig.json), (T-1) |
| AC-7 | Met | [`package.json`](package.json:5), [`tools/warehouse-server/src/conformance.test.ts`](tools/warehouse-server/src/conformance.test.ts:12) (T-34, T-36) |

## Tests: planned vs actual
| Test | Layer | Planned | Status | File |
|---|---|---|---|---|
| T-1 | smoke | yes | Created | [`package.json`](package.json:12) |
| T-2 | smoke | yes | Created | [`tools/warehouse-server/src/index.ts`](tools/warehouse-server/src/index.ts) |
| T-3 | bdd | yes | Created | [`tools/warehouse-server/src/app.test.ts`](tools/warehouse-server/src/app.test.ts:11) |
| T-4 | bdd | yes | Created | [`tools/warehouse-server/src/app.test.ts`](tools/warehouse-server/src/app.test.ts:91) |
| T-5 | bdd | yes | Created | [`tools/warehouse-ui/src/pages/vehicles.journey.test.tsx`](tools/warehouse-ui/src/pages/vehicles.journey.test.tsx:44) |
| T-6 | bdd | yes | Created | [`tools/warehouse-ui/src/pages/vehicles.journey.test.tsx`](tools/warehouse-ui/src/pages/vehicles.journey.test.tsx:116) |
| T-7 | bdd | yes | Created | [`tools/warehouse-ui/src/pages/vehicles.journey.test.tsx`](tools/warehouse-ui/src/pages/vehicles.journey.test.tsx:175) |
| T-8 | bdd | yes | Created | [`tools/warehouse-ui/src/pages/vehicles.journey.test.tsx`](tools/warehouse-ui/src/pages/vehicles.journey.test.tsx:244) |
| T-9 | bdd | yes | Created | [`tools/warehouse-ui/src/devproxy.test.ts`](tools/warehouse-ui/src/devproxy.test.ts:21) |
| T-10 | component | yes | Created | [`tools/warehouse-server/src/app.test.ts`](tools/warehouse-server/src/app.test.ts:154) |
| T-11 | component | yes | Created | [`tools/warehouse-server/src/app.test.ts`](tools/warehouse-server/src/app.test.ts:247) |
| T-12 | component | yes | Created | [`tools/warehouse-server/src/db.test.ts`](tools/warehouse-server/src/db.test.ts:22) |
| T-13 | component | yes | Created | [`tools/warehouse-ui/src/api.test.ts`](tools/warehouse-ui/src/api.test.ts:34) |
| T-14 | component | yes | Created | [`tools/warehouse-ui/src/pages/VehicleListPage.test.tsx`](tools/warehouse-ui/src/pages/VehicleListPage.test.tsx:32) |
| T-15 | component | yes | Created | [`tools/warehouse-ui/src/pages/VehicleFormPage.test.tsx`](tools/warehouse-ui/src/pages/VehicleFormPage.test.tsx:39) |
| T-16 | unit | yes | Created | [`tools/warehouse-server/src/validate.test.ts`](tools/warehouse-server/src/validate.test.ts:7) |
| T-17 | unit | yes | Created | [`tools/warehouse-server/src/validate.test.ts`](tools/warehouse-server/src/validate.test.ts:30) |
| T-18 | unit | yes | Created | [`tools/warehouse-server/src/validate.test.ts`](tools/warehouse-server/src/validate.test.ts:80) |
| T-19 | unit | yes | Created | [`tools/warehouse-server/src/validate.test.ts`](tools/warehouse-server/src/validate.test.ts:115) |
| T-20 | unit | yes | Created | [`tools/warehouse-server/src/validate.test.ts`](tools/warehouse-server/src/validate.test.ts:140) |
| T-21 | unit | yes | Created | [`tools/warehouse-server/src/validate.test.ts`](tools/warehouse-server/src/validate.test.ts:157) |
| T-22 | unit | yes | Created | [`tools/warehouse-server/src/db.test.ts`](tools/warehouse-server/src/db.test.ts:84) |
| T-23 | unit | yes | Created | [`tools/warehouse-server/src/db.test.ts`](tools/warehouse-server/src/db.test.ts:129) |
| T-24 | unit | yes | Created | [`tools/warehouse-server/src/db.test.ts`](tools/warehouse-server/src/db.test.ts:147) |
| T-25 | unit | yes | Created | [`tools/warehouse-server/src/db.test.ts`](tools/warehouse-server/src/db.test.ts:184) |
| T-26 | unit | yes | Created | [`tools/warehouse-server/src/db.test.ts`](tools/warehouse-server/src/db.test.ts:202) |
| T-27 | unit | yes | Created | [`tools/warehouse-server/src/db.test.ts`](tools/warehouse-server/src/db.test.ts:225) |
| T-28 | unit | yes | Created | [`tools/warehouse-server/src/db.test.ts`](tools/warehouse-server/src/db.test.ts:236) |
| T-29 | unit | yes | Created | [`tools/warehouse-server/src/db.test.ts`](tools/warehouse-server/src/db.test.ts:254) |
| T-30 | unit | yes | Created | [`tools/warehouse-server/src/db.test.ts`](tools/warehouse-server/src/db.test.ts:10) |
| T-31 | unit | yes | Created | [`tools/warehouse-ui/src/components/ui.test.tsx`](tools/warehouse-ui/src/components/ui.test.tsx:7) |
| T-32 | unit | yes | Created | [`tools/warehouse-ui/src/conformance.test.ts`](tools/warehouse-ui/src/conformance.test.ts:13) |
| T-33 | unit | yes | Created | [`tools/warehouse-ui/src/conformance.test.ts`](tools/warehouse-ui/src/conformance.test.ts:70) |
| T-34 | unit | yes | Created | [`tools/warehouse-server/src/conformance.test.ts`](tools/warehouse-server/src/conformance.test.ts:12) |
| T-35 | unit | yes | Created | [`tools/warehouse-server/src/conformance.test.ts`](tools/warehouse-server/src/conformance.test.ts:42) |
| T-36 | unit | yes | Created | [`tools/warehouse-server/src/conformance.test.ts`](tools/warehouse-server/src/conformance.test.ts:12) |

## Deviations from the plan
- `package.json` script `test:warehouse`: The low-level plan specified `npm run test -w @warehouse/server`. As approved during test planning, this was updated to `npm run test --workspaces --if-present` so that tests in both `@warehouse/server` and `@warehouse/ui` run uniformly.
- UI Test Tooling: The low-level plan deferred frontend test runner selection to the test planning phase. `tools/warehouse-ui/package.json` includes Vitest, jsdom, and React Testing Library devDependencies to execute the approved component and journey tests.

## Risks and things reviewers should check
- **Loopback binding:** Verify that [`tools/warehouse-server/src/index.ts`](tools/warehouse-server/src/index.ts) binds exclusively to `127.0.0.1` and does not permit binding to `0.0.0.0` or configurable host environment variables.
- **Information disclosure in error handling:** Confirm that [`tools/warehouse-server/src/app.ts`](tools/warehouse-server/src/app.ts) sanitises all unexpected server errors into generic messages (`{"error": "Internal server error"}`) without exposing database statements or stack traces.
- **Vite dev proxy port alignment:** Ensure the proxy configuration in [`tools/warehouse-ui/vite.config.ts`](tools/warehouse-ui/vite.config.ts) targets `http://127.0.0.1:4323` and avoids port clashes with the Bob pipeline apps.

## Follow-ups
- None

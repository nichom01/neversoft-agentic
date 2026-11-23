# High-level plan: #6 ui for warehouse maintenance

## Summary
Build a standalone warehouse admin UI — a new React + Vite single-page application in the same tech stack as the existing Bob pipeline web app — that provides CRUD screens for the domain-model classes that exist in the Java source tree (starting with `Vehicle`, plus any further classes added by later issues).

## Approach
The existing Bob pipeline web app (`tools/bob-pipeline/apps/web`) uses React 18, React Router v6, React Query v5, Tailwind CSS v4, and Vite. The request is to create a sibling SPA (`tools/warehouse-ui`) that follows the same stack and conventions. A lightweight Fastify REST server (`tools/warehouse-server`) sits alongside it, persisting warehouse entities to a local SQLite database using Node's built-in `node:sqlite` (consistent with the pipeline server). The two new packages are added to the existing monorepo under `tools/`. No change is made to the pipeline server, the pipeline web app, or the existing Java source files. The domain shapes exposed by the REST API mirror the Java POJO fields currently in `Vehicle.java`; additional entity types are added in follow-up issues as the Java source tree grows.

## Alternatives considered
- Extend the existing pipeline web app with warehouse pages — rejected: the pipeline UI is tightly coupled to the Bob pipeline domain; mixing warehouse admin into it conflates unrelated concerns and makes both harder to navigate.
- Use a full Spring Boot or Quarkus backend — rejected: adds a build system and runtime dependency not present in the repo; the pipeline server already proves Node + Fastify + SQLite is sufficient for a local admin tool.
- Generate a UI from the Java classes via reflection — rejected: no build system exists; the Java classes are compiled independently and there is no JVM process running to reflect against.

## Components affected
- `tools/warehouse-server` — new Fastify REST API server: CRUD endpoints for each warehouse entity; SQLite persistence via `node:sqlite`; serves the built SPA as static files
- `tools/warehouse-ui` — new React SPA: list, create, edit, delete screens per entity type; shared primitive UI components (Button, Card, ErrorBox) copied from the pipeline web app
- `tools/bob-pipeline/packages/shared` — no change required; warehouse entity types live in a new `tools/warehouse-server/src/types.ts` rather than polluting the pipeline shared package
- `src/main/java/com/neversoft/vehicle/Vehicle.java` — not modified; it remains the canonical definition of the Vehicle domain shape which the warehouse server mirrors in TypeScript types

## Acceptance criteria
- AC-1: A new npm workspace package `tools/warehouse-ui` exists, built with Vite + React 18 + Tailwind CSS v4 + React Router v6 + React Query v5, matching the dependency versions in `tools/bob-pipeline/apps/web/package.json`.
- AC-2: A new npm workspace package `tools/warehouse-server` exists with a Fastify server that listens on `127.0.0.1` and serves CRUD REST endpoints (`GET /api/vehicles`, `GET /api/vehicles/:id`, `POST /api/vehicles`, `PUT /api/vehicles/:id`, `DELETE /api/vehicles/:id`).
- AC-3: The warehouse server persists Vehicle records to a local SQLite database using `node:sqlite` (Node 22.13+), with columns matching the fields of `Vehicle.java` (`id`, `make`, `model`, `year`, `vin`, `color`, `mileage`).
- AC-4: The warehouse UI displays a paginated/filterable list of vehicles, a create form, an edit form, and a delete confirmation, all using the same visual primitives (Card, Button, Tailwind classes) as the pipeline web app.
- AC-5: The warehouse UI's Vite dev server proxies `/api` requests to the warehouse server (not the pipeline server).
- AC-6: `npm run typecheck` passes with zero errors in both new packages.
- AC-7: No existing file in the repository is modified except for the root `package.json` (or the monorepo workspace config) to register the new packages.

## Dependencies on other issues
- None known

## Assumptions
- The phrase "same tech stack as the sales orders" refers to the Bob pipeline web app (`tools/bob-pipeline/apps/web`), which is the only existing UI in the repository.
- "Other warehouse classes" are the Java domain POJOs in `src/main/java/`; `Vehicle` (issue #1) is the only class currently present, so it is the first entity type the admin UI covers.
- Additional entity types (if future issues add more Java classes) will be added in follow-up issues; the architecture only needs to accommodate one entity type now.
- The warehouse admin UI is a local developer tool, like the pipeline UI; it needs no authentication beyond what the developer's workstation provides.
- The root-level monorepo is managed via npm workspaces (the existing `tools/bob-pipeline` structure already uses this pattern).

## Risks
| Risk | Severity | Mitigation |
|---|---|---|
| "Warehouse classes" turns out to mean something other than the Java POJOs in `src/` | medium | Confirm with the issue author; the plan is easy to pivot if the target entities differ. |
| Node 22.13+ `node:sqlite` not available on the developer's machine | low | Mirror the pipeline server's existing approach: check at startup and emit a clear error message. |
| Duplicated UI primitives drift from the pipeline web app over time | low | Extract shared components to a new `tools/bob-pipeline/packages/ui` package in a future cleanup; out of scope here. |
| Vite port conflict between warehouse-ui dev server and pipeline web app dev server | low | Use a distinct default port (e.g. 4322) in `vite.config.ts`. |

## Open questions
- Should the warehouse server share the same SQLite database file as the pipeline server, or use its own? (Recommendation: its own, to keep concerns separated and avoid schema coupling.)
- Are there other domain entity types beyond `Vehicle` that should be scaffolded in this issue, or should only `Vehicle` be covered now?

## Complexity
M — two new packages (server + UI) with standard CRUD structure, but all within an already-established tech stack and consistent with existing patterns in the repo.

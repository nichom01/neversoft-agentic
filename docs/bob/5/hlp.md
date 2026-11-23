# High-level plan: #5 ui for sales orders

## Summary
Add a standalone React single-page app that lets a user create sales orders and add sales order lines to them, plus a README explaining how to run it locally.

## Approach
Create a new self-contained Vite + React + TypeScript project in its own top-level directory (`sales-orders-ui/`). It has one page with an order header form (customer, order date), a line-entry form (product/description, quantity, unit price), a lines table with computed line totals and an order total, and a list of created orders. There is no backend in the repo, so state is held client-side in React state (optionally persisted to `localStorage`) behind a small data module, so a real API can be swapped in later. The project has its own `package.json` and `README.md`; the root `package.json` (Java `javac` test script) and the Java sources are left untouched. This mirrors the existing React + Vite conventions in `tools/bob-pipeline/apps/web`, without coupling to that tool's npm workspace.

## Alternatives considered
- Add the UI inside `tools/bob-pipeline/apps/web` — rejected: that is pipeline tooling, unrelated to the sales domain.
- Build a backend (Spring/Node) and REST API as well — rejected: not requested; the issue asks for a UI page and a startup README only.
- Put the React app at the repo root and merge with the root `package.json` — rejected: the root `package.json` drives the Java test and mixing would risk breaking `npm test`.
- Plain HTML or a Create React App template — rejected: the issue asks for React, and CRA is deprecated; Vite is already used in this repo.

## Components affected
- `sales-orders-ui` (new) — Vite/React/TypeScript project: config, entry point, order page, order and line components, and a data/state module.
- `sales-orders-ui/README.md` (new) — prerequisites, install, run, build and where state is stored.
- Root repo — only `.gitignore` is possibly relevant (already ignores `node_modules/` and `dist/`); no other existing component changes.

## Acceptance criteria
- AC-1: A new React project exists in `sales-orders-ui/` and starts locally with `npm install` followed by `npm run dev`.
- AC-2: The page lets the user create a sales order with at least a customer name and order date, with validation that rejects empty required fields.
- AC-3: The user can add one or more sales order lines to an order, each with description/product, quantity (>0) and unit price (>=0), and can remove a line.
- AC-4: Each line shows its computed total, and the order shows the sum of its line totals.
- AC-5: Created orders and their lines are visible on the page after creation, and orders can be selected to add or view lines.
- AC-6: `npm run build` and the TypeScript typecheck complete with no errors in `sales-orders-ui/`.
- AC-7: `sales-orders-ui/README.md` documents prerequisites (Node version), install, run (dev server URL), build and the data-persistence behaviour in steps that work from a clean checkout.
- AC-8: No existing files are modified, and the root Java `npm test` still passes.

## Dependencies on other issues
- None known

## Assumptions
- "Generate" means create via a form, not auto-generate random data.
- No backend or API exists or is wanted; data is client-side only.
- Stack is React with TypeScript and Vite, using current stable, actively maintained versions.
- The README is `sales-orders-ui/README.md`, not a root README, to avoid implying it describes the Java code.
- Fields are provisional: order (id, customer, date, lines) and line (id, description, quantity, unit price).
- Styling is minimal, plain CSS with no UI library, in keeping with the minimal-change rule.

## Risks
| Risk | Severity | Mitigation |
|---|---|---|
| Author expected a backend or persistence beyond the browser | medium | State the client-side-only scope in the README and PR; isolate data access in one module so an API can replace it. |
| Chosen directory or name differs from the author's expectation | low | Self-contained directory; easy to move or rename. |
| Root `package.json` or Java test affected by the new project | low | Keep the project fully separate; do not edit root files; confirm `npm test` still passes. |
| Dependency vulnerabilities or EOL packages | medium | Use latest stable React and Vite, commit a lockfile and run `npm audit`. |
| Invalid numeric input (negative or NaN quantity or price) | low | Validate on the client before adding a line; reject invalid values. |

## Open questions
- Should orders persist (localStorage) or reset on refresh? Plan assumes persistence in `localStorage` is acceptable but optional.
- Is a backend API planned for which the UI should be shaped (field names, currency)?

## Complexity
M — new project scaffold with several components and form validation, but no backend or existing code integration.

# Test plan: #5 ui for sales orders

## Summary
22 tests: 2 smoke, 7 BDD, 5 component, 8 unit. The repo has no JS test framework today (the only test is the Java `VehicleTest`, and `tools/bob-pipeline/apps/web` has none), so the plan uses **Vitest + React Testing Library + jsdom** inside `sales-orders-ui/`, which fits the Vite toolchain the project already uses. Nearly all behaviour is proved at the unit and component layers (pure helpers in `storage.ts`, forms, list and detail components). BDD scenarios render the whole `App` in jsdom to prove each user-visible acceptance criterion. Smoke is limited to shell checks of install, typecheck, build, dev server and the unchanged root Java test.

**Prerequisite the LLP does not list:** `sales-orders-ui/package.json` needs a `test` script and devDependencies `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event` and `@testing-library/jest-dom`, plus a Vitest `test` block (`environment: 'jsdom'`, `setupFiles`) in `vite.config.ts`. This is test tooling inside the new project only, so it does not touch existing files (AC-8).

Test locations (all new, inside `sales-orders-ui/`):
- `tests/smoke/smoke.sh`: shell smoke checks.
- `src/__tests__/features/*.test.tsx`: BDD scenarios (Given/When/Then written as nested `describe`/`it` names).
- `src/components/__tests__/*.test.tsx`: component tests.
- `src/__tests__/storage.test.ts`, `src/__tests__/project.test.ts`: unit tests.

## Smoke
### T-1: Clean install, typecheck, build and dev server start
- Target: `sales-orders-ui/tests/smoke/smoke.sh`. It runs `npm ci` (or `npm install`), `npm run typecheck`, `npm run build`, then starts `npm run dev`, polls `http://localhost:5173/` until it returns HTTP 200 with `id="root"` in the body, and stops the server.
- Why this layer: only a real shell run proves a clean checkout installs, compiles, bundles and serves. Lower layers run inside Vitest and never exercise the Vite CLI.
- Covers: AC-1, AC-6

### T-2: Root Java test still passes and nothing existing is modified
- Target: `sales-orders-ui/tests/smoke/smoke.sh` (second stage). It runs `npm test` at the repo root, then `git diff --name-status <base>` and fails if any entry is not an addition (`A`) under `sales-orders-ui/` or `docs/bob/5/`.
- Why this layer: AC-8 is a repo-wide property that no in-project test can see. It needs the root `npm test` and git.
- Covers: AC-8, risk: Root `package.json` or Java test affected by the new project

## BDD
All BDD tests live in `sales-orders-ui/src/__tests__/features/` and render `<App />` with a clean `localStorage` (cleared in `beforeEach`).

### T-3: Create a sales order and see it listed
```gherkin
Given the sales orders page is open with no orders
When the user enters customer name "Acme Ltd" and order date "2025-01-15" and submits the order form
Then the order list shows an order for "Acme Ltd" dated "2025-01-15" with 0 lines and total 0.00
And the new order is selected so its detail view is shown
```
- Target: `sales-orders-ui/src/__tests__/features/create-order.test.tsx`
- Why this layer: this is the primary user journey and spans the `OrderForm`, `App` state and `OrderList`. Only a full render proves the pieces are wired together.
- Covers: AC-2, AC-5

### T-4: Empty required order fields are rejected
```gherkin
Given the sales orders page is open
When the user submits the order form with an empty customer name
Then a validation error is shown for customer name and no order is added
When the user submits the order form with customer name "Acme Ltd" and an empty order date
Then a validation error is shown for order date and no order is added
```
- Target: `sales-orders-ui/src/__tests__/features/create-order.test.tsx`
- Why this layer: AC-2 is phrased as a user-visible rejection. Per-field rules are covered at T-10, so this only proves the error reaches the user and `App` state stays unchanged.
- Covers: AC-2

### T-5: Add lines and see line totals and order total
```gherkin
Given an order for "Acme Ltd" is selected
When the user adds a line "Widget" with quantity 2 and unit price 10.50
And the user adds a line "Gadget" with quantity 3 and unit price 4.00
Then the lines table shows "Widget" with total 21.00 and "Gadget" with total 12.00
And the order total shows 33.00
And the order list shows the order with 2 lines and total 33.00
```
- Target: `sales-orders-ui/src/__tests__/features/order-lines.test.tsx`
- Why this layer: the total shown must be consistent across `OrderDetail`, `OrderList` and `App` state after several adds. That cross-component consistency is only visible with the full render.
- Covers: AC-3, AC-4, AC-5

### T-6: Invalid lines are rejected
```gherkin
Given an order for "Acme Ltd" is selected
When the user submits a line with quantity 0
Or with quantity -1
Or with unit price -5
Or with an empty description
Then a validation error is shown and no line is added
And the order total is unchanged
When the user submits a line with quantity 1 and unit price 0
Then the line is added with total 0.00
```
- Target: `sales-orders-ui/src/__tests__/features/order-lines.test.tsx`
- Why this layer: the user-visible outcome (error shown, total not corrupted) needs the whole page. The boundary values are proved at T-11. Written as a scenario outline with an Examples table.
- Covers: AC-3, risk: Invalid numeric input (negative or NaN quantity or price)

### T-7: Remove a line
```gherkin
Given an order has lines "Widget" (21.00) and "Gadget" (12.00) with total 33.00
When the user removes the "Widget" line
Then only "Gadget" remains in the lines table
And the order total shows 12.00
And the order list shows the order with 1 line and total 12.00
```
- Target: `sales-orders-ui/src/__tests__/features/order-lines.test.tsx`
- Why this layer: removal must flow from `OrderDetail` through `App` state to the totals shown in `OrderList`, and this behaviour spans components.
- Covers: AC-3, AC-4

### T-8: Select between orders to view their lines
```gherkin
Given orders "Acme Ltd" (line "Widget") and "Globex" (line "Gizmo") exist
When the user selects "Globex" in the order list
Then the detail view shows "Globex" with line "Gizmo" and not "Widget"
When the user selects "Acme Ltd"
Then the detail view shows "Acme Ltd" with line "Widget"
And a line added now goes to "Acme Ltd" only
```
- Target: `sales-orders-ui/src/__tests__/features/select-order.test.tsx`
- Why this layer: selection state lives in `App`. The last step proves lines are attached to the selected order and not the most recent one, which no single component can show.
- Covers: AC-5

### T-9: Orders survive a page reload
```gherkin
Given the user has created an order "Acme Ltd" with a line "Widget"
When the page is reloaded (App unmounted and mounted again with the same localStorage)
Then the order list still shows "Acme Ltd" with its line "Widget" and the same totals
```
- Target: `sales-orders-ui/src/__tests__/features/persistence.test.tsx`
- Why this layer: persistence is a user-visible promise that the README (AC-7) documents. It needs `App` to load from storage on mount and save on change.
- Covers: AC-5, AC-7, risk: Author expected a backend or persistence beyond the browser

## Component
Component tests live in `sales-orders-ui/src/components/__tests__/` and render one component with mocked callbacks (`vi.fn()`). `T-14` uses the real jsdom `localStorage`.

### T-10: `OrderForm` validation and submit contract
- Target: `sales-orders-ui/src/components/__tests__/OrderForm.test.tsx`
- Checks:
  - An empty customer name is rejected.
  - A whitespace-only customer name is rejected.
  - An empty date is rejected.
  - Errors are shown next to the fields, and `onCreateOrder` is not called.
  - A valid submit calls `onCreateOrder` once with `{ customerName, orderDate }`, trimmed.
  - The form resets after a valid submit.
- Why this layer: the component's props contract (`OrderFormProps.onCreateOrder`) and its error rendering are the boundary the plan adds. Testing it directly is faster and more precise than going through `App`.
- Covers: AC-2

### T-11: `OrderLineForm` validation and submit contract
- Target: `sales-orders-ui/src/components/__tests__/OrderLineForm.test.tsx`
- Checks:
  - A blank or whitespace-only description is rejected.
  - Quantity 0, negative quantity, empty quantity and non-numeric quantity are rejected.
  - Negative unit price, empty unit price and non-numeric unit price are rejected.
  - Unit price 0 and quantity 1 are accepted, as is a fractional price such as 9.99.
  - `onAddLine` receives numbers, not strings.
  - It is never called with `NaN`.
  - The form resets after a valid submit.
- Why this layer: this holds the boundary rules (quantity > 0, unit price >= 0) and the NaN risk. It is a presentation boundary, so a component test with real events is the lowest layer that can prove it.
- Covers: AC-3, risk: Invalid numeric input (negative or NaN quantity or price)

### T-12: `OrderList` rendering and selection
- Target: `sales-orders-ui/src/components/__tests__/OrderList.test.tsx`
- Checks:
  - An empty `orders` array shows an empty-state message.
  - Each order shows customer, date, line count and total.
  - Clicking an order calls `onSelectOrder` with that order's id.
  - The order matching `selectedOrderId` is marked selected (for example `aria-current` or a class).
- Why this layer: verifies the `OrderListProps` contract (`orders`, `selectedOrderId`, `onSelectOrder`) in isolation.
- Covers: AC-5

### T-13: `OrderDetail` lines table, totals and remove trigger
- Target: `sales-orders-ui/src/components/__tests__/OrderDetail.test.tsx`
- Checks:
  - Each line shows description, quantity, unit price and line total.
  - The order total is shown.
  - An order with no lines shows an empty-state message and a total of 0.00.
  - Clicking remove on a line calls `onRemoveLine` with that line's id.
  - Submitting the embedded line form calls `onAddLine`.
  - Money is formatted to 2 decimals.
- Why this layer: verifies the `OrderDetailProps` contract and the display of computed values, without the cost of full `App` state.
- Covers: AC-3, AC-4, AC-5

### T-14: `storage.ts` against the real `localStorage` boundary
- Target: `sales-orders-ui/src/__tests__/storage.localstorage.test.ts`
- Checks:
  - `saveOrders` writes JSON under the key `sales_orders_v1`.
  - `loadOrders` returns exactly what was saved, including nested lines and totals (round trip).
  - With nothing stored, `loadOrders` returns `[]`.
- Why this layer: this is the one external boundary the plan introduces (browser storage and its key name). The test uses jsdom's real `localStorage` instead of a mock, so a wrong key or serialisation bug is caught. A mock-based failure test is in T-20.
- Covers: AC-5, risk: Author expected a backend or persistence beyond the browser

## Unit
Unit tests are pure Vitest with no DOM, in `sales-orders-ui/src/__tests__/storage.test.ts` unless stated.

### T-15: `calculateLineTotal`
- Target: `sales-orders-ui/src/__tests__/storage.test.ts`
- Cases:
  - 2 × 10.50 = 21
  - 1 × 0 = 0
  - 3 × 0.1 = 0.3 (no float artefact such as 0.30000000000000004)
  - 3 × 19.99 = 59.97
  - A large quantity, for example 1,000,000 × 99.99
  - Result rounded to 2 decimals
- Why this layer: pure arithmetic with float-precision edge cases, where the LLP explicitly calls out "precision rounding".
- Covers: AC-4

### T-16: `calculateOrderTotal`
- Target: `sales-orders-ui/src/__tests__/storage.test.ts`
- Cases:
  - An empty lines array gives 0.
  - A single line gives its total.
  - Several lines give their sum.
  - A sum that would otherwise show float drift (0.1 + 0.2) gives 0.3.
  - Lines with total 0 are included without error.
- Why this layer: the pure sum logic behind the order total.
- Covers: AC-4

### T-17: `createOrder`
- Target: `sales-orders-ui/src/__tests__/storage.test.ts`
- Cases:
  - Returns an order with the given customer name and date.
  - `lines` is `[]` and `total` is 0.
  - Id is non-empty.
  - Two calls give different ids.
  - The input object is not mutated.
- Why this layer: pure construction logic and id uniqueness, which the UI relies on for selection and keys.
- Covers: AC-2, AC-5

### T-18: `addLineToOrder`
- Target: `sales-orders-ui/src/__tests__/storage.test.ts`
- Cases:
  - Appends a line with description, quantity and unit price from the input.
  - The line `total` equals `calculateLineTotal`.
  - The order `total` is recomputed to include the new line.
  - Each added line gets a unique id.
  - Existing lines keep their order.
  - The original order object and its `lines` array are not mutated (a new object is returned).
- Why this layer: state-transition logic with immutability, which React rendering depends on. It is pure, so it needs no DOM.
- Covers: AC-3, AC-4

### T-19: `removeLineFromOrder`
- Target: `sales-orders-ui/src/__tests__/storage.test.ts`
- Cases:
  - Removes only the line with the given id.
  - The order total is recomputed.
  - Removing the last line gives total 0.
  - An unknown line id leaves lines and total unchanged.
  - The original order is not mutated.
- Why this layer: pure state transition with an unknown-id edge case.
- Covers: AC-3, AC-4

### T-20: `loadOrders` / `saveOrders` failure handling
- Target: `sales-orders-ui/src/__tests__/storage.failure.test.ts`
- Cases:
  - Corrupt JSON in the key makes `loadOrders` return `[]` without throwing.
  - Valid JSON of the wrong shape (an object, a string, or orders missing `lines`) makes `loadOrders` return `[]`.
  - `localStorage.setItem` throwing (quota or private mode) makes `saveOrders` not throw.
  - `localStorage.getItem` throwing makes `loadOrders` return `[]`.
- Why this layer: the LLP promises "safe fallbacks". Failures are hard to force through the UI, so a unit test with a stubbed `localStorage` is the cheapest proof. Without it, the page could white-screen on bad data.
- Covers: AC-5, risk: Author expected a backend or persistence beyond the browser

### T-21: README content check
- Target: `sales-orders-ui/src/__tests__/project.test.ts` (reads `sales-orders-ui/README.md` and `package.json` from disk)
- Checks:
  - The README exists.
  - It states a Node.js version.
  - It contains `npm install`, `npm run dev`, `npm run build`, `npm run typecheck` and the URL `http://localhost:5173`.
  - It mentions `localStorage` and states that data is client-side only (no backend).
  - Every `npm run <script>` named in the README exists in `package.json` `scripts`.
  - The Node version in the README is consistent with `engines.node` in `package.json`, if one is declared.
- Why this layer: the README is a static file, so reading it in a fast unit test avoids a manual review. The step-by-step run from a clean checkout is proved at T-1. The Node version check matters because the LLP says "Node.js 18+", while current Vite releases require a newer Node.
- Covers: AC-7, risk: Author expected a backend or persistence beyond the browser

### T-22: Project configuration and dependency hygiene
- Target: `sales-orders-ui/src/__tests__/project.test.ts`
- Checks:
  - `package.json` defines `dev`, `build`, `typecheck` and `test` scripts.
  - `react`, `react-dom` and `vite` are present.
  - `tsconfig.json` has `"strict": true`.
  - `package-lock.json` exists.
  - `index.html` contains `id="root"` and a script reference to `/src/main.tsx`.
  - Root `package.json` is not referenced by the project (no `workspaces` entry).
- Why this layer: static config checks that are cheap to run on every `npm test`. Actual compile and bundle success is proved at T-1.
- Covers: AC-1, AC-6, risk: Dependency vulnerabilities or EOL packages

## Coverage
| Criterion / risk | Smoke | BDD | Component | Unit |
|---|---|---|---|---|
| AC-1 | T-1 | | | T-22 |
| AC-2 | | T-3, T-4 | T-10 | T-17 |
| AC-3 | | T-5, T-6, T-7 | T-11, T-13 | T-18, T-19 |
| AC-4 | | T-5, T-7 | T-13 | T-15, T-16, T-18, T-19 |
| AC-5 | | T-3, T-5, T-8, T-9 | T-12, T-13, T-14 | T-17, T-20 |
| AC-6 | T-1 | | | T-22 |
| AC-7 | | T-9 | | T-21 |
| AC-8 | T-2 | | | |
| risk: Author expected a backend or persistence beyond the browser | | T-9 | T-14 | T-20, T-21 |
| risk: Chosen directory or name differs from the author's expectation | | | | |
| risk: Root `package.json` or Java test affected by the new project | T-2 | | | |
| risk: Dependency vulnerabilities or EOL packages | | | | T-22 |
| risk: Invalid numeric input (negative or NaN quantity or price) | | T-6 | T-11 | |

## Gaps
- Risk "Chosen directory or name differs from the author's expectation": a product decision with no observable behaviour to test.
- Risk "Dependency vulnerabilities or EOL packages": T-22 only checks that a lockfile and the expected packages exist. `npm audit` needs network access and its results change over time, so it is run as a CI/manual step on the PR rather than as an automated test.
- AC-7 "steps that work from a clean checkout": the steps are executed by T-1 and the README text is checked by T-21. Whether the prose is clear is left to human review.
- No real-browser end-to-end tests (Playwright or Cypress): neither is in the repo, and jsdom covers all behaviour in the ACs. Layout and CSS (`index.css`) are not tested and need a visual check.
- Behaviour of `addLineToOrder` when passed invalid input (quantity <= 0 and so on) is not specified in the LLP. Validation is tested in the forms (T-10, T-11) and not in the helpers. If the implementation adds guards in the helpers, add cases to T-18.
- Currency formatting beyond two decimals and locale handling: out of scope per the HLP (currency is an open question).
- Test tooling (vitest, jsdom, `@testing-library/*`, a `test` script and Vitest config) is not listed in the LLP and must be added to `sales-orders-ui/package.json` and `vite.config.ts`. It stays inside the new project, so AC-8 is unaffected.


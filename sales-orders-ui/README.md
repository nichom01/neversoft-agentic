# Sales Orders UI

A client-side React page for creating sales orders and their order lines.

- Create a sales order (customer name and order date).
- Add and remove order lines (description, quantity, unit price).
- Line totals and the order total are calculated as you go.
- Select any order in the list to view and edit its lines.

## Prerequisites

- Node.js 22.12 or newer (required by the current Vite and Vitest releases)
- npm (bundled with Node.js)

## Run locally

From the repository root:

```sh
cd sales-orders-ui
npm install
npm run dev
```

Then open <http://localhost:5173> in your browser.

## Other commands

| Command | What it does |
|---|---|
| `npm run build` | Bundles the app for production into `dist/` |
| `npm run typecheck` | Runs the TypeScript compiler without emitting files |
| `npm test` | Runs the unit, component and BDD tests with Vitest |

## Data storage

This app is client-side only. There is no backend or API. Orders are saved in your
browser's `localStorage` under the key `sales_orders_v1`, so they survive a page
reload but exist only in that browser. Clearing site data removes them.

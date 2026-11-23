# Low-level plan: #5 ui for sales orders

## Overview
Implement a standalone Vite + React + TypeScript single-page application in `sales-orders-ui/`. The app allows users to create sales order headers (customer name, order date) with input validation, add and remove order lines (description, quantity > 0, unit price >= 0), compute line totals and order totals in real time, view created orders, and persist state in `localStorage` behind an isolated storage/data module. A dedicated `sales-orders-ui/README.md` documents local development prerequisites, installation, running the Vite development server, and building the project. No existing workspace files or Java tests are touched.

## Changes by file
### sales-orders-ui/package.json (create)
- Project manifest defining dependencies (`react`, `react-dom`), dev dependencies (`typescript`, `vite`, `@vitejs/plugin-react`, `@types/react`, `@types/react-dom`), and scripts (`dev`, `build`, `typecheck`).
- Symbols: `package.json`
- Covers: AC-1, AC-6, AC-8

### sales-orders-ui/tsconfig.json (create)
- TypeScript configuration for React and Vite with strict mode enabled, JSX transform (`react-jsx`), DOM types, and ESNext module resolution.
- Symbols: `tsconfig.json`
- Covers: AC-1, AC-6

### sales-orders-ui/vite.config.ts (create)
- Vite configuration using `@vitejs/plugin-react` and standard development server defaults (port 5173).
- Symbols: `defineConfig`
- Covers: AC-1, AC-6

### sales-orders-ui/index.html (create)
- HTML entry point providing the `#root` mount container and linking to `/src/main.tsx`.
- Symbols: `index.html`
- Covers: AC-1

### sales-orders-ui/src/types.ts (create)
- TypeScript interfaces defining domain models and form inputs for sales orders and sales order lines.
- Symbols: `SalesOrder`, `SalesOrderLine`, `CreateOrderInput`, `CreateLineInput`
- Covers: AC-2, AC-3, AC-4, AC-5

### sales-orders-ui/src/storage.ts (create)
- Data access module providing order CRUD helpers, calculation utilities (`calculateLineTotal`, `calculateOrderTotal`), ID generation, and `localStorage` persistence with safe fallbacks.
- Symbols: `calculateLineTotal`, `calculateOrderTotal`, `loadOrders`, `saveOrders`, `createOrder`, `addLineToOrder`, `removeLineFromOrder`
- Covers: AC-2, AC-3, AC-4, AC-5

### sales-orders-ui/src/components/OrderForm.tsx (create)
- Form component for creating a new sales order header with customer name and order date, including validation error display.
- Symbols: `OrderForm`, `OrderFormProps`
- Covers: AC-2

### sales-orders-ui/src/components/OrderLineForm.tsx (create)
- Form component for adding line items (description, quantity, unit price) to an order, validating quantity > 0 and unit price >= 0.
- Symbols: `OrderLineForm`, `OrderLineFormProps`
- Covers: AC-3, AC-4

### sales-orders-ui/src/components/OrderList.tsx (create)
- Component listing all created sales orders with header details, line counts, totals, and selection controls.
- Symbols: `OrderList`, `OrderListProps`
- Covers: AC-5

### sales-orders-ui/src/components/OrderDetail.tsx (create)
- Detail view rendering selected order information, the line items table with per-line totals and delete actions, the order total, and the line addition form.
- Symbols: `OrderDetail`, `OrderDetailProps`
- Covers: AC-3, AC-4, AC-5

### sales-orders-ui/src/App.tsx (create)
- Root application component managing active orders state, selection, order creation, line addition, and line removal.
- Symbols: `App`
- Covers: AC-1, AC-2, AC-3, AC-4, AC-5

### sales-orders-ui/src/main.tsx (create)
- Application entry point rendering the `App` component into the DOM `#root` container.
- Symbols: `main`
- Covers: AC-1

### sales-orders-ui/src/index.css (create)
- Stylesheet providing layout, form controls, table presentation, badges, error alerts, and responsive structure.
- Symbols: `index.css`
- Covers: AC-1, AC-2, AC-3, AC-4, AC-5

### sales-orders-ui/README.md (create)
- Documentation covering prerequisites (Node.js 18+), installation steps (`npm install`), starting the local dev server (`npm run dev`), build commands (`npm run build`, `npm run typecheck`), and client-side persistence notes.
- Symbols: `README.md`
- Covers: AC-7

## Interfaces
Signatures of new or changed public functions, endpoints, events or types.

```ts
// sales-orders-ui/src/types.ts
export interface SalesOrderLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface SalesOrder {
  id: string;
  customerName: string;
  orderDate: string;
  lines: SalesOrderLine[];
  total: number;
}

export interface CreateOrderInput {
  customerName: string;
  orderDate: string;
}

export interface CreateLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

// sales-orders-ui/src/storage.ts
export function calculateLineTotal(quantity: number, unitPrice: number): number;
export function calculateOrderTotal(lines: SalesOrderLine[]): number;
export function loadOrders(): SalesOrder[];
export function saveOrders(orders: SalesOrder[]): void;
export function createOrder(input: CreateOrderInput): SalesOrder;
export function addLineToOrder(order: SalesOrder, lineInput: CreateLineInput): SalesOrder;
export function removeLineFromOrder(order: SalesOrder, lineId: string): SalesOrder;

// sales-orders-ui/src/components/OrderForm.tsx
export interface OrderFormProps {
  onCreateOrder: (input: CreateOrderInput) => void;
}
export function OrderForm(props: OrderFormProps): JSX.Element;

// sales-orders-ui/src/components/OrderLineForm.tsx
export interface OrderLineFormProps {
  onAddLine: (input: CreateLineInput) => void;
}
export function OrderLineForm(props: OrderLineFormProps): JSX.Element;

// sales-orders-ui/src/components/OrderList.tsx
export interface OrderListProps {
  orders: SalesOrder[];
  selectedOrderId: string | null;
  onSelectOrder: (orderId: string) => void;
}
export function OrderList(props: OrderListProps): JSX.Element;

// sales-orders-ui/src/components/OrderDetail.tsx
export interface OrderDetailProps {
  order: SalesOrder;
  onAddLine: (input: CreateLineInput) => void;
  onRemoveLine: (lineId: string) => void;
}
export function OrderDetail(props: OrderDetailProps): JSX.Element;
```

## Data and configuration changes
- Local storage key `sales_orders_v1` in browser `localStorage` for client-side persistence of sales orders.
- No database migrations, backend services, or environment variables.

## Test approach
| Layer | What | Covers |
|---|---|---|
| smoke | Verify clean project installation (`npm install`), development server launch (`npm run dev`), production bundle build (`npm run build`), TypeScript type checking (`npm run typecheck`), and ensure root Java `npm test` continues to pass unchanged | AC-1, AC-6, AC-8 |
| bdd | End-to-end user workflows: creating a new sales order with customer name and date, viewing it in the order list, adding multiple valid order lines, verifying live calculated line totals and order totals, selecting different orders, and removing lines | AC-2, AC-3, AC-4, AC-5 |
| component | Form validation testing for `OrderForm` (rejecting empty customer name or date) and `OrderLineForm` (rejecting blank description, non-positive quantity, negative unit price); verify `OrderList` item selection and `OrderDetail` line item display and delete trigger | AC-2, AC-3, AC-4, AC-5 |
| unit | Unit testing calculation and state helper functions in `storage.ts`: `calculateLineTotal` (multiplication and precision rounding), `calculateOrderTotal` (sum of line totals), `createOrder`, `addLineToOrder`, and `removeLineFromOrder` | AC-2, AC-3, AC-4 |

## Rollout
1. Create `sales-orders-ui/` directory with `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, and `README.md`.
2. Implement TypeScript models in `src/types.ts` and calculation/storage utilities in `src/storage.ts`.
3. Implement UI components: `OrderForm.tsx`, `OrderLineForm.tsx`, `OrderList.tsx`, `OrderDetail.tsx`, and root `App.tsx` / `main.tsx` / `index.css`.
4. Validate `npm run typecheck` and `npm run build` in `sales-orders-ui/`.
5. Verify root repository tests (`npm test`) remain green and no existing files are modified.

## Open questions
- None

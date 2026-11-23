# Deviations: #5 ui for sales orders

- **Node.js version is 22.12+, not 18+.** The LLP says "Node.js 18+". The latest stable Vite (8.x) requires Node `^20.19 || >=22.12` and Vitest (5.x) requires `^22.12 || ^24 || >=26`. `package.json` sets `engines.node` to `>=22.12.0` and the README says Node.js 22.12 or newer. T-21 checks that the two agree.
- **Test tooling and a `test` script were added to `package.json` and `vite.config.ts`** (vitest, jsdom, `@testing-library/*`, `@types/node`, `src/test-setup.ts`). The test plan lists this as a prerequisite the LLP omitted. `vite.config.ts` imports `defineConfig` from `vitest/config` so it can carry the `test` block.
- **Latest dependency versions** (React 19, Vite 8, TypeScript 7, `@vitejs/plugin-react` 6) were used, following the security rule to use the latest stable versions. The LLP named no versions.
- **`npm run build` is `vite build` only**, with no `tsc` step. The README documents `npm run typecheck` as the separate type check.
- **`sales-orders-ui/tests/smoke/smoke.sh` has two optional environment variables:**
  - `SMOKE_PORT` (default 5173) lets the dev-server check run when 5173 is busy.
  - `BASE_REF` (default `origin/main`) sets the base for the T-2 diff.

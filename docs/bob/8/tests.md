# Test plan: #8 ui styling

## Summary
13 tests: 2 smoke, 3 BDD, 4 component, 4 unit. The plan proves the Chakra UI Pro visual restyle of [`tools/bob-pipeline/apps/web`](tools/bob-pipeline/apps/web) across design tokens, UI primitives, app shell, and page views. Pure contrast logic and static mappings are tested at the unit layer, component boundaries and visual distinguishability at component layer, full page workflows at BDD layer, and build/token integrity at smoke layer.

## Smoke
### T-1: Build, typecheck, and font asset bundling verification
- Target: [`tools/bob-pipeline/apps/web/package.json`](tools/bob-pipeline/apps/web/package.json) via `npm run typecheck && npm run build -w @bob-pipeline/web`
- Why this layer: Proves the critical path build succeeds end-to-end after adding `@fontsource-variable/inter`. Validates that TypeScript compiles with no errors, Vite bundles the production output without warnings, local Inter `.woff2` font files are packaged into `dist`, and no external font CDN endpoints (such as Google Fonts) are referenced.
- Covers: AC-2, AC-8, risk: New font dependency introduces supply-chain or licensing concern

### T-2: Design token adoption and class-name sweep verification
- Target: [`tools/bob-pipeline/apps/web/src/`](tools/bob-pipeline/apps/web/src) via static grep inspection
- Why this layer: Static codebase-wide sweep proving compliance with the token architecture before runtime testing. Verifies that legacy `slate-*`, `indigo-*`, and unapproved `emerald-*` classes are removed (except documented semantic diff/status exceptions), hex colours are confined to [`tools/bob-pipeline/apps/web/src/components/DepGraph.tsx`](tools/bob-pipeline/apps/web/src/components/DepGraph.tsx) and [`tools/bob-pipeline/apps/web/src/views/TestPyramidView.tsx`](tools/bob-pipeline/apps/web/src/views/TestPyramidView.tsx), and no `outline-none` classes bypass focus rings.
- Covers: AC-1, AC-5, risk: Hard-coded hex colours in graph/pyramid are missed and look inconsistent, risk: Chakra UI Pro is proprietary; copying its assets or markup could breach licensing

## BDD
### T-3: Developer views and interacts with the restyled Board page
```gherkin
Given the pipeline dashboard is running
When a developer navigates to the Board page at "/"
Then the page body displays Inter typography on a canvas background
And the columns, cards, filter pills, and idle section display Chakra-Pro-style neutral surfaces, subtle borders, and teal brand accents
And clicking filter pills and issue links operates with no behaviour changes
```
- Target: [`tools/bob-pipeline/apps/web/src/pages/Dashboard.tsx`](tools/bob-pipeline/apps/web/src/pages/Dashboard.tsx)
- Why this layer: Acceptance scenario demonstrating the board page fulfills the visual restyle criteria and preserves user filtering and issue navigation workflows without regressions.
- Covers: AC-5, AC-8, risk: Wide class-name sweep causes visual regressions (board columns, graph, prose tables), risk: Ambiguous target ("website", "style of") leads to an interpretation the author did not intend

### T-4: Developer inspects issue details, pipeline stage views, diffs, and console logs
```gherkin
Given the pipeline dashboard is running with active and completed issues
When a developer navigates to an Issue detail page at "/issues/:id"
Then the stepper tabs display brand teal for current and completed stages
And the console log view displays dark code-bar header and code-ink text
And action panels, markdown prose, and diff views display consistent neutral styling with clear semantic highlights
And interactive controls including stage switching, approval, and log follow work as expected
```
- Target: [`tools/bob-pipeline/apps/web/src/pages/IssuePage.tsx`](tools/bob-pipeline/apps/web/src/pages/IssuePage.tsx), [`tools/bob-pipeline/apps/web/src/components/LogView.tsx`](tools/bob-pipeline/apps/web/src/components/LogView.tsx), [`tools/bob-pipeline/apps/web/src/views/base.tsx`](tools/bob-pipeline/apps/web/src/views/base.tsx)
- Why this layer: Acceptance scenario validating that the issue detail page and all its sub-views (stepper, action panel, prose, diffs, console logs) adhere to the new visual style while maintaining user interaction and polling behavior.
- Covers: AC-5, AC-8, risk: Wide class-name sweep causes visual regressions (board columns, graph, prose tables)

### T-5: Developer navigates to dependencies page and interacts with graph and ordering
```gherkin
Given the pipeline dashboard is running with recorded issue dependencies
When a developer navigates to the Dependencies page at "/dependencies"
Then the dependency graph displays nodes with brand focus borders and distinguishable edge kinds
And the dependency table displays canvas headers, line dividers, and brand issue links
And clicking issue links or suggested order items navigates correctly without error
```
- Target: [`tools/bob-pipeline/apps/web/src/pages/DependenciesPage.tsx`](tools/bob-pipeline/apps/web/src/pages/DependenciesPage.tsx), [`tools/bob-pipeline/apps/web/src/components/DepGraph.tsx`](tools/bob-pipeline/apps/web/src/components/DepGraph.tsx), [`tools/bob-pipeline/apps/web/src/components/DependencyTable.tsx`](tools/bob-pipeline/apps/web/src/components/DependencyTable.tsx)
- Why this layer: Acceptance scenario verifying that the dependencies view, graph visualization, and table layout operate seamlessly together with the restyled visual palette.
- Covers: AC-5, AC-6, AC-8

## Component
### T-6: Shared UI primitives rendering, variant palette, and keyboard focus outlines
- Target: [`tools/bob-pipeline/apps/web/src/components/ui.tsx`](tools/bob-pipeline/apps/web/src/components/ui.tsx)
- Why this layer: Tests the component boundary of shared UI primitives ([`Button`](tools/bob-pipeline/apps/web/src/components/ui.tsx:60) across 4 variants and disabled state, [`StatusBadge`](tools/bob-pipeline/apps/web/src/components/ui.tsx:67) across all 8 statuses, [`Card`](tools/bob-pipeline/apps/web/src/components/ui.tsx:68), [`ErrorBox`](tools/bob-pipeline/apps/web/src/components/ui.tsx:69)). Proves visual token application, tag shape, and 2px brand focus rings (`:focus-visible`) in isolation.
- Covers: AC-1, AC-3

### T-7: App shell Layout header styling, active navigation state, and poller controls
- Target: [`tools/bob-pipeline/apps/web/src/components/Layout.tsx`](tools/bob-pipeline/apps/web/src/components/Layout.tsx)
- Why this layer: Tests the app shell container component at the layout boundary: sticky header surface, active vs inactive `NavLink` styling, poller control layout and status display, and warning banner appearance.
- Covers: AC-4, AC-5

### T-8: Visual distinguishability of dependency graph edges and test pyramid layers
- Target: [`tools/bob-pipeline/apps/web/src/components/DepGraph.tsx`](tools/bob-pipeline/apps/web/src/components/DepGraph.tsx), [`tools/bob-pipeline/apps/web/src/views/TestPyramidView.tsx`](tools/bob-pipeline/apps/web/src/views/TestPyramidView.tsx)
- Why this layer: Validates component-level visual contracts for complex graphics. Ensures that the 4 graph edge kinds (`recorded` solid teal, `deps-check` dashed orange, `plan` dashed indigo, `overlaps` dotted gray) and the 4 pyramid levels (smoke orange, bdd violet, component blue, unit teal) remain easily distinguishable from each other.
- Covers: AC-6, risk: Colour changes reduce contrast or make status/edge/test-level colours indistinguishable, risk: Hard-coded hex colours in graph/pyramid are missed and look inconsistent

### T-9: Multi-viewport responsive rendering and layout degradation
- Target: [`tools/bob-pipeline/apps/web/src/components/Layout.tsx`](tools/bob-pipeline/apps/web/src/components/Layout.tsx), [`tools/bob-pipeline/apps/web/src/pages/Dashboard.tsx`](tools/bob-pipeline/apps/web/src/pages/Dashboard.tsx), [`tools/bob-pipeline/apps/web/src/pages/IssuePage.tsx`](tools/bob-pipeline/apps/web/src/pages/IssuePage.tsx), [`tools/bob-pipeline/apps/web/src/pages/DependenciesPage.tsx`](tools/bob-pipeline/apps/web/src/pages/DependenciesPage.tsx)
- Why this layer: Tests layout boundaries across viewport widths (1440px desktop, 1024px small desktop, 768px tablet, 390px mobile). Confirms poller controls wrap cleanly and that no unexpected horizontal page overflow occurs outside the designated board scroll container.
- Covers: AC-9, risk: Wide class-name sweep causes visual regressions (board columns, graph, prose tables)

## Unit
### T-10: WCAG 2.1 AA color contrast validation across all foreground and background pairs
- Target: [`tools/bob-pipeline/apps/web/src/index.css`](tools/bob-pipeline/apps/web/src/index.css), [`tools/bob-pipeline/apps/web/src/components/ui.tsx`](tools/bob-pipeline/apps/web/src/components/ui.tsx), [`tools/bob-pipeline/apps/web/src/views/TestPyramidView.tsx`](tools/bob-pipeline/apps/web/src/views/TestPyramidView.tsx), [`tools/bob-pipeline/apps/web/src/components/LogView.tsx`](tools/bob-pipeline/apps/web/src/components/LogView.tsx)
- Why this layer: Pure logic calculation of relative luminance contrast ratios for every color combination (WCAG AA requirement >= 4.5:1 for normal text). Proves mathematical compliance for white on `brand-700` (5.5:1), `text-muted` on `canvas`/`subtle`/`surface`, all 8 status badge pairs, log console text, and pyramid band text.
- Covers: AC-7, risk: Colour changes reduce contrast or make status/edge/test-level colours indistinguishable

### T-11: Dependency graph edgeStyle stroke and strokeDasharray mapping
- Target: [`tools/bob-pipeline/apps/web/src/components/DepGraph.tsx:edgeStyle`](tools/bob-pipeline/apps/web/src/components/DepGraph.tsx)
- Why this layer: Pure unit function test verifying that `edgeStyle` maps each `DependencyEdge` kind (`overlaps`, `recorded`, `deps-check`, `plan`) to the exact new hex color in `GRAPH_COLORS` and the correct dash array.
- Covers: AC-6, risk: Hard-coded hex colours in graph/pyramid are missed and look inconsistent

### T-12: Status badge dictionary mapping and pulse animation configuration
- Target: [`tools/bob-pipeline/apps/web/src/components/ui.tsx:statusStyle`](tools/bob-pipeline/apps/web/src/components/ui.tsx)
- Why this layer: Pure unit dictionary test verifying `statusStyle` entries for all eight pipeline statuses, ensuring gray scale usage for neutral states (`not-started`, `parked`), proper text/background classes, and `animate-pulse` on `running`.
- Covers: AC-3

### T-13: Test pyramid META layer definition and Tailwind text class mappings
- Target: [`tools/bob-pipeline/apps/web/src/views/TestPyramidView.tsx:META`](tools/bob-pipeline/apps/web/src/views/TestPyramidView.tsx)
- Why this layer: Pure unit dictionary test verifying that `META` defines smoke (`#c2410c`, `text-orange-700`), bdd (`#6d28d9`, `text-violet-700`), component (`#1d4ed8`, `text-blue-700`), and unit (`#0f766e`, `text-brand-700`) with valid darkened hex values and literal class strings.
- Covers: AC-6, risk: Colour changes reduce contrast or make status/edge/test-level colours indistinguishable

## Coverage
| Criterion / risk | Smoke | BDD | Component | Unit |
|---|---|---|---|---|
| AC-1 | T-2 | | T-6 | |
| AC-2 | T-1 | | | |
| AC-3 | | | T-6 | T-12 |
| AC-4 | | | T-7 | |
| AC-5 | T-2 | T-3, T-4, T-5 | T-7 | |
| AC-6 | | T-5 | T-8 | T-11, T-13 |
| AC-7 | | | | T-10 |
| AC-8 | T-1 | T-3, T-4, T-5 | | |
| AC-9 | | | T-9 | |
| risk: Ambiguous target ("website", "style of") leads to an interpretation the author did not intend | | T-3 | | |
| risk: Chakra UI Pro is proprietary; copying its assets or markup could breach licensing | T-2 | | | |
| risk: Wide class-name sweep causes visual regressions (board columns, graph, prose tables) | | T-3, T-4 | T-9 | |
| risk: New font dependency introduces supply-chain or licensing concern | T-1 | | | |
| risk: Colour changes reduce contrast or make status/edge/test-level colours indistinguishable | | | T-8 | T-10, T-13 |
| risk: Hard-coded hex colours in graph/pyramid are missed and look inconsistent | T-2 | | T-8 | T-11 |

## Gaps
- Dark mode is deliberately not tested: scope is explicitly limited to light theme as defined in the high-level and low-level plan assumptions.
- Direct Chakra UI Pro component / asset tests: Chakra UI Pro is a proprietary kit; the implementation emulates the visual look and feel using Tailwind CSS v4 tokens without copying proprietary code or assets.
- Server backend / API contract tests: Fastify backend routes, JSON schemas, and CLI commands are untouched by this visual styling change.
- Automated browser E2E test harness: the repository has no pre-existing browser automation framework; tests rely on smoke build and grep verification, component/unit evaluation, and manual browser verification recorded in the PR.

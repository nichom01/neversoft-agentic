# What has changed: #8 ui styling

## Summary
The Bob pipeline dashboard (`tools/bob-pipeline/apps/web`) now has a Chakra-UI-Pro-style look. It uses neutral gray surfaces, a teal accent in place of emerald, Inter typography served from the bundle with no CDN, subtle borders and shadows, and a shared keyboard focus ring. The change is class names, colour constants, one font import and one new dev dependency. No routes, props, hooks or API calls change. A small `node:test` script was added to check the static parts of the restyle.

## Changes
| Area | Files | What changed | Why |
|---|---|---|---|
| Design tokens and base styles | [`index.css`](tools/bob-pipeline/apps/web/src/index.css), [`index.html`](tools/bob-pipeline/apps/web/index.html) | Removed the `:root` font-family. Added an `@theme` block with `--font-sans` (Inter Variable plus system fallback), `--color-brand-50..900` (teal), neutral tokens (`canvas`, `surface`, `subtle`, `line`, `line-strong`, `ink`, `muted`), console tokens (`code`, `code-bar`, `code-ink`, `code-muted`), `--radius-control`/`--radius-card` and `--shadow-card`/`--shadow-pop`. Added `@layer base` rules for `body`, a global `:where(a, button, input, textarea, select, summary):focus-visible` 2px `brand-600` outline, and the `.prose` link colour. `<body>` lost its `bg-slate-50 text-slate-900 antialiased` classes. | Central tokens (AC-1), Inter (AC-2), visible focus (AC-3). |
| Font dependency | [`package.json`](tools/bob-pipeline/apps/web/package.json), [`package-lock.json`](tools/bob-pipeline/package-lock.json), [`main.tsx`](tools/bob-pipeline/apps/web/src/main.tsx) | Added `@fontsource-variable/inter` `^5.3.0` (lockfile entry is `5.3.0`, `OFL-1.1`). `main.tsx` imports it before `./index.css`. Lockfile change is limited to the workspace dependency line and the new package entry. | Self-hosted Inter, no external font request (AC-2). |
| Shared primitives | [`ui.tsx`](tools/bob-pipeline/apps/web/src/components/ui.tsx) | `Button` variants moved to token classes: `primary` is now `brand-700`, base adds `rounded-control`, `shadow-sm`, `justify-center`, `transition-colors`. `statusStyle` neutrals moved from slate to gray (`not-started` `bg-gray-100 text-gray-700`, `parked` `bg-gray-200 text-gray-700`). `StatusBadge` moved from `rounded-full font-semibold` to `rounded-control font-medium`. `Card` and `ErrorBox` use the new radius, border, surface and shadow tokens. Props are unchanged. | Primitives restyled in one place (AC-1, AC-3). |
| App shell | [`Layout.tsx`](tools/bob-pipeline/apps/web/src/components/Layout.tsx) | Header is sticky with `border-line bg-surface shadow-card`. Active nav is `bg-brand-50 text-brand-700`, inactive is `text-muted hover:bg-subtle hover:text-ink`. Poller area now wraps (`flex-wrap gap-x-3 gap-y-2`). Containers use `px-4 sm:px-6`. Auto-poll checkbox has `accent-brand-700`. Warning banner stays amber (`text-amber-900`). | Restyled, responsive shell (AC-4, AC-9). |
| Board page | [`Dashboard.tsx`](tools/bob-pipeline/apps/web/src/pages/Dashboard.tsx) | Filter pills use `brand-700` when active. Columns are `rounded-card border-line bg-subtle` with a bordered index bubble. `IssueCard` link is now `block rounded-card` and the card hovers to `border-brand-500 shadow-pop`. Idle list, dividers, parked links and error text moved to tokens. Grid template and `overflowX` are untouched. | Consistent new look (AC-5). |
| Issue page and log/diff views | [`IssuePage.tsx`](tools/bob-pipeline/apps/web/src/pages/IssuePage.tsx), [`LogView.tsx`](tools/bob-pipeline/apps/web/src/components/LogView.tsx), [`base.tsx`](tools/bob-pipeline/apps/web/src/views/base.tsx) | Slate text moved to `text-muted`. The `Stepper` uses brand for done and current (current is solid `brand-700` with white text) and a `ring-brand-500` selected ring. The review card border moved from indigo to `brand-300`. `LogView` moved to `code`/`code-bar`/`code-ink`/`code-muted` tokens and `info` lines to `brand-300`. `base.tsx` JSON and raw `<pre>` use `bg-code text-code-ink`. Schema valid is now `emerald-700`, errors `red-700`, and diff containers use `line`/`surface`. Markdown `prose-slate` became `prose-gray`. Diff add/remove/hunk colours are kept. | AC-1, AC-5, AC-7. |
| Dependencies page | [`DependenciesPage.tsx`](tools/bob-pipeline/apps/web/src/pages/DependenciesPage.tsx), [`DependencyTable.tsx`](tools/bob-pipeline/apps/web/src/components/DependencyTable.tsx), [`DependencyView.tsx`](tools/bob-pipeline/apps/web/src/views/DependencyView.tsx) | Class sweep to `text-muted`, `divide-line`, `bg-canvas` table header and `text-brand-700` links. Cycles and conflicts boxes keep red and amber semantics. Checkbox has `accent-brand-700`. | AC-5, AC-7. |
| Graph colours | [`DepGraph.tsx`](tools/bob-pipeline/apps/web/src/components/DepGraph.tsx) | Added unexported `GRAPH_COLORS` (`overlaps` `#6b7280`, `recorded` `#0f766e`, `depsCheck` `#c2410c`, `plan` `#4f46e5`, plus `focus`, `line`, `doneFill`, `grid`, `label`). `edgeStyle` uses it, so its return shape and labels are unchanged. The focus node border moved from indigo to brand teal. Container, legend and background grid use tokens or constants. | Palette alignment with distinguishable edge kinds (AC-6). |
| Test pyramid colours | [`TestPyramidView.tsx`](tools/bob-pipeline/apps/web/src/views/TestPyramidView.tsx) | `META` colours were darkened: smoke `#c2410c`, bdd `#6d28d9`, component `#1d4ed8` (text class `text-blue-700`, was `text-sky-700`), unit `#0f766e` (`text-brand-700`, was `text-emerald-700`). Tab buttons, tables, cards, gherkin and gap panels moved to tokens. | AC-6, AC-7. |
| Static checks | [`style-checks.test.mjs`](tools/bob-pipeline/apps/web/scripts/style-checks.test.mjs), [`package.json`](tools/bob-pipeline/apps/web/package.json) | New `node:test` file with T-2, T-10, T-11, T-12 and T-13, run with `npm run test:style -w @bob-pipeline/web` (`node --test scripts/`). | Automates the plan's static checks with no new dependency. |
| Pipeline docs | `docs/bob/8/*` (`hlp`, `llp`, `tests`, `deps`, `deviations`, `state`) | Plans and notes for this issue. `deps.md` recommends merging #8 before #6. | Process artefacts, no runtime effect. |

## Acceptance criteria
| Criterion | Status | Evidence (file, test) |
|---|---|---|
| AC-1: central tokens in `index.css`, consumed by primitives and shell | Met | `index.css` `@theme`; `ui.tsx` and `Layout.tsx` use token classes. T-2 in `style-checks.test.mjs` fails on `slate-`, `emerald-600`, stray hex, and `indigo-` outside `ui.tsx`. |
| AC-2: self-hosted Inter with system fallback | Met | `main.tsx` import, `package.json`, `package-lock.json`, `--font-sans` in `index.css`. `deviations.md` records a manual build showing `.woff2` files in `dist` and no `googleapis`/`gstatic` matches. This was not scripted. |
| AC-3: primitives restyled with visible focus | Partly | Restyle is in `ui.tsx`. Global focus rule is in `index.css`. T-12 checks `statusStyle`. No recorded visual review of the four button variants, hover, disabled or keyboard focus (planned T-6). |
| AC-4: header and nav restyled, functional and responsive | Partly | `Layout.tsx` classes. No recorded visual or responsive review (planned T-7). |
| AC-5: Board, Issue and Dependencies pages use the new look, no old emerald/ad-hoc chrome | Met | `Dashboard.tsx`, `IssuePage.tsx`, `DependenciesPage.tsx` and related files. T-2 enforces no `slate-` or `emerald-600`. The walkthrough (T-3 to T-5) is not recorded. |
| AC-6: graph and pyramid aligned and distinguishable | Met | `DepGraph.tsx` `GRAPH_COLORS`, `TestPyramidView.tsx` `META`. T-11 and T-13 assert the values and dash patterns. Visual distinguishability (T-8) is not recorded. |
| AC-7: WCAG AA contrast (4.5:1) | Partly | T-10 checks 15 pairs: brand fills, muted on three backgrounds, log text, gray badges and pyramid fills. It does not compute the sky, amber, indigo, orange, red or violet badge pairs, or `emerald-700`, `red-700` and `amber-900` text. These are only claimed in the LLP. |
| AC-8: no behaviour change, typecheck and build pass | Met | The diff touches only class strings, colour constants, one import and the dependency. `deviations.md` records `npm run typecheck -w @bob-pipeline/web` and `npm run build -w @bob-pipeline/web` passing. Root `npm run typecheck` fails in `apps/server` on a missing `ajv`, which is unrelated. |
| AC-9: responsive, no page-level horizontal overflow | Partly | `Layout.tsx` adds `flex-wrap` and `px-4 sm:px-6`. The board grid `overflowX` is kept. No responsive check at 1440/1024/768/390 px is recorded (planned T-9). |

## Tests: planned vs actual
| Test | Layer | Planned | Status | File |
|---|---|---|---|---|
| T-1 Build, typecheck, font bundling | smoke | yes | Missing as a file. Run by hand and recorded in `deviations.md`. | none (`docs/bob/8/deviations.md`) |
| T-2 Token adoption and class-name sweep | smoke | yes | Created | `tools/bob-pipeline/apps/web/scripts/style-checks.test.mjs` |
| T-3 Board page walkthrough | BDD | yes | Missing (manual) | none |
| T-4 Issue page walkthrough | BDD | yes | Missing (manual) | none |
| T-5 Dependencies page walkthrough | BDD | yes | Missing (manual) | none |
| T-6 Primitives and focus rings | component | yes | Missing (manual) | none |
| T-7 Layout header and poller | component | yes | Missing (manual) | none |
| T-8 Edge and pyramid distinguishability | component | yes | Missing (manual). Only the colour values are covered by T-11 and T-13. | none |
| T-9 Responsive rendering | component | yes | Missing (manual) | none |
| T-10 WCAG contrast | unit | yes | Created, partial coverage (see AC-7) | `tools/bob-pipeline/apps/web/scripts/style-checks.test.mjs` |
| T-11 `edgeStyle` mapping | unit | yes | Created. It reads `DepGraph.tsx` as text, not by importing it. | `tools/bob-pipeline/apps/web/scripts/style-checks.test.mjs` |
| T-12 `statusStyle` mapping | unit | yes | Created. It checks source text, and only `not-started`, `parked` and `running` classes plus the presence of all eight keys. | `tools/bob-pipeline/apps/web/scripts/style-checks.test.mjs` |
| T-13 Pyramid `META` | unit | yes | Created. It checks source text. | `tools/bob-pipeline/apps/web/scripts/style-checks.test.mjs` |
| (unplanned) | any | no | None. All five tests in the file carry planned T-ids. | n/a |

The diff does not show the `test:style` run output, so a passing run is not evidenced.

## Deviations from the plan
Items 1 to 4 are from `docs/bob/8/deviations.md`. Items 5 and 6 are from the diff.
1. The LLP planned no automated harness. T-2, T-10, T-11, T-12 and T-13 were implemented as a `node:test` script, and a `test:style` script was added to `apps/web/package.json` (not in the LLP).
2. T-3 to T-9 and the browser parts of T-1 stay manual, as the LLP scoped them. Only the build and `dist` checks of T-1 were run by hand, and none of the manual results are in the diff.
3. Root `npm run typecheck` fails in `apps/server` (`ajv` not installed here). It is unrelated to #8, and the web workspace typecheck passes.
4. `@fontsource-variable/inter` is `^5.3.0`, where the LLP said `^5.2.0` or the latest 5.x.
5. `TestPyramidView.tsx` also changes `text-red-600` to `text-red-700` on the "couldn't be read" message. The LLP did not list it. The `Pyramid` component named in the LLP symbols has no diff.
6. `GRAPH_COLORS` has nine keys (adds `focus`, `line`, `doneFill`, `grid`, `label`). The LLP described the values but not this shape.

## Risks and things reviewers should check
- Run the app and look at it. Nearly all of the review evidence (focus rings, header, graph and pyramid distinguishability, responsive widths, behaviour of filter pills, approve, record dependency and start pipeline) is manual and not in the diff.
- Contrast is only partly scripted (see AC-7). Check the remaining badge, red, amber and emerald text pairs with a contrast tool.
- `StatusBadge` changed from pill to `rounded-control`, but the blocked-by pills in `IssuePage.tsx` and the board filter pills are still `rounded-full`. Confirm the mixed shapes are acceptable.
- The sticky header uses `z-10`. Check it against the React Flow graph controls and overlays when scrolling `/dependencies`.
- `IssueCard`'s `Link` is now `block`. Check the board card layout and focus outline.
- The style tests are regexes over source text, so they are brittle to reformatting. T-11 depends on the `GRAPH_COLORS` key names and the exact `edgeStyle` return text.
- `GRAPH_COLORS` and `META` hex values must be updated by hand when `index.css` tokens change.
- Lockfile: confirm there is no unrelated churn. The diff shows only the two expected entries. The new package is `OFL-1.1`. The dependency and vulnerability scan the plan asked for is not evidenced.
- Merge order: `deps.md` recommends #8 before #6. #6 copies the `ui.tsx` primitives, and both touch `apps/web/package.json` and the lockfile. The `sales-orders-ui/` site (#5) is not restyled.

## Follow-ups
- Record the manual walkthrough, visual, responsive and contrast results in the PR (T-1, T-3 to T-9).
- Extend T-10 to every badge and text pair, or record a manual contrast check.
- Restyle `tools/warehouse-ui` (#6) and `sales-orders-ui/` (#5) if the Chakra Pro look should cover them (from `deps.md`).
- Fix the `ajv` install so the root `npm run typecheck` passes (unrelated to #8).

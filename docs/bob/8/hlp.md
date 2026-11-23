# High-level plan: #8 ui styling

## Summary
Restyle the Bob pipeline web UI (`tools/bob-pipeline/apps/web`) so it visually follows the look and feel of Chakra UI Pro (neutral gray surfaces, a single teal/blue accent, Inter typography, subtle borders and shadows, consistent radii and focus rings). This is a visual-only change; behaviour, routes and data flow stay the same.

## Approach
The only website in the repo is the React + Vite + Tailwind CSS v4 dashboard in `tools/bob-pipeline/apps/web`. Rather than adopting Chakra UI itself (which would mean replacing Tailwind and rewriting every component, and Chakra UI Pro is a paid, proprietary kit), we reproduce its visual language on the existing stack:

1. Define a small design-token layer in `index.css` using Tailwind v4 `@theme` (font family, accent/brand colour scale, neutral surface and border colours, radii, shadows, focus ring) and set the base body styles there instead of in `index.html`.
2. Restyle the shared primitives in `components/ui.tsx` (`Button`, `StatusBadge`, `Card`, `ErrorBox`) so every page inherits the new look from one place.
3. Restyle the app shell in `Layout.tsx` (header, nav tabs, poller controls, warning banner) to a Chakra-Pro-style application header.
4. Sweep the pages and views (`Dashboard`, `IssuePage`, `DependenciesPage`, `DependencyTable`, `LogView`, `views/*`) replacing ad-hoc `slate-*`/`emerald-*` utility classes with the token-based classes, and align the hard-coded hex colours in `DepGraph.tsx` and `TestPyramidView.tsx` with the new palette.
5. Load Inter from a self-hosted package (no external CDN), with the existing system font stack as fallback.

This fits the codebase because styling is already centralised in a handful of primitives plus utility classes, so a token-driven restyle touches presentation only and avoids new runtime frameworks.

## Alternatives considered
- Adopt Chakra UI (`@chakra-ui/react`) components directly — rejected: requires removing Tailwind and rewriting every component; much larger scope and risk for a styling request.
- Purchase/use Chakra UI Pro templates verbatim — rejected: proprietary and licensed, and not usable under a private-repo-agnostic open pipeline tool; we only emulate the visual style.
- Use shadcn/ui or another Tailwind component kit — rejected: adds dependencies and generated component code when a token restyle of the existing primitives achieves the goal.
- Restyle each page ad hoc without tokens — rejected: leads to drift and makes later theme tweaks (or dark mode) expensive.

## Components affected
- Web app global styles (`index.css`, `index.html`) — add theme tokens, Inter font, base body styles; remove hard-coded body colour classes.
- Shared UI primitives (`components/ui.tsx`) — new button variants, badge palette, card, error box styling.
- App shell (`components/Layout.tsx`) — restyled header, nav, poller controls, warning banner, page container.
- Board page (`pages/Dashboard.tsx`) — filter pills, kanban columns, issue cards, idle list restyled.
- Issue detail page (`pages/IssuePage.tsx`, `components/LogView.tsx`, `views/*`) — tabs, panels, log view, markdown prose and diff views restyled.
- Dependencies page (`pages/DependenciesPage.tsx`, `components/DependencyTable.tsx`, `components/DepGraph.tsx`) — table, graph node/edge colours and container restyled.
- Test pyramid view (`views/TestPyramidView.tsx`) — level colour palette aligned with the new theme.
- Web app dependencies (`apps/web/package.json`, lockfile) — add self-hosted Inter font package.

## Acceptance criteria
- AC-1: The web UI defines a central set of theme tokens (font, accent colour scale, neutral surface/border colours, radii, shadows) in `index.css`, and the primitives and shell consume them rather than hard-coded one-off colours.
- AC-2: The app uses Inter (self-hosted, no external CDN request) as its primary font with a system-font fallback.
- AC-3: `Button` (default, primary, danger, ghost), `StatusBadge` (all eight statuses), `Card` and `ErrorBox` are restyled in a Chakra-Pro-like manner and have visible keyboard focus states.
- AC-4: The header/navigation in `Layout.tsx` is restyled (surface, border, active nav state, poller controls, warning banner) and remains functional and responsive.
- AC-5: Board, Issue and Dependencies pages all use the new look consistently, with no remaining old-style `emerald`/ad-hoc palette on primary actions or surfaces.
- AC-6: The dependency graph and test pyramid colours are aligned with the new palette while edge kinds and test levels remain visually distinguishable.
- AC-7: Text/background colour combinations used for body text, badges and buttons meet WCAG AA contrast (4.5:1 for normal text).
- AC-8: No behaviour, routing, API or data changes; `npm run typecheck` and `npm run build` in `apps/web` pass with no new warnings.
- AC-9: The UI renders correctly at common desktop widths and degrades acceptably (no horizontal page overflow other than the existing board scroll) at tablet/mobile widths.

## Dependencies on other issues
- None known

## Assumptions
- "The website" means the Bob pipeline dashboard in `tools/bob-pipeline/apps/web`; there is no other web front end in the repo.
- "In the style of pro.chakra-ui.com" means visual emulation (look and feel), not use of Chakra UI components or Pro assets/code.
- Tailwind CSS v4 and the existing component structure are retained.
- A light theme is the deliverable; dark mode is not required.
- Inter via a maintained, OFL-licensed self-hosted package (e.g. `@fontsource-variable/inter`) is acceptable as a new dependency, and passes the repo's dependency/vulnerability checks.
- The website's behaviour is already covered by manual use; no automated UI tests exist, so verification is typecheck, build and visual review.

## Risks
| Risk | Severity | Mitigation |
|---|---|---|
| Ambiguous target ("website", "style of") leads to an interpretation the author did not intend | medium | Record the interpretation in the PR; keep tokens centralised so the palette/accent can be changed quickly. |
| Chakra UI Pro is proprietary; copying its assets or markup could breach licensing | medium | Emulate the general visual language only; do not copy Pro templates, code or assets. |
| Wide class-name sweep causes visual regressions (e.g. board columns, graph, prose tables) | medium | Change primitives first, then pages one at a time; manually review each page and the build output. |
| New font dependency introduces supply-chain or licensing concern | low | Use a maintained OFL package, pin via lockfile, run dependency scan. |
| Colour changes reduce contrast or make status/edge/test-level colours indistinguishable | medium | Check contrast against WCAG AA and keep distinct hues per status/edge/level. |
| Hard-coded hex colours in graph/pyramid are missed and look inconsistent | low | Explicitly include `DepGraph.tsx` and `TestPyramidView.tsx` in the sweep and grep for remaining `slate-`/hex usage. |

## Open questions
- Should dark mode be included, or is a light theme sufficient for this issue?
- Is a sidebar app shell (as in Chakra Pro dashboards) desired, or should the existing top header layout be retained and merely restyled? This plan assumes the top header is retained.
- Is there a preferred accent colour (Chakra Pro's teal/blue) or should we keep the existing emerald as the brand colour?

## Complexity
M — presentation-only, but touches ~11 front-end files and has no automated visual tests.

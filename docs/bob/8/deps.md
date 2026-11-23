# Dependency check: #8 ui styling

## Summary
#8 is not blocked by any open issue and does not strictly block any. It has a medium-confidence overlap with #6, which plans to copy the UI primitives and Tailwind conventions that #8 restyles, so merge order matters. #8 also conflicts with #5 and #6 over the assumption that the pipeline dashboard is the only web front end.

## Dependencies
| Issue | Relationship | Confidence | Why | Shared |
|---|---|---|---|---|
| #6 | overlaps | medium | #8 restyles the `Button`, `Card` and `ErrorBox` primitives and Tailwind tokens in `tools/bob-pipeline/apps/web`. #6 plans to copy those primitives into the new `tools/warehouse-ui` and to match the pipeline app's dependency versions (AC-1, AC-4). It will inherit the old or the new look depending on which issue merges first. Both also change npm workspace and lockfile state: #8 adds an Inter font package, and #6 registers two new workspace packages. Neither plan needs the other's outcome, so this is not a blocker. | `tools/bob-pipeline/apps/web/src/components/ui.tsx`, `tools/bob-pipeline/apps/web/package.json`, `tools/bob-pipeline/package-lock.json`, `tools/bob-pipeline/package.json` |

#5, #4, #3 and #1 have no justified dependency with #8. #4, #3 and #1 are Java domain classes. #5 is a separate `sales-orders-ui/` project that shares no files with #8 (see Conflicts).

## Conflicts
- #8 and #6: #8 assumes that "there is no other web front end in the repo" and restyles only `apps/web`. #6 adds a second React/Tailwind SPA (`tools/warehouse-ui`) that should use "the same visual primitives" as the pipeline app. Its copied primitives will drift from #8's new design unless #6 merges after #8 and copies the restyled versions, or the warehouse UI is restyled in a follow-up. #6's own risk table already notes this drift, and #6 AC-7 forbids modifying existing files, so #6 cannot pick up the new tokens by editing the pipeline app.
- #8 and #5: #8 treats the pipeline dashboard as "the website". #5 adds `sales-orders-ui/` as a new site with minimal plain-CSS styling and no UI library. The author may expect the "ui styling" request to cover that site too. #5 as planned will not follow the Chakra Pro look. This is a scope ambiguity, not a file overlap.

## Recommended order
#8 → #6

#5 can merge at any point relative to these two. If the Chakra Pro look is meant for the new UIs as well, restyle `sales-orders-ui/` and `tools/warehouse-ui` in a follow-up.

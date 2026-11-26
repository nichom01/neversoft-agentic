# Dependency check: #17 open telemetry

## Summary
#17 depends on #6, which delivers `tools/warehouse-server`, the service #17 instruments. #6 is already done and approved, and the server is present in this worktree, so nothing blocks #17 now. No other open issue overlaps or conflicts with it.

## Dependencies
| Issue | Relationship | Confidence | Why | Shared |
|---|---|---|---|---|
| #6 | blocked by | high | #17 scopes itself to `tools/warehouse-server`, the Fastify and `node:sqlite` API that #6 creates. #17 changes its `package.json` and `src/index.ts`, which #6's plan also lists. #17's plan says "None known" for dependencies, but it relies on #6's output. #6 is `bob:done` and the server code exists in this worktree, so the dependency is already satisfied. | `tools/warehouse-server/package.json`, `tools/warehouse-server/src/index.ts`, `tools/warehouse-server` |

Checked and found independent of #17:
- #1, #3, #4 and #15 are Java POJOs and scoring under `src/main/java`. #17 treats that tree as read only and out of scope. #3 edits the root `package.json` `test` script. #17 does not touch the root `package.json`, only the server's `package.json` and the root `package-lock.json`.
- #5 is the standalone `sales-orders-ui`. #17 treats it as read only.
- #8 restyles `tools/bob-pipeline/apps/web`. #17 treats `tools/bob-pipeline` as read only. #8 changes `tools/bob-pipeline/package-lock.json`. #17 changes the root `package-lock.json`, because `tools/bob-pipeline` is not in the root workspaces.

## Conflicts
- None. #6 defines the server's scope (CRUD for Vehicle, bound to `127.0.0.1`, no authentication, local developer tool). #17 assumes the same binding and adds no listening ports. #17 AC-11 requires existing tests to pass unchanged, and #6 builds the app through `buildApp`, which is consistent.

## Recommended order
#6 → #17

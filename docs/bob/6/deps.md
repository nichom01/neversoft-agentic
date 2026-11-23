# Dependency check: #6 ui for warehouse maintenance

## Summary
Issue #6 is blocked by Issue #1 because it directly implements REST CRUD endpoints and UI management screens for the Vehicle domain model. It also overlaps with Issue #3 due to concurrent modifications to root `package.json`.

## Dependencies
| Issue | Relationship | Confidence | Why | Shared |
|---|---|---|---|---|
| #1 | blocked by | high | Issue #6 implements REST CRUD endpoints and UI screens mirroring the Vehicle domain model created in Issue #1 | src/main/java/com/neversoft/vehicle/Vehicle.java |
| #3 | overlaps | medium | Both issues modify the root package.json (Issue #3 adds test script entries, Issue #6 registers new workspace packages) | package.json |

## Conflicts
None

## Recommended order
#1 → #3 → #6

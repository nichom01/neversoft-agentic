# Dependency check: #3 warehouse classes

## Summary
#3 builds on the `Vehicle` conventions and `npm test` script that #1 delivered. #1 is already done and in this tree, so the dependency is satisfied and nothing needs to wait. There is no file-level conflict with #1.

## Dependencies
| Issue | Relationship | Confidence | Why | Shared |
|---|---|---|---|---|
| #1 | blocked by | high | The #3 plan explicitly follows the `Vehicle` POJO conventions from #1. It also extends the `package.json` test script that already names the Vehicle files. #1 is marked `bob:done` in INDEX.md, and `Vehicle.java`, `VehicleTest.java` and the test script are present in this tree, so the dependency is already met. | `src/main/java/com/neversoft/vehicle/Vehicle.java`, `src/test/java/com/neversoft/vehicle/VehicleTest.java`, `package.json` (test script) |

## Conflicts
None. #3 adds a separate package (`com.neversoft.warehouse`) and leaves the Vehicle code unchanged. The only edit to a file #1 created or relies on is the `package.json` test script. #3 plans to keep the Vehicle compile and run steps intact (see its risks and AC-7/AC-9). #1's plan has no remaining work in that file.

## Recommended order
#1 → #3

## Notes
- The #3 plan lists no dependencies, but its approach and assumptions rely on #1's outcome. The plan itself says this is "already merged into this tree".
- The #1 plan says it adds no tests and modifies no existing files. The tree does contain `VehicleTest.java` and the `package.json` test script, so #1 evidently shipped more than its plan described. #3's plan matches what is actually in the tree, so no change is needed.

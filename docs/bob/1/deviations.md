# Deviations from the approved plans

## 1. Added root `package.json` (not in the LLP)

The pipeline's implement stage runs `npm test --if-present` from the repo root.
The repo had no root `package.json`, so npm failed with `ENOENT` before looking
for a script (`--if-present` only skips a missing script, not a missing
`package.json`). I added a minimal private `package.json` whose `test` script
compiles `Vehicle.java` and `VehicleTest.java` with `javac -Xlint:all -Werror`
into a temp directory and runs the harness. It has no dependencies and does not
act as a Java build file. I chose this over editing `tools/bob-pipeline/pipeline.yaml`
because that is pipeline configuration, which I was told not to change.

## 2. Added test harness `src/test/java/com/neversoft/vehicle/VehicleTest.java`

The LLP lists only `Vehicle.java`. The approved `tests.json` (T-3 to T-16)
requires this dependency-free harness (see the gaps section of `tests.json`).

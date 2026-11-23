# Test plan: #1 New class

## Summary
16 tests: 2 smoke, 4 BDD, 0 component, 10 unit. `Vehicle` is a single dependency-free POJO with no boundaries, so most proof sits at unit level. Smoke covers the build-level criteria (compiles, package matches path, no existing files modified).

The repo has no Java code, build file or test framework. Tests use a plain-JDK, main-method harness at `src/test/java/com/neversoft/vehicle/VehicleTest.java`, run with `javac` and `java` and no JUnit. See Gaps for how this relates to the LLP.

Run recipe for T-3 to T-16:
`OUT=$(mktemp -d); javac --release 25 -Xlint:all -Werror -d "$OUT" src/main/java/com/neversoft/vehicle/Vehicle.java src/test/java/com/neversoft/vehicle/VehicleTest.java && java -cp "$OUT" com.neversoft.vehicle.VehicleTest`

## Smoke
### T-1: Vehicle.java compiles with plain javac, no warnings, output lands in the declared package path
- Target: `OUT=$(mktemp -d); javac --release 25 -Xlint:all -Werror -d "$OUT" src/main/java/com/neversoft/vehicle/Vehicle.java; test -f "$OUT/com/neversoft/vehicle/Vehicle.class"`
- Why this layer: The repo has no build file, so javac is the only critical-path check. It proves the file exists, compiles on the JDK alone, produces no warnings, and writes its class file under `com/neversoft/vehicle`, which confirms the package matches the directory.
- Covers: AC-1, AC-5, risk: No build tooling to verify compilation in CI, risk: "Mojo" actually means a Maven plugin Mojo

### T-2: Change set only adds Vehicle.java; no tracked file is modified
- Target: `git status --porcelain` / `git diff --name-status <base>..HEAD`
- Why this layer: AC-6 is a repository property, not code behaviour. Expect one `A` for `src/main/java/com/neversoft/vehicle/Vehicle.java` (plus `docs/bob/1/` and the test file) and no `M` or `D`.
- Covers: AC-6

## BDD
### T-3: Developer can load Vehicle by its fully qualified name
```gherkin
Given Vehicle.java has been compiled with javac
When a developer loads the class com.neversoft.vehicle.Vehicle
Then the class is found
And it is declared public
And its package is com.neversoft.vehicle
```
- Target: `src/test/java/com/neversoft/vehicle/VehicleTest.java`
- Why this layer: Shows the AC-1 location and package contract from the consumer's side. It needs the compiled class, but is cheap in the same harness.
- Covers: AC-1, AC-2

### T-4: Developer builds a Vehicle with the no-arg constructor and fills it in with setters
```gherkin
Given a new Vehicle created with the no-arg constructor
When the developer sets id 42, make "Ford", model "Focus", year 2019, vin "WF0AXXGCDA1A12345", color "blue" and mileage 55000
Then getId returns 42, getMake returns "Ford", getModel returns "Focus", getYear returns 2019
And getVin returns "WF0AXXGCDA1A12345", getColor returns "blue" and getMileage returns 55000
```
- Target: `src/test/java/com/neversoft/vehicle/VehicleTest.java`
- Why this layer: Acceptance-level walk through normal JavaBean use. Per-field and edge behaviour is pushed down to T-9 and T-11.
- Covers: AC-2, AC-3

### T-5: Developer builds a Vehicle with the all-fields constructor
```gherkin
Given the values id 7, make "Toyota", model "Corolla", year 2021, vin "JTDKB20U777123456", color "red", mileage 1200
When the developer calls new Vehicle(7, "Toyota", "Corolla", 2021, "JTDKB20U777123456", "red", 1200)
Then every getter returns the value supplied for that field
```
- Target: `src/test/java/com/neversoft/vehicle/VehicleTest.java`
- Why this layer: Caller-visible proof of the constructor contract. Argument-order mistakes are caught precisely in T-10.
- Covers: AC-3

### T-6: Two vehicles with the same data are equal and print all their fields
```gherkin
Given two Vehicle objects created with identical field values
When the developer compares them with equals and reads their hashCode
Then equals returns true and the hash codes are identical
And changing the vin on one makes equals return false
And toString of a vehicle mentions every field value
```
- Target: `src/test/java/com/neversoft/vehicle/VehicleTest.java`
- Why this layer: The value-object contract (collections, logging) is user-visible. One end-to-end scenario shows it, and branch coverage lives in T-12 to T-16.
- Covers: AC-4

## Component
None. `Vehicle` has no API, event, database or module boundary, and nothing references it.

## Unit
### T-7: Vehicle declares exactly seven private instance fields with the specified types
- Target: `src/test/java/com/neversoft/vehicle/VehicleTest.java` (reflection on `getDeclaredFields()`)
- Why this layer: Names, types (`long id`, `String make`, `String model`, `int year`, `String vin`, `String color`, `long mileage`) and private visibility are structural facts, best checked by reflection. Tied to the provisional field list, so it must be updated when fields change.
- Covers: AC-2, risk: Field set does not match the author's needs

### T-8: Vehicle is a plain POJO: extends Object, implements no interfaces, no Maven Mojo types
- Target: `src/test/java/com/neversoft/vehicle/VehicleTest.java` (`getSuperclass()==Object.class`, `getInterfaces().length==0`)
- Why this layer: Guards the POJO interpretation of "mojo". A Maven Mojo would extend `AbstractMojo` and need Maven dependencies. The human-confirmation half of the risk is in Gaps.
- Covers: risk: "Mojo" actually means a Maven plugin Mojo, AC-5

### T-9: No-arg constructor is public and leaves primitives at 0 and Strings at null
- Target: `src/test/java/com/neversoft/vehicle/VehicleTest.java`
- Why this layer: Pure constructor logic. Checks documented defaults (id, year, mileage = 0; make, model, vin, color = null).
- Covers: AC-3

### T-10: All-fields constructor assigns each argument to the matching field using seven distinct values
- Target: `src/test/java/com/neversoft/vehicle/VehicleTest.java`
- Why this layer: Distinct values make transposed arguments (such as make and model swapped) fail. Also checks that no validation is applied (empty strings, negatives and nulls are stored as given).
- Covers: AC-3

### T-11: Every getter returns what its setter stored, including null and boundary values
- Target: `src/test/java/com/neversoft/vehicle/VehicleTest.java`
- Why this layer: Seven setter/getter pairs. Includes null Strings, `Long.MAX_VALUE` for id and mileage, and `Integer.MAX_VALUE` and 0 for year. Also checks other fields stay unchanged, which catches a setter assigning the wrong field.
- Covers: AC-3

### T-12: equals honours its contract: reflexive, symmetric, null, other type, equal copies
- Target: `src/test/java/com/neversoft/vehicle/VehicleTest.java`
- Why this layer: Covers each early branch of `equals` (identity, null, `getClass` mismatch) and the equal-copy case. Pure logic in one class.
- Covers: AC-4

### T-13: equals returns false when any single one of the seven fields differs
- Target: `src/test/java/com/neversoft/vehicle/VehicleTest.java` (loop over seven mutations of a baseline)
- Why this layer: Proves `equals` covers all fields, not a subset. This is the main defect risk for a hand-written `equals`.
- Covers: AC-4

### T-14: equals, hashCode and toString do not throw with null String fields
- Target: `src/test/java/com/neversoft/vehicle/VehicleTest.java`
- Why this layer: The LLP promises null safety via `Objects.equals` and `Objects.hash`. Two all-null vehicles are equal with equal hashes, a null-String vehicle differs from a populated one in both directions, and `toString` returns non-null.
- Covers: AC-4

### T-15: hashCode is consistent with equals and stable across calls
- Target: `src/test/java/com/neversoft/vehicle/VehicleTest.java`
- Why this layer: Equal objects must have equal hashes, and repeated calls on an unmodified object must agree. Mutating a field and restoring it must return the original hash.
- Covers: AC-4

### T-16: toString includes the value of all seven fields
- Target: `src/test/java/com/neversoft/vehicle/VehicleTest.java`
- Why this layer: Seven recognisable values must all appear in the output, so an omitted field is caught. The exact format is not asserted because it is not required.
- Covers: AC-4

## Coverage
| Criterion / risk | Smoke | BDD | Component | Unit |
|---|---|---|---|---|
| AC-1 | T-1 | T-3 | | |
| AC-2 | | T-3, T-4 | | T-7 |
| AC-3 | | T-4, T-5 | | T-9, T-10, T-11 |
| AC-4 | | T-6 | | T-12, T-13, T-14, T-15, T-16 |
| AC-5 | T-1 | | | T-8 |
| AC-6 | T-2 | | | |
| risk: "Mojo" actually means a Maven plugin Mojo | T-1 | | | T-8 |
| risk: Chosen package name/location conflicts with later project structure | | | | |
| risk: Field set does not match the author's needs | | | | T-7 |
| risk: No build tooling to verify compilation in CI | T-1 | | | |

## Gaps
- No component tests: `Vehicle` is a single standalone class with no API, event, database or module boundary, and nothing else references it.
- AC-5 and AC-6 have smoke coverage only (T-1, T-2). They are build and repository properties, not behaviours, so BDD scenarios would add nothing.
- Risk "Mojo actually means a Maven plugin Mojo" is only partly guarded (T-1, T-8). Confirming the interpretation with the author is a human step recorded in the PR description.
- Risk "Chosen package name/location conflicts with later project structure" is not tested. A test cannot prove it, and moving a single file is trivial.
- The test harness (`src/test/java/com/neversoft/vehicle/VehicleTest.java`) is not in the LLP, which lists only `Vehicle.java` and says the optional jshell check is not committed. No JUnit or build file exists, and adding them is out of scope. The plan therefore uses a dependency-free main-method harness run with `javac` and `java`. If the team prefers no extra file, T-3 to T-16 can run as a throwaway jshell or java script instead. Either way, T-2 must allow the added test file.
- Exact `toString` format, input validation, thread safety and serialization are not tested, because the design specifies none of them.

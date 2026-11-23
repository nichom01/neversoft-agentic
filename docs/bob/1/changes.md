# What has changed: #1 New class

## Summary
This branch adds a new `Vehicle` class, a plain Java data object (POJO). It has seven provisional fields: id, make, model, year, VIN, colour and mileage. The issue asked for a "mojo", which the approved plan reads as POJO. The branch also adds a dependency-free test harness for the class and a minimal root `package.json` so `npm test` can compile and run it. No existing file is modified.

## Changes
| Area | Files | What changed | Why |
|---|---|---|---|
| Domain class | [`src/main/java/com/neversoft/vehicle/Vehicle.java`](../../../src/main/java/com/neversoft/vehicle/Vehicle.java) | New `public class Vehicle` in package `com.neversoft.vehicle`. It has private fields `long id`, `String make`, `String model`, `int year`, `String vin`, `String color` and `long mileage`. It has a public no-arg constructor, a public all-fields constructor with no validation, a getter and setter for every field, and `equals`, `hashCode` and `toString` over all seven fields. The class Javadoc says the field list is provisional. | The issue asks for a vehicle "mojo" with best-judgement fields (AC-1 to AC-4). |
| Tests | [`src/test/java/com/neversoft/vehicle/VehicleTest.java`](../../../src/test/java/com/neversoft/vehicle/VehicleTest.java) | New main-method harness with no JUnit. It runs 14 tests (T-3 to T-16) and exits with code 1 if any fail. | The approved test plan calls for T-3 to T-16 in this file. |
| Test runner | [`package.json`](../../../package.json) | New private root `package.json` with no dependencies. Its `test` script compiles `Vehicle.java` and `VehicleTest.java` with `javac --release 25 -Xlint:all -Werror` into a temp directory, then runs `com.neversoft.vehicle.VehicleTest`. | The pipeline runs `npm test --if-present`, which fails without a `package.json` (see [`deviations.md`](deviations.md)). |
| Pipeline docs | `docs/bob/1/` (`hlp.*`, `llp.*`, `tests.*`, `deps.*`, `deviations.md`, `state.json`) | New plan, dependency, deviation and pipeline-state files. | Pipeline artefacts for issue #1. They contain no executable code. |

## Acceptance criteria
| Criterion | Status | Evidence (file, test) |
|---|---|---|
| AC-1: `Vehicle.java` under `src/main/java/` with a package matching its path | Met | [`Vehicle.java`](../../../src/main/java/com/neversoft/vehicle/Vehicle.java) line 1 declares `package com.neversoft.vehicle;`. T-3 checks the package name at runtime. |
| AC-2: public class with private fields id, make, model, year, vin, color, mileage and suitable types | Met | [`Vehicle.java`](../../../src/main/java/com/neversoft/vehicle/Vehicle.java) lines 22-30. T-7 checks names, types and `private` by reflection, and T-3 checks the class is public. |
| AC-3: no-arg constructor, all-fields constructor, getters and setters for every field | Met | [`Vehicle.java`](../../../src/main/java/com/neversoft/vehicle/Vehicle.java) lines 32-99. T-4, T-5, T-9, T-10 and T-11. |
| AC-4: `equals`, `hashCode` and `toString` consistent over all fields | Met | [`Vehicle.java`](../../../src/main/java/com/neversoft/vehicle/Vehicle.java) lines 101-128. T-6 and T-12 to T-16. |
| AC-5: compiles with plain `javac`, no dependencies, no warnings | Partly | The only import is `java.util.Objects`. The `package.json` `test` script uses `-Xlint:all -Werror`. The diff contains no run output, so a clean compile is not shown here. |
| AC-6: no existing files modified | Met | Every file in the diff is `new file mode`. There are 13 files and 1,144 insertions, with no modifications or deletions. |

## Tests: planned vs actual
Test IDs refer to [`tests.md`](tests.md). All harness tests are in `src/test/java/com/neversoft/vehicle/VehicleTest.java`. The diff shows no test run results, so none of these tests is reported as passing.

| Test | Layer | Planned | Status | File |
|---|---|---|---|---|
| T-1 compiles with plain `javac`, no warnings, class lands in package path | smoke | yes | Changed. It is realised only as the compile step of the `npm test` script. The script compiles `Vehicle.java` together with the test file. It has no separate `Vehicle.java`-only compile and no `test -f .../Vehicle.class` check. | `package.json` |
| T-2 only additions, no tracked file modified | smoke | yes | Missing. No script or file performs this git check. AC-6 is supported by the diff itself (all files new). | none |
| T-3 load `Vehicle` by fully qualified name | bdd | yes | Created (`t3`) | `src/test/java/com/neversoft/vehicle/VehicleTest.java` |
| T-4 no-arg constructor plus setters | bdd | yes | Created (`t4`) | same |
| T-5 all-fields constructor | bdd | yes | Created (`t5`) | same |
| T-6 equal vehicles are equal and print all fields | bdd | yes | Created (`t6`) | same |
| T-7 seven private fields with specified types | unit | yes | Created (`t7`) | same |
| T-8 plain POJO: superclass `Object`, no interfaces | unit | yes | Created (`t8`) | same |
| T-9 no-arg constructor is public with defaults | unit | yes | Created (`t9`) | same |
| T-10 all-fields constructor with distinct values and no validation | unit | yes | Created (`t10`) | same |
| T-11 getters return what setters stored, including boundary values | unit | yes | Created (`t11`) | same |
| T-12 `equals` contract | unit | yes | Created (`t12`) | same |
| T-13 `equals` false when any one field differs | unit | yes | Created (`t13`) | same |
| T-14 null-safe `equals`, `hashCode`, `toString` | unit | yes | Created (`t14`) | same |
| T-15 `hashCode` consistent and stable | unit | yes | Created (`t15`) | same |
| T-16 `toString` includes all fields | unit | yes | Created (`t16`) | same |
| (unplanned) | n/a | no | No unplanned tests found. All 14 methods in `main` map to T-3 to T-16. | n/a |

## Deviations from the plan
- **Test file added.** The low-level plan (LLP) lists only `Vehicle.java` and treats the jshell check as uncommitted. The approved test plan requires `VehicleTest.java` for T-3 to T-16, so it is committed. The LLP statement that "no other file is created" no longer holds. [`deviations.md`](deviations.md) records this.
- **`package.json` added.** It is not in the LLP or the test plan. The LLP said not to add build files. [`deviations.md`](deviations.md) gives the reason: the pipeline's `npm test --if-present` fails with `ENOENT` when there is no root `package.json`. The author chose this over editing `tools/bob-pipeline/pipeline.yaml`. The file is a test runner only, not a Java build file.
- **T-1 and T-2 are not standalone checks.** See the test table above.
- **High-level plan (HLP) assumption superseded.** The HLP assumed no tests are needed for a plain data class. Tests were added following the approved test plan.
- **Harness Javadoc.** The usage comment in `VehicleTest.java` shows `javac` without `-Xlint:all -Werror`. The `package.json` script uses them.
- **`Vehicle.java` matches the LLP.** Fields, order, types, constructors, accessors, `equals`, `hashCode` and `toString` text follow the LLP. `equals` compares the primitives first and then the Strings. The LLP does not fix that order.

## Risks and things reviewers should check
- **"Mojo" interpretation.** The plan reads "mojo" as POJO (author comment: "mojo is mojo", Java 25). If a Maven plugin Mojo was meant, `Vehicle` is the wrong shape. The LLP asks for the interpretation to be recorded in the PR description. The diff cannot confirm that was done.
- **Provisional fields.** T-7 hard-codes the seven field names and types. Any field change must update `Vehicle.java` and `VehicleTest.java` together.
- **`package.json` in a Java repo.** Check that a root `package.json` is acceptable. It might later clash with a Maven or Gradle layout or with other npm tooling.
- **`javac --release 25` needs a JDK 25 or later.** Check that the CI and local environments have one.
- **Test results not in the diff.** Run `npm test` and confirm 14 tests pass with no `-Werror` failures. The suppression annotation `@SuppressWarnings({"EqualsWithItself", "ConstantConditions"})` on `t12` uses IDE inspection names, not `javac` lint names.
- **Missing T-2 check.** Run `git diff --name-status <base>..HEAD` and confirm there is no `M` or `D` entry.
- **No input validation.** The all-fields constructor and the setters accept null, negative and empty values (deliberate, and covered by T-10).
- **Mutable `hashCode`.** `hashCode` depends on mutable fields, as is usual for this style of POJO.

## Follow-ups
- Confirm the "mojo" = POJO reading with the issue author and record it in the PR description.
- A later issue to revise the field list.
- Decide whether to keep the harness and `package.json` or move to a standard Java build with JUnit.
- Add the T-2 git check, or accept the diff as evidence for AC-6.

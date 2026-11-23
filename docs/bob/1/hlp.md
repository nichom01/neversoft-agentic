# High-level plan: #1 New class

## Summary
Add a single new Java source file defining a `Vehicle` class as a plain data object (the issue says "mojo"; interpreted as POJO) with a sensible initial set of fields. Fields are expected to be revised later.

## Approach
Create one `Vehicle.java` containing a simple POJO: private fields, a no-arg constructor, an all-args constructor, getters/setters, and `equals`/`hashCode`/`toString`. The repository currently contains no Java code and no build file (only pipeline tooling in TypeScript under `tools/bob-pipeline`), so the class is added under a conventional Maven/Gradle-style layout (`src/main/java/<package>/Vehicle.java`) without introducing a build system. Initial fields use best judgement: `id`, `make`, `model`, `year`, `vin`, `color`, `mileage`. Keeping the class minimal and dependency-free makes later field changes cheap.

## Alternatives considered
- Java `record` — rejected: the issue asks for a mutable-looking "mojo/POJO" and fields are expected to change; a conventional class is more broadly compatible and easier to evolve.
- Lombok-annotated class — rejected: would add a dependency and a build system that do not exist in the repo.
- Add a full Maven/Gradle project alongside the class — rejected: out of scope for the request.
- Interpret "mojo" as a Maven plugin Mojo — rejected: a Maven Mojo is an executable plugin goal and does not fit "a vehicle class"; the vehicle-domain data-object reading is far more plausible.

## Components affected
- Java source tree (new) — new `Vehicle` domain class; no existing components modified.

## Acceptance criteria
- AC-1: A new file `Vehicle.java` exists under `src/main/java/` in a package declared consistently with its directory path.
- AC-2: `Vehicle` is a public class with private fields for id, make, model, year, vin, color and mileage, using appropriate types.
- AC-3: `Vehicle` provides a no-arg constructor, an all-fields constructor, and getters and setters for every field.
- AC-4: `Vehicle` overrides `equals`, `hashCode` and `toString` consistently over its fields.
- AC-5: The file compiles with a standard JDK (`javac`) with no external dependencies and no warnings.
- AC-6: No existing files in the repository are modified.

## Dependencies on other issues
- None known

## Assumptions
- "Mojo" is a typo/variant of "POJO" (plain old Java object).
- No Java code, build file or package convention exists, so the package name (e.g. `com.neversoft.vehicle`) and `src/main/java` layout are chosen by us.
- Target Java version is Java 25 (per author feedback).
- Field list is provisional and will be revised in a follow-up.
- No tests are required for a plain data class in this issue.

## Risks
| Risk | Severity | Mitigation |
|---|---|---|
| "Mojo" actually means a Maven plugin Mojo | medium | Record the interpretation in the PR description and confirm with the issue author. |
| Chosen package name/location conflicts with later project structure | low | Use a conventional layout; moving a single file is trivial. |
| Field set does not match the author's needs | low | Explicitly provisional per the issue; keep class simple to change. |
| No build tooling to verify compilation in CI | low | Verify with plain `javac` locally. |

## Open questions
- None. (Previous questions resolved via reviewer feedback: terminology "mojo" is confirmed as POJO-style, and Java 25 is approved).

## Complexity
S — one new, self-contained, dependency-free file.

## Revision notes
- Updated the target Java version from LTS (17 or 21) to Java 25 per author feedback.
- Closed open questions regarding the terminology "mojo" (proceeding as planned with a POJO-style domain class) and the preferred Java version (Java 25).

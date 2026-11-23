# Low-level plan: #1 New class

## Overview
The approved high-level plan adds one self-contained POJO, `Vehicle`, in a new Java source tree. A search confirmed the repository contains no `*.java` files and no build file, so there is nothing to integrate with. The implementation is a single new file at `src/main/java/com/neversoft/vehicle/Vehicle.java`, written for Java 25, with no dependencies and no changes to existing files.

## Changes by file
### src/main/java/com/neversoft/vehicle/Vehicle.java (create)
- Declare `package com.neversoft.vehicle;` (matches the directory path).
- Declare `public class Vehicle` (not `final`, not a `record`, no annotations, no imports other than `java.util.Objects`).
- Private fields, in this order, with these types:
  - `private long id;`
  - `private String make;`
  - `private String model;`
  - `private int year;`
  - `private String vin;`
  - `private String color;`
  - `private long mileage;`
- Constructors:
  - Public no-arg constructor `public Vehicle() { }`.
  - Public all-fields constructor `public Vehicle(long id, String make, String model, int year, String vin, String color, long mileage)`. It assigns the fields directly, with no validation.
- Accessors: a public getter and setter for every field, using standard JavaBean names (`getId`/`setId`, `getMake`/`setMake`, `getModel`/`setModel`, `getYear`/`setYear`, `getVin`/`setVin`, `getColor`/`setColor`, `getMileage`/`setMileage`). Setters return `void`.
- `equals(Object o)`:
  - Return `true` if `this == o`.
  - Return `false` if `o` is `null` or `getClass() != o.getClass()`.
  - Cast to `Vehicle` and compare ALL fields: primitives with `==`, Strings with `Objects.equals`.
- `hashCode()`: `Objects.hash(id, make, model, year, vin, color, mileage)`. It uses the same field set as `equals`.
- `toString()`: `"Vehicle{id=" + id + ", make='" + make + "', model='" + model + "', year=" + year + ", vin='" + vin + "', color='" + color + "', mileage=" + mileage + "}"`. It includes all fields.
- Add `@Override` on `equals`, `hashCode` and `toString`.
- Add a short class Javadoc stating the field list is provisional. Do not add per-method Javadoc.
- Keep all field types and the `equals`/`hashCode`/`toString` field sets in sync.
- Symbols: `Vehicle`, `Vehicle()`, `Vehicle(long, String, String, int, String, String, long)`, `getId`, `setId`, `getMake`, `setMake`, `getModel`, `setModel`, `getYear`, `setYear`, `getVin`, `setVin`, `getColor`, `setColor`, `getMileage`, `setMileage`, `equals`, `hashCode`, `toString`
- Covers: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6

No other file is created or modified (AC-6). Do not add a `pom.xml`, `build.gradle`, `.gitignore` entry or compiled `.class` output to the repository. Write any `javac` output to a temp directory outside the repo.

## Interfaces
```java
package com.neversoft.vehicle;

public class Vehicle {
    public Vehicle();
    public Vehicle(long id, String make, String model, int year, String vin, String color, long mileage);

    public long getId();            public void setId(long id);
    public String getMake();        public void setMake(String make);
    public String getModel();       public void setModel(String model);
    public int getYear();           public void setYear(int year);
    public String getVin();         public void setVin(String vin);
    public String getColor();       public void setColor(String color);
    public long getMileage();       public void setMileage(long mileage);

    @Override public boolean equals(Object o);
    @Override public int hashCode();
    @Override public String toString();
}
```
Type rationale: `long id` for a database-style key, `int year` for a model year, `long mileage` to avoid overflow. All three are primitives, so they default to 0 under the no-arg constructor. The String fields default to `null`, and `equals`, `hashCode` and `toString` handle that through `Objects`.

## Data and configuration changes
None.

## Test approach
| Layer | What | Covers |
|---|---|---|
| smoke | From the repo root, run `javac --release 25 -Xlint:all -Werror -d "$(mktemp -d)" src/main/java/com/neversoft/vehicle/Vehicle.java`. It must exit 0 with no output, which shows the file compiles with only the JDK and no warnings. | AC-1, AC-5 |
| smoke | Run `git status --porcelain`. It must list only `src/main/java/com/neversoft/vehicle/Vehicle.java` and the `docs/bob/1/` plan files. No existing tracked file may show as modified. | AC-6 |
| unit | Optional throwaway check, not committed. In `jshell --class-path <tempdir>`, construct two `Vehicle` instances with identical args and confirm `equals` is true, hash codes match and `toString` lists all 7 fields. Then change one field and confirm `equals` is false. Also confirm `new Vehicle().getMake()` is `null` and that `equals` and `hashCode` do not throw on null Strings. | AC-2, AC-3, AC-4 |

The HLP states no committed tests are required for a plain data class. There is no Java test framework in the repo, and adding one would be out of scope. Review of the file against this plan covers the structural criteria in AC-2 and AC-3 (fields, constructors, accessors).

## Rollout
Single commit adding the one file. There is no build, flag or compatibility concern, and no existing code references the class. A follow-up issue can revise the fields, and if "mojo" turns out to mean a Maven Mojo, the file can be replaced. The PR description should record the "mojo" = POJO interpretation (per the HLP risk mitigation).

## Open questions
None

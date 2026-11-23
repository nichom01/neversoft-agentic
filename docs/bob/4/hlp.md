# High-level plan: #4 sales orders

## Summary
Add Java domain classes for `SalesOrder`, `SalesOrderLine`, and `Customer`, establishing parent-child relationships between sales orders and order lines, as well as associating sales orders with customers.

## Approach
Create plain old Java object (POJO) domain classes (`SalesOrder`, `SalesOrderLine`, and `Customer`) in standard package structures under `src/main/java/com/neversoft/`. `SalesOrder` will manage order header attributes, a reference to a `Customer`, and a list of `SalesOrderLine` child items. `SalesOrderLine` will represent individual order items (e.g. product/item identifier, quantity, unit price, total), and `Customer` will represent customer information. Each class will provide standard private fields, no-argument and parameterized constructors, getters and setters, and consistent `equals`, `hashCode`, and `toString` implementations without external dependencies, matching the existing domain style in the repository.

## Alternatives considered
- Single composite class or inner static classes — rejected because separate top-level domain classes provide better modularity, separation of concerns, and ease of extension as domain models grow.
- Java records — rejected to maintain consistency with existing POJO conventions (`Vehicle.java`), enable mutability for order lifecycle changes, and support broader framework compatibility.
- JPA / ORM annotations — rejected because no database infrastructure or ORM dependencies exist in the repository; domain models should remain lightweight and dependency-free.
- Lombok annotations — rejected because the project does not use Lombok or annotation-processing build plugins.

## Components affected
- Sales domain model (new) — new `SalesOrder` and `SalesOrderLine` domain classes representing orders and line items.
- Customer domain model (new) — new `Customer` domain class representing customer entities associated with orders.

## Acceptance criteria
- AC-1: A public `SalesOrder` class is created with fields for order identification, order date, status, customer reference, and a collection of `SalesOrderLine` objects.
- AC-2: A public `SalesOrderLine` class is created with fields for line identification, item description or code, quantity, unit price, and line amount.
- AC-3: A public `Customer` class is created with fields for customer identification, name, and contact details.
- AC-4: `SalesOrder` provides methods to associate with a `Customer` and manage its collection of `SalesOrderLine` child objects.
- AC-5: All domain classes provide no-arg constructors, parameterized constructors, getters, setters, and consistent `equals`, `hashCode`, and `toString` methods.
- AC-6: All classes compile cleanly with standard JDK (`javac`) with no external dependencies and no warnings.
- AC-7: No existing repository files are modified.

## Dependencies on other issues
- None known

## Assumptions
- Classes will follow plain Java object (POJO) conventions consistent with `Vehicle.java`.
- Initial field sets for `SalesOrder`, `SalesOrderLine`, and `Customer` are sensible domain defaults and can be adapted in future issues.
- Target Java version is Java 25.
- No external persistence or database frameworks are required.

## Risks
| Risk | Severity | Mitigation |
|---|---|---|
| Domain field requirements evolve as business logic is added | low | Maintain simple, decoupled POJO classes so field additions and modifications are trivial. |
| Circular reference between `SalesOrder` and `SalesOrderLine` in `toString`/`hashCode`/`equals` | low | Avoid bidirectional reference recursion in `toString` and hash calculations. |
| Package naming conflicts with future modularization | low | Use conventional package paths (e.g. `com.neversoft.sales` and `com.neversoft.customer`). |

## Open questions
- None

## Complexity
S — three self-contained POJO domain classes with standard relationships and no external dependencies.

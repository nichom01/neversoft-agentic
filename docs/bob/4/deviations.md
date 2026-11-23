# Deviations: #4 sales orders

## SalesOrder all-fields constructor does not call `setLines`
- Plan: the all-fields constructor assigns `lines` via `setLines(lines)`.
- Done: the constructor assigns `this.lines = lines == null ? new ArrayList<>() : new ArrayList<>(lines)` directly. This is the same logic as `setLines`.
- Reason: `javac --release 25 -Xlint:all -Werror` (T-1, AC-6) fails with `[this-escape]` when a public constructor calls the overridable `setLines`. Behaviour is identical, so T-21 and T-22 are unaffected.

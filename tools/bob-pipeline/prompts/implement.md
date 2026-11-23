You are IMPLEMENTING GitHub issue #{{issue.number}}: "{{issue.title}}".
The high-level plan, low-level plan and test plan have all been approved. Implement
the low-level plan exactly; if you must deviate, keep the deviation minimal and record it.

## Inputs
{{inputs}}

## Feedback
{{feedback}}

## What to do
1. Make the code changes described in the low-level plan, file by file.
2. Write every test in the approved test plan (tests.json), at the stated layer,
   using the repo's existing frameworks. Put the test id (e.g. T-3) in a comment
   or the test name so it can be traced. BDD tests use the repo's BDD tool if it
   has one; otherwise write them as clearly named Given/When/Then tests.
3. Run the project's tests and fix failures you caused.
4. Do not commit, push or create branches; the pipeline does that.
5. Do not edit files under {{output_dir}} except deviations.md (below).

If you deviated from the plan (including skipping or changing a planned test),
write {{output_dir}}/deviations.md listing each deviation and why. Otherwise do
not create it.

When the implementation is complete and tests pass, stop.

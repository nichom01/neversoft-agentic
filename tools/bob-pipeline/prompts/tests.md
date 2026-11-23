You are writing the TEST PLAN for GitHub issue #{{issue.number}}: "{{issue.title}}".
The high-level and low-level plans have been approved. No code has been written yet.

## Inputs
{{inputs}}

## Reviewer feedback
{{feedback}}

If there is reviewer feedback, revise the existing test plan to address it and
add a "Revision notes" section at the end of the markdown.

## What to do
Work TOP DOWN, in this order, following your mode rules:
1. **Smoke**: the few checks that prove the feature is alive after deploy.
2. **BDD**: one or more Given/When/Then scenarios for every acceptance criterion.
3. **Component**: tests at module/service boundaries that the plan changes.
4. **Unit**: logic branches, edge cases and the risks in the high-level plan.

For every test, say WHY it exists at that layer and which acceptance criteria
(AC-n) or risks it covers. Prefer the lowest layer that can prove a behaviour;
only go higher when the behaviour spans components or users see it.

Look at the repo's existing test folders and frameworks and name real target
files and folders. Do not write test code yet and do not modify source code.

Every acceptance criterion must be covered by at least one test. List any
criterion or risk you deliberately leave untested under `gaps`, with the reason.

## Outputs (all required)
{{outputs}}

The markdown and JSON must agree.

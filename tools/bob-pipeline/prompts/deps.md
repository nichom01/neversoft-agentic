You are checking CROSS-ISSUE DEPENDENCIES for GitHub issue #{{issue.number}}: "{{issue.title}}".
Its high-level plan has been approved.

## Inputs
{{inputs}}

The `all_open` files are the high-level plans of the other open issues in the
pipeline; INDEX.md lists them. If there are none, report no dependencies.

## Reviewer feedback
{{feedback}}

If there is reviewer feedback, revise the existing outputs to address it and add
a "Revision notes" section at the end of the markdown.

## What to do
Compare this issue's plan with every other plan. Look for:
- one plan relying on work another issue delivers (blocked_by / blocks),
- both plans touching the same files or components (overlaps: merge order matters),
- assumptions or designs that contradict each other (conflicts).
Only report what you can justify from the plans, and set confidence honestly
(see your mode rules). Do not modify any source code.

## Outputs (all required)
{{outputs}}

The markdown and JSON must agree. Write a `recommended_order` covering this
issue and every issue it has a dependency with.

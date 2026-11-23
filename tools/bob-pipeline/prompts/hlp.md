You are producing the HIGH-LEVEL PLAN for GitHub issue #{{issue.number}}: "{{issue.title}}".

## Inputs
Read these files before doing anything else:
{{inputs}}

## Reviewer feedback
{{feedback}}

If there is reviewer feedback, revise the existing plan to address every point and
add a short "Revision notes" section at the end of the markdown saying what changed.

## What to do
1. Read the issue and explore the codebase enough to understand the affected areas.
   Do not modify any source code.
2. Write the plan following the template in your mode rules.

## Outputs (all required)
{{outputs}}

The JSON file must validate against its schema. Do not wrap JSON in markdown fences.
When both files are written, stop.

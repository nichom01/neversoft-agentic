You are producing the LOW-LEVEL PLAN for GitHub issue #{{issue.number}}: "{{issue.title}}".
The high-level plan has been approved by a reviewer. Stay within its scope.

## Inputs
{{inputs}}

## Reviewer feedback
{{feedback}}

If there is reviewer feedback, revise the existing low-level plan to address every
point and add a "Revision notes" section at the end of the markdown.

## What to do
1. Read the approved high-level plan and the relevant source files.
   Do not modify any source code.
2. Produce a file-by-file plan detailed enough that the implementation stage can
   follow it without re-deciding the design. Follow the template in your mode rules.

## Outputs (all required)
{{outputs}}

The JSON file must validate against its schema. When both files are written, stop.

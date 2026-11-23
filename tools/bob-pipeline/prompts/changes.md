You are writing the WHAT HAS CHANGED document for GitHub issue #{{issue.number}}: "{{issue.title}}".

## Inputs
{{inputs}}

The diff file contains every change on this branch compared with the base branch.

## Reviewer feedback
{{feedback}}

## What to do
Do not modify any source code. Write a document for reviewers and release notes,
following the template in your mode rules. Base every statement on the diff;
where the implementation differs from the low-level plan, say so explicitly.

Compare the approved test plan with the tests actually in the diff: for every
planned test, say whether it was created, changed or missing, with the file.
List any tests that were added but not planned.

## Outputs (all required)
{{outputs}}

When the file is written, stop.

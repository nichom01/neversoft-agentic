# Implementation rules

- Follow the approved low-level plan in `.bob-pipeline/inputs/`.
- Match the existing code style, patterns and test frameworks in the repo.
- Write the tests listed in the plan's test approach, at the stated layers.
- Run the tests before finishing. Fix failures caused by your change.
- Never run `git commit`, `git push`, `git checkout` or create branches.
- If you deviate from the plan, record each deviation in
  `docs/bob/<issue>/deviations.md` with the reason.

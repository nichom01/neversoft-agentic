# bob-pipeline

A local, config-driven pipeline that takes a GitHub issue through IBM Bob:

**high-level plan → dependency check → low-level plan → test plan → implement → what has changed**

GitHub labels are the source of truth. A local web app shows a dashboard of
issues, lets you review and approve each stage, and runs Bob Shell headlessly
on your machine. No GitHub runners are needed.

```
bob:start ─▶ hlp       ─▶ bob:hlp-review     ─(approve)─▶ bob:hlp-approved
          ─▶ deps      ─▶ bob:deps-review    ─(approve)─▶ bob:deps-approved   (records dependencies on GitHub)
          ─▶ llp       ─▶ bob:llp-review     ─(approve)─▶ bob:llp-approved
          ─▶ tests     ─▶ bob:tests-review   ─(approve)─▶ bob:tests-approved
          ─▶ implement (auto; waits for open "blocked by" issues) ─▶ bob:implement-approved
          ─▶ changes   ─▶ bob:changes-review ─(approve)─▶ bob:done
```

## What's in the box

```
.bob/                              # goes at your repo root
  custom_modes.yaml                # one Bob mode per stage
  rules-<mode>/                    # per-mode templates and rules
tools/bob-pipeline/
  pipeline.yaml                    # THE PROCESS: stages, gates, inputs, outputs
  prompts/<stage>.md               # prompt templates
  schemas/<stage>.schema.json      # JSON Schemas Bob's JSON output must match
  packages/shared/                 # pipeline schema, state machine, API types
  apps/server/                     # Fastify: poller, queue, runner, GitHub, git
  apps/web/                        # React dashboard and review UI
```

## Setup

Prerequisites: Node 22.13 or later (it uses Node's built-in SQLite, so nothing native is compiled), git, the GitHub CLI (`gh auth login` done), Bob Shell
installed, and a Bob API key.

```bash
# 1. Copy .bob/ and tools/bob-pipeline/ into your repo root, then:
cd tools/bob-pipeline
npm install

# 2. Bob API key for headless runs (keep it out of git)
export BOB_API_KEY=...            # or put it in your shell profile

# 3. Check the config, then create the labels in GitHub
npm run validate
npm run setup-labels

# 4. Run it
npm start                          # builds the UI, serves http://localhost:4321
npm start -- --auto-poll           # ...and poll GitHub for work
npm run dev                        # development: hot reload on :5173
```

Edit `pipeline.yaml` first:
- `repo.base_branch` if it isn't `main`.
- The `implement` stage's test command (`npm test --if-present`).
- The `bob.args` if your Bob Shell version uses different flags. Check with
  `bob run --help`; the defaults assume Bob Shell v2 (`bob run --mode ... --format stream-json`).

## Day to day

- **Start an issue:** add `bob:start` in GitHub, or press *Start pipeline* in the dashboard.
- **Review:** open the issue in the dashboard, read the plan (toggle *Show changes
  since previous version* after a revision), then *Approve* or *Request changes*
  with a comment. You can also do it in GitHub: add `bob:<stage>-approved`, or
  comment and add `bob:revise`.
- **Failures:** the issue gets `bob:failed` and a comment with the error. Press
  *Retry* or *Resume Bob task* (continues the same Bob task with `--resume`).
- **Park:** `bob:parked` takes an issue out of the flow until removed.

### Who runs the work

Any machine running the app can do work. Have **one person turn on auto-poll**;
everyone else uses the buttons (approving runs the next stage on your machine
if *Run the next step on this machine now* is ticked).

If two machines pick up the same issue, the claim check resolves it: each adds
`bob:working` and a claim comment, waits `claim_settle_seconds`, and the earliest
claim wins. If a machine crashes mid-run, its lock stays; use *Clear stale lock*
in the dashboard. If *this* app stops mid-run, on restart it marks the run
interrupted and offers *Resume*.

### Where things happen

- Each issue gets its own git worktree under `~/.bob-pipeline/worktrees/<repo>/issue-N`
  on branch `bob/issue-N`. Your own checkout is never touched (apart from
  `git fetch`). The worktree belongs to the pipeline: it is reset to the remote
  branch before each run.
- Stage outputs are committed to `docs/bob/<issue>/` on the branch, along with
  `state.json` (pipeline version, run history, PR link).
- Inputs for Bob (issue text, feedback, diffs) are written to `.bob-pipeline/` in
  the worktree, which is git-excluded.
- Run history and logs live in `tools/bob-pipeline/.data/` (SQLite). It is only a
  cache: deleting it loses local history, nothing else.

## Changing the process

Almost everything is `pipeline.yaml` plus prompt, rule and schema files.
Run `npm run validate` after any change.

| To… | Change |
|---|---|
| change what Bob does in a stage | `prompts/<stage>.md` or `.bob/rules-<mode>/` |
| change a stage's tool permissions | its mode in `.bob/custom_modes.yaml` |
| add a stage | new mode + prompt (+ schema) + an entry in `pipeline.yaml` |
| remove or reorder stages | edit `stages:` |
| skip a human review | `gate: auto` |
| run tests/linters/scripts | `pre:` / `post:` steps (`run:` with `on_fail: fail \| continue \| retry_with_output`) |
| cost limits | `max_cost`, `max_turns` per stage or in `defaults` |
| how the UI shows a stage | `view: plan \| raw \| diff \| dependency-graph \| test-pyramid` |
| do something when a reviewer approves | `on_approve:` actions (e.g. `add_issue_dependencies`) |
| hold a stage until blockers are closed | `wait_for_blockers: true` |

Labels are derived from stage ids, so adding a stage `security` creates
`bob:security-review` and `bob:security-approved`. Run `npm run setup-labels` again.

### Prompt template variables

`{{issue.number}}`, `{{issue.title}}`, `{{inputs}}` (list of input files),
`{{outputs}}` (required output files with their schemas), `{{feedback}}`,
`{{output_dir}}`, `{{branch}}`, `{{stage}}`.

### Inputs

`issue`, `feedback`, `diff`, any earlier stage id (its outputs), and
`all_open:<stage>` (that stage's outputs for every other open issue, used by
the phase-2 dependency check). Add your own in `apps/server/src/inputs/index.ts`
with `registerInput()`.

### Actions

`open_draft_pr`, `update_pr_body` (`with: { file }`), `post_comment`
(`with: { file }`), `add_issue_dependencies` (`with: { file, min_confidence }`:
records `blocked_by` entries from `deps.json` as GitHub issue dependencies),
`check_traceability` (`with: { plan, tests, mode: warn | fail }`: checks every
acceptance criterion and risk has a test). Add your own in
`apps/server/src/actions/index.ts` with `registerAction()`.

### Views

Register a React component in `apps/web/src/views/index.tsx`. Unknown views fall
back to `plan`, so a new stage is usable before it has a custom view.

## Dependencies across issues

The **Dependencies** page (top nav) shows every issue in the pipeline as a graph,
combining four sources, strongest first:

| Source | Where it comes from |
|---|---|
| GitHub | "blocked by" links already recorded on GitHub (solid green) |
| Dependency check | the `deps` stage's `deps.json` (dashed orange) |
| Plan | `depends_on_issues` in each high-level plan (dashed blue) |
| Same files/components | plans that list the same files or components (dotted grey) |

It also shows a suggested order (blockers first), circular dependencies, and
conflicting plans. From the review table you can record a suggested link on
GitHub, or for an overlap choose which issue goes first.

The `deps` stage runs after each high-level plan is approved and compares it with
every other open plan. Approving it records its high-confidence `blocked_by`
links on GitHub (`on_approve` in `pipeline.yaml`). The `implement` stage has
`wait_for_blockers: true`, so it won't start until those blockers are closed.
The poller keeps checking, and the issue page says what it's waiting for.

Plans are only compared with plans that exist at the time. If a new issue's
plan overlaps an older one, it shows on the Dependencies page straight away
(the graph reads both directions); the older issue's `deps.json` isn't rerun.

GitHub issue dependencies need github.com or a recent GitHub Enterprise Server.
Where the API isn't available, the graph still works from the other sources,
and recording links is disabled.

## Test plans

The `tests` stage plans tests top down before any code is written: smoke, then
BDD scenarios for each acceptance criterion, then component, then unit tests.
Each test says why it sits at that layer and which criteria (`AC-n`) or risks it
covers. The test plan view shows:
- **Pyramid:** the number of tests at each layer. Click a layer to filter.
- **Coverage matrix:** criteria and risks against layers. Anything uncovered is shown in red.
- **Tests:** each test's target, reason, Gherkin and traces.

`check_traceability` logs any criteria or risks without a test after the stage
runs. Set `mode: fail` to make that fail the stage instead. The implement stage
gets the approved test plan as input and tags tests with their ids. The
what-changed document then compares planned tests with what's in the diff.

## Things to check against your Bob version

These were written from IBM's Bob Shell docs but haven't been run against a real Bob install:

- **CLI flags** in `bob.args`, and that `--mode` accepts custom mode slugs.
  Older Bob Shell used `bob -p "…" --chat-mode=<slug> --yolo`. If yours does, set:
  `args: [--chat-mode={{mode}}, --yolo, -p]` and `prompt_via: arg`.
- **stream-json fields:** the runner reads task id and cost from common field
  names (`task_id`, `session_id`, `total_cost`, `cost`…) and shows any line it
  can't parse as plain text, so a different format still works. Only resume and
  cost tracking depend on it.
- **Tool-group syntax** in `.bob/custom_modes.yaml` (the `fileRegex` restrictions).

## Security notes

- The server binds to `127.0.0.1` only. It acts with your GitHub identity (from
  `gh auth token`) and has no login of its own, so don't expose it on a network.
- The implement stage runs Bob with edit and command permissions in the issue
  worktree, and runs the `post:` commands. Treat issue text as untrusted input:
  anyone who can open issues can influence what Bob is asked to do. Only start
  issues you've read.

## Known limits

- An issue records the pipeline version it started with, and the log notes a
  mismatch. Issues in flight then continue with the *current* config. Old
  configs aren't kept, so avoid removing or renaming a stage while issues are
  part-way through it.
- The dashboard shows open issues only.

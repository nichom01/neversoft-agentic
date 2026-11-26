# bob-pipeline

A local, config-driven pipeline that takes a GitHub issue through IBM Bob, one
reviewed stage at a time:

**high-level plan → dependency check → low-level plan → test plan → implement → what has changed**

GitHub labels are the source of truth. A local web app shows a dashboard of
issues, lets you review and approve each stage, and runs Bob Shell headlessly
on your machine. No GitHub runners are needed.

This folder is self-contained. Copy `tools/bob-pipeline/` into a repo and it
works there. Nothing is needed at the repo root.

- [Quick start](#quick-start)
- [Install in another repo](#install-in-another-repo)
- [Configure Bob](#configure-bob)
- [How the stages work](#how-the-stages-work)
- [Gates: human vs auto](#gates-human-vs-auto)
- [Day to day](#day-to-day)
- [Where things happen](#where-things-happen)
- [Troubleshooting](#troubleshooting)
- [Changing the process](#changing-the-process)

## Quick start

For the repo this folder already lives in, there is no config to change. You
only need the one-time, per-machine setup.

```bash
cd tools/bob-pipeline
npm install
export BOB_API_KEY=...        # your Bob API key; put it in your shell profile, never in git
gh auth login                 # once, if you haven't already
npm run validate              # checks pipeline.yaml against the files it refers to
npm run setup-labels          # creates the bob:* labels in the GitHub repo (once per repo)
npm start                     # builds the UI and serves http://localhost:4321
```

Then open an issue in GitHub and either add the `bob:start` label or press
*Start pipeline* in the dashboard.

**Does it just work in the repo it lives in?** Yes. `pipeline.yaml` has
`repo.path: ../..`, which is the repo root when this folder sits at
`tools/bob-pipeline/`. The owner and repo name come from your `origin` remote.
The tool's own modes and rules (`.bob/`) are installed into each issue's
worktree automatically (see [Configure Bob](#configure-bob)).

What is *not* automatic, and is needed once:

| Needed | Why |
|---|---|
| `npm install` | per machine; `node_modules/` is git-ignored |
| `BOB_API_KEY` in the environment | Bob Shell headless runs need it |
| `gh auth login` (or `GITHUB_TOKEN`) | the app acts with your GitHub identity |
| `npm run setup-labels` | creates the `bob:*` labels; once per GitHub repo |
| `origin` on GitHub, with the base branch pushed | worktrees are created from `origin/<base_branch>` |

## Install in another repo

Prerequisites: Node 22.13 or later (it uses Node's built-in SQLite, so nothing
native is compiled), git, the GitHub CLI, Bob Shell installed (`bob --version`
works), and a Bob API key. The target repo must be a clone with an `origin`
remote on GitHub (github.com or Enterprise Server).

```bash
# 1. Copy the folder (skip build output and local data)
rsync -a --exclude node_modules --exclude dist --exclude '.data*' --exclude .DS_Store \
  tools/bob-pipeline/ /path/to/other-repo/tools/bob-pipeline/

# 2. Install and check
cd /path/to/other-repo/tools/bob-pipeline
npm install
export BOB_API_KEY=...
npm run validate          # fix anything it reports before continuing

# 3. Edit pipeline.yaml for this repo (table below), then
npm run validate
npm run setup-labels
npm start                 # or: npm start -- --auto-poll
```

Edit `pipeline.yaml` for the new repo before you run anything:

| Setting | What to do |
|---|---|
| `repo.path` | `../..` is right if the folder is at `<repo>/tools/bob-pipeline`. Anywhere else, set it to the repo root (relative to `pipeline.yaml`, or absolute). |
| `repo.base_branch` / `repo.remote` | `main` / `origin` by default. Change if yours differ. |
| `repo.owner` / `repo.name` | Normally read from the remote URL. Set them only if that fails. |
| `implement` stage `post:` | **Replace the build check.** The shipped command compiles Java files; use your real build or test command (`npm test`, `mvn -q test`, `./gradlew test`, `pytest`...). It also skips `./tools/*`, so adjust that if the folder is elsewhere. |
| `max_cost` / `max_turns` | Per stage, or under `defaults:`. The implement stage is the expensive one. |
| `prompts/*.md`, `.bob/rules-*/` | Tune the wording and templates for the new codebase's language and conventions. |

Notes:

- **Committing the folder is optional.** The app runs from your local clone and
  never needs the tool inside the issue branches. Commit it if you want
  teammates to get it; `node_modules/`, `.data*/` and `dist/` are ignored by
  the folder's own `.gitignore`. If you don't commit it, add `tools/bob-pipeline/`
  to `.git/info/exclude` to keep `git status` clean.
- **One config per repo.** Each copy has its own `pipeline.yaml`, `.bob/` and
  `.data/`. To keep several configs in one copy, point `BOB_PIPELINE_CONFIG`
  at another yaml file.
- **Moved the folder? Restart the server.** It resolves the repo path once at
  startup; after a move, every issue page fails with `spawn git ENOENT`.
- The server listens on `127.0.0.1:4321` (`PORT` to change).

## Configure Bob

Bob is configured in three places.

**1. Bob Shell itself: `bob:` in `pipeline.yaml`.** This is the command that
gets run for each stage.

```yaml
bob:
  bin: bob
  args: [run, --accept-license, --trust, --format, stream-json,
         --mode, "{{mode}}", --max-cost, "{{max_cost}}", --max-turns, "{{max_turns}}",
         --workspace, "{{workspace}}"]
  resume_args: [--resume, "{{task_id}}"]
  prompt_via: stdin
```

Check the flags against your install with `bob run --help`. The API key comes
from the `BOB_API_KEY` environment variable. You *can* set `bob.env.BOB_API_KEY`
in the yaml, but that file is usually committed, so don't.

**2. Modes and rules: `.bob/` in this folder.** Each stage runs one Bob custom
mode, named by the stage's `mode:` field.

```
.bob/
  custom_modes.yaml          # one mode per stage: role, tool permissions, where it may write
  rules-<mode>/              # per-mode instructions and output templates
```

Bob reads modes from the workspace it runs in, and that workspace is the
per-issue git worktree, not your clone. So before every run the tool copies
`.bob/custom_modes.yaml` and `.bob/rules-*/` into the worktree. Those copies are
git-excluded, so they never reach the branch or your repo.

- The planning modes (for example `hlp-planner`) can only write to `docs/bob/`
  (a `fileRegex` in the mode), so they can't touch source code.
- If the target repo *already tracks its own `.bob/`*, that one is used and the
  tool's modes are **not** installed. Add the pipeline's modes to the repo's
  own `.bob/custom_modes.yaml`, or move the repo's modes into this folder.
- `npm run validate` checks that every stage's `mode:` exists in this folder.

**3. Prompts and schemas: `prompts/<stage>.md` and `schemas/<stage>.schema.json`.**
The prompt tells Bob what to do and which files to write. The schema is what
the stage's JSON output must match. If the output fails validation, Bob is
asked to fix it (`retries:` per stage, default 1) before the stage fails.

## How the stages work

Stages run in the order listed under `stages:` in `pipeline.yaml`. Every stage
works the same way. What differs is its mode, prompt, inputs, outputs, steps
and gate.

| Stage | Mode | Reads | Writes (in `docs/bob/<issue>/`) | Gate |
|---|---|---|---|---|
| `hlp` High-level plan | `hlp-planner` | issue | `hlp.md`, `hlp.json` | human |
| `deps` Dependency check | `dep-checker` | issue, hlp, every other open issue's hlp | `deps.md`, `deps.json` | human; on approve, records GitHub "blocked by" links |
| `llp` Low-level plan | `llp-planner` | issue, hlp, deps | `llp.md`, `llp.json` | human |
| `tests` Test plan | `test-planner` | issue, hlp, llp | `tests.md`, `tests.json` | human; logs criteria with no test |
| `implement` Implement | `implementer` | issue, hlp, llp, tests | the code changes | **auto**; waits for open blockers; opens a draft PR |
| `changes` What changed | `change-writer` | issue, plans, tests, the diff | `changes.md` | human; writes it into the PR description |

What happens when one stage runs:

1. The issue's labels are re-read to confirm this stage is still wanted.
2. The issue is **claimed**: `bob:working` plus a claim comment. If two
   machines race, the earliest claim wins and the other backs off.
3. The issue gets its own git worktree on branch `bob/issue-N`, reset to the
   remote branch. The tool's `.bob/` is installed into it.
4. The inputs are written to `.bob-pipeline/`, and the prompt is rendered.
5. `pre:` steps run, then Bob runs in the stage's mode (cost and turn limits
   apply). Outputs are validated, with up to `retries` fix-ups.
6. `post:` steps run (build, tests, open PR...). A `run:` step with
   `on_fail: retry_with_output` feeds its output back to Bob once.
7. The outputs are committed and pushed to `bob/issue-N`, and the stage output
   is posted as an issue comment.
8. Labels move the issue on (see below). On any error the issue gets
   `bob:failed` and a comment explaining why.

## Gates: human vs auto

A stage's `gate:` decides what happens after it succeeds.

| | `gate: human` (default) | `gate: auto` |
|---|---|---|
| After the stage runs | issue gets `bob:<id>-review` and **stops** | issue gets `bob:<id>-approved` and the next stage **starts at once** |
| To move on | a person approves | nothing to do |
| Changes | comment + `bob:revise` reruns the stage with the feedback | not available; retry only on failure |
| Use for | plans and anything a person should read before work builds on it | mechanical steps, or demos |

The labels are the whole state machine:

```
bob:start ─▶ [run stage]
                 │
   human gate:   ├─▶ bob:<id>-review ──approve──▶ bob:<id>-approved ─▶ [run next stage]
                 │        └─ request changes: comment + bob:revise ─▶ [rerun same stage with feedback]
   auto gate:    └─▶ bob:<id>-approved ─▶ [run next stage immediately]

last stage approved ─▶ bob:done
```

Other labels:

| Label | Meaning |
|---|---|
| `bob:working` | a machine is running a stage (a lock) |
| `bob:failed` | the last run failed; remove it, or press *Retry*, to run **the same step** again |
| `bob:parked` | the pipeline ignores this issue until you remove it |
| `bob:revise` | reviewer asked for changes at the current review |

Notes:

- **Approve from either place.** In the dashboard press *Approve* (with an
  optional note), or add `bob:<id>-approved` in GitHub yourself.
- The shipped config gates every stage except `implement` on a human: you
  approve the plans, Bob writes the code, then you review the result. The
  draft PR is opened after `implement`, and `changes` fills in its description.
- Putting `gate: auto` on the **last** stage is allowed but warned about,
  because then nobody reviews the final output.
- `wait_for_blockers: true` on a stage holds it until every GitHub "blocked by"
  issue is closed. The issue page says what it's waiting for.
- `npm run demo` runs `pipeline.demo.yaml`: the same stages with every gate set
  to `auto`, a 15 s poll and no blocker waits, so an issue runs start to finish
  untouched. It is a copy of `pipeline.yaml`; when you change the process, make
  the same change there.

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

Any machine running the app can do work. Have **one person turn on auto-poll**
(`npm start -- --auto-poll`, or the checkbox in the header); everyone else uses
the buttons (approving runs the next stage on your machine if *Run the next
step on this machine now* is ticked).

If two machines pick up the same issue, the claim check resolves it: each adds
`bob:working` and a claim comment, waits `claim_settle_seconds`, and the earliest
claim wins. If a machine crashes mid-run, its lock stays; use *Clear stale lock*
in the dashboard. If *this* app stops mid-run, on restart it marks the run
interrupted and offers *Resume*.

## Where things happen

- Each issue gets its own git worktree under `~/.bob-pipeline/worktrees/<repo>/issue-N`
  on branch `bob/issue-N`. Your own checkout is never touched (apart from
  `git fetch`). The worktree belongs to the pipeline: it is reset to the remote
  branch before each run.
- Stage outputs are committed to `docs/bob/<issue>/` on the branch, along with
  `state.json` (pipeline version, run history, PR link).
- Before each run, the tool's own `.bob/` (modes and rules) is copied into the
  worktree, because Bob reads modes from the workspace. The copies are git-excluded,
  so they never reach the branch or your repo. If the target repo already tracks
  its own `.bob/`, that one is used instead and the tool's modes are not installed.
- Inputs for Bob (issue text, feedback, diffs) are written to `.bob-pipeline/` in
  the worktree, which is git-excluded.
- Run history and logs live in `tools/bob-pipeline/.data/` (SQLite). It is only a
  cache: deleting it loses local history, nothing else.

```
tools/bob-pipeline/                # the whole tool: copy this one folder into any repo
  .bob/
    custom_modes.yaml              # one Bob mode per stage
    rules-<mode>/                  # per-mode templates and rules
  pipeline.yaml                    # THE PROCESS: stages, gates, inputs, outputs
  pipeline.demo.yaml               # same, with every gate automatic (npm run demo)
  prompts/<stage>.md               # prompt templates
  schemas/<stage>.schema.json      # JSON Schemas Bob's JSON output must match
  packages/shared/                 # pipeline schema, state machine, API types
  apps/server/                     # Fastify: poller, queue, runner, GitHub, git
  apps/web/                        # React dashboard and review UI
```

## Troubleshooting

Run `npm run validate` first. It checks the config, prompts, schemas, modes and
git repo path.

| Symptom | Likely cause and fix |
|---|---|
| Board loads, but opening an issue fails with `spawn git ENOENT` | The folder was moved or renamed while the server was running. Restart the server. |
| `repo.path does not point at a git repo` | `repo.path` in `pipeline.yaml` is wrong for where the folder lives. |
| `No GitHub token` | Run `gh auth login`, or set `GITHUB_TOKEN`. |
| `Cannot work out owner/repo from remote` | Set `repo.owner` and `repo.name` in `pipeline.yaml`. |
| Log warning: `BOB_API_KEY is not set` | Export it in the shell that starts the server. |
| `mode "x" is not in .bob/custom_modes.yaml` | The stage's `mode:` doesn't match a slug in this folder's `.bob/custom_modes.yaml`. |
| Bob can't find the mode at run time | The target repo tracks its own `.bob/`, so the tool's modes weren't installed (see [Configure Bob](#configure-bob)). |
| Labels don't exist / can't be added | `npm run setup-labels` (again after adding a stage). |
| Issue shows *Processing* but nothing is running | A crashed machine left `bob:working`. Use *Clear stale lock*. |
| A stage failed | Read the comment on the issue, then *Retry* or *Resume Bob task*. |
| Nothing starts on its own | Auto-poll is off. Turn it on in the header, or use *Poll now*. |

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

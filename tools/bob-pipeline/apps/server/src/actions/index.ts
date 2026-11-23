import fs from "node:fs";
import path from "node:path";
import type { RunContext } from "../context.js";
import { traceability } from "@bob-pipeline/shared";

/**
 * Actions are non-Bob steps a stage can run in `pre:` or `post:`:
 *
 *   post:
 *     - action: open_draft_pr
 *     - action: update_pr_body
 *       with: { file: changes.md }
 *
 * To add one, call registerAction() with a name and a function.
 */

export type Action = (ctx: RunContext, args: Record<string, unknown>) => Promise<void>;

const registry = new Map<string, Action>();

export function registerAction(name: string, fn: Action) {
  registry.set(name, fn);
}

export function knownActionNames(): string[] {
  return [...registry.keys()];
}

export function getAction(name: string): Action {
  const fn = registry.get(name);
  if (!fn) throw new Error(`Unknown action "${name}". Known: ${knownActionNames().join(", ")}`);
  return fn;
}

function readOutput(ctx: RunContext, file: unknown): string {
  if (typeof file !== "string") throw new Error("this action needs `with: { file: <name> }`");
  const abs = path.join(ctx.worktree, ctx.outputDir, file);
  if (!fs.existsSync(abs)) throw new Error(`${ctx.outputDir}/${file} does not exist`);
  return fs.readFileSync(abs, "utf8");
}

/**
 * Open a draft PR for the issue branch (or reuse the open one). Commits and
 * pushes the worktree first so the PR contains the changes.
 */
registerAction("open_draft_pr", async (ctx, args) => {
  await ctx.git.commitAndPush(ctx.worktree, "all", `Bob: ${ctx.stage.name} for #${ctx.issue.number}`);
  const existing = await ctx.gh.findOpenPr(ctx.branch);
  const pr =
    existing ??
    (await ctx.gh.createDraftPr(
      ctx.branch,
      ctx.cfg.pipeline.repo.base_branch,
      typeof args.title === "string" ? args.title : `#${ctx.issue.number}: ${ctx.issue.title}`,
      `Refs #${ctx.issue.number}\n\nOpened by bob-pipeline. Plans: \`${ctx.outputDir}/\`.`,
    ));
  ctx.state.prUrl = pr.url;
  ctx.state.prNumber = pr.number;
  ctx.log("info", existing ? `Using existing PR ${pr.url}` : `Opened draft PR ${pr.url}`);
});

registerAction("update_pr_body", async (ctx, args) => {
  const pr = ctx.state.prNumber ?? (await ctx.gh.findOpenPr(ctx.branch))?.number;
  if (!pr) throw new Error("No open PR for this branch; run open_draft_pr first");
  const body = readOutput(ctx, args.file);
  await ctx.gh.updatePrBody(pr, `Refs #${ctx.issue.number}\n\n${body}`);
  ctx.log("info", `Updated PR #${pr} description from ${String(args.file)}`);
});

registerAction("post_comment", async (ctx, args) => {
  await ctx.gh.comment(ctx.issue.number, readOutput(ctx, args.file));
});

/**
 * Phase 2: record high-confidence "blocked_by" dependencies from deps.json as
 * GitHub issue dependencies. Usually run from the approval of the deps stage,
 * but it can also be a post-step.
 */
registerAction("add_issue_dependencies", async (ctx, args) => {
  const file = typeof args.file === "string" ? args.file : "deps.json";
  const minConfidence = typeof args.min_confidence === "string" ? args.min_confidence : "high";
  const order = ["low", "medium", "high"];
  const deps = JSON.parse(readOutput(ctx, file)) as {
    dependencies: { issue: number; kind: string; confidence: string }[];
  };
  for (const d of deps.dependencies) {
    if (d.kind !== "blocked_by" || order.indexOf(d.confidence) < order.indexOf(minConfidence)) continue;
    try {
      await ctx.gh.addBlockedBy(ctx.issue.number, d.issue);
      ctx.log("info", `Recorded: #${ctx.issue.number} blocked by #${d.issue}`);
    } catch (e) {
      ctx.log("error", `Could not add dependency on #${d.issue}: ${(e as Error).message}`);
    }
  }
});

/**
 * Phase 3: check that the test plan covers the plan. Every acceptance
 * criterion should be traced by at least one test (or listed under gaps),
 * every risk should be traced or listed, and traces must name real criteria.
 *
 *   with: { plan: hlp.json, tests: tests.json, mode: warn | fail }
 */
registerAction("check_traceability", async (ctx, args) => {
  const plan = JSON.parse(readOutput(ctx, args.plan ?? "hlp.json")) as {
    acceptance_criteria?: { id: string; criterion: string }[];
    risks?: { risk: string }[];
  };
  const tests = JSON.parse(readOutput(ctx, args.tests ?? "tests.json")) as {
    tests: { id: string; layer: string; traces_to: string[] }[];
    gaps?: string[];
  };
  const report = traceability(plan, tests);
  for (const line of report.summary) ctx.log("info", line);
  const problems = [
    ...report.unknownRefs.map((r) => `${r.test} traces to unknown criterion ${r.ref}`),
    ...report.uncoveredCriteria.map((c) => `${c} has no test and is not listed under gaps`),
    ...report.uncoveredRisks.map((r) => `risk "${r}" has no test and is not listed under gaps`),
  ];
  for (const p of problems) ctx.log("error", `traceability: ${p}`);
  if (problems.length && args.mode === "fail") throw new Error(`Test plan traceability failed:\n${problems.join("\n")}`);
});

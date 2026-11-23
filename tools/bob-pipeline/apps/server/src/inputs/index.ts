import fs from "node:fs";
import path from "node:path";
import type { RunContext } from "../context.js";
import { SCRATCH_DIR } from "../git.js";
import { MARK } from "../github.js";
import { labelNames } from "@bob-pipeline/shared";

/**
 * Input resolvers. Each name you can list under a stage's `inputs:` maps to
 * one resolver. A resolver writes whatever it needs into the worktree and
 * returns the files Bob should read.
 *
 * Built-in names:
 *   issue            the issue title, body and human comments
 *   feedback         reviewer comments since the last pipeline output
 *   diff             git diff of the branch against the base branch
 *   <stage-id>       that stage's output files (already on the branch)
 *   all_open:<id>    that stage's outputs for every other open issue
 *
 * To add one: register a resolver below (or in another file you import here).
 */

export interface InputFile {
  /** Path relative to the worktree. */
  path: string;
  description: string;
}

export interface ResolvedInput {
  files: InputFile[];
  /** Text substituted for {{feedback}} etc. when the resolver provides it. */
  vars?: Record<string, string>;
}

export type InputResolver = (ctx: RunContext, arg: string | undefined) => Promise<ResolvedInput>;

const registry = new Map<string, InputResolver>();

export function registerInput(name: string, fn: InputResolver) {
  registry.set(name, fn);
}

export function knownInputNames(): string[] {
  return [...registry.keys()];
}

/** Resolve an input name like "issue", "hlp" or "all_open:hlp". */
export async function resolveInput(ctx: RunContext, spec: string): Promise<ResolvedInput> {
  const [name, arg] = spec.split(":", 2);
  const fn = registry.get(name);
  if (fn) return fn(ctx, arg);
  if (ctx.cfg.pipeline.stages.some((s) => s.id === name)) return stageOutputs(ctx, name);
  throw new Error(`Unknown input "${spec}"`);
}

function scratch(ctx: RunContext, ...parts: string[]) {
  const rel = path.join(SCRATCH_DIR, "inputs", ...parts);
  const abs = path.join(ctx.worktree, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  return { rel, abs };
}

function humanComments(comments: { author: string; body: string; createdAt: string }[]) {
  return comments.filter((c) => !MARK.any.test(c.body));
}

registerInput("issue", async (ctx) => {
  const comments = humanComments(await ctx.gh.listComments(ctx.issue.number));
  const { rel, abs } = scratch(ctx, "issue.md");
  const labels = ctx.issue.labels.filter((l) => !l.startsWith(ctx.cfg.pipeline.labels.prefix));
  const md = [
    `# #${ctx.issue.number}: ${ctx.issue.title}`,
    "",
    `Author: ${ctx.issue.author}  `,
    `Labels: ${labels.join(", ") || "none"}  `,
    `URL: ${ctx.issue.url}`,
    "",
    "## Body",
    "",
    ctx.issue.body || "_No description._",
    "",
    "## Comments",
    "",
    ...(comments.length
      ? comments.map((c) => `### ${c.author} (${c.createdAt})\n\n${stripMarkers(c.body)}\n`)
      : ["_None._"]),
  ].join("\n");
  fs.writeFileSync(abs, md);
  return { files: [{ path: rel, description: "The GitHub issue: title, description and discussion" }] };
});

registerInput("feedback", async (ctx) => {
  const comments = await ctx.gh.listComments(ctx.issue.number);
  // Everything humans said after the most recent pipeline output comment.
  let lastOutput = -1;
  comments.forEach((c, i) => {
    if (MARK.outputRe.test(c.body)) lastOutput = i;
  });
  const fb = humanComments(comments.slice(lastOutput + 1));
  if (!fb.length) return { files: [], vars: { feedback: "None." } };
  const text = fb.map((c) => `From ${c.author}:\n${stripMarkers(c.body)}`).join("\n\n---\n\n");
  const { rel, abs } = scratch(ctx, "feedback.md");
  fs.writeFileSync(abs, `# Reviewer feedback\n\n${text}\n`);
  return {
    files: [{ path: rel, description: "Reviewer feedback to address" }],
    vars: { feedback: `See ${rel}. Summary:\n\n${text.slice(0, 4000)}` },
  };
});

registerInput("diff", async (ctx) => {
  const diff = await ctx.git.diffAgainstBase(ctx.worktree);
  const { rel, abs } = scratch(ctx, "diff.patch");
  fs.writeFileSync(abs, diff);
  return { files: [{ path: rel, description: `All changes on this branch vs ${ctx.cfg.pipeline.repo.base_branch}` }] };
});

registerInput("all_open", async (ctx, stageId) => {
  if (!stageId) throw new Error('all_open needs a stage id, e.g. "all_open:hlp"');
  const stage = ctx.cfg.pipeline.stages.find((s) => s.id === stageId);
  if (!stage) throw new Error(`all_open: unknown stage "${stageId}"`);
  const prefix = ctx.cfg.pipeline.labels.prefix;
  const n = labelNames(ctx.cfg.pipeline);
  const others = (await ctx.gh.listOpenIssues()).filter(
    (i) => i.number !== ctx.issue.number && i.labels.some((l) => l.startsWith(prefix)) && !i.labels.includes(n.parked),
  );
  const files: InputFile[] = [];
  const index: string[] = [];
  for (const other of others) {
    const branch = ctx.git.branchFor(other.number);
    const dir = ctx.git.outputDirFor(other.number);
    for (const out of stage.outputs) {
      const content = await ctx.git.show(branch, `${dir}/${out.file}`);
      if (content === null) continue;
      const { rel, abs } = scratch(ctx, "all_open", `${other.number}-${out.file}`);
      fs.writeFileSync(abs, content);
      files.push({ path: rel, description: `#${other.number} "${other.title}": ${stage.name} (${out.file})` });
    }
    index.push(`- #${other.number} ${other.title} [${other.labels.filter((l) => l.startsWith(prefix)).join(", ")}]`);
  }
  const { rel, abs } = scratch(ctx, "all_open", "INDEX.md");
  fs.writeFileSync(abs, `# Other open issues in the pipeline\n\n${index.join("\n") || "None."}\n`);
  files.unshift({ path: rel, description: "Index of other open issues in the pipeline" });
  return { files };
});

/** A previous stage's outputs: already committed on the branch. */
async function stageOutputs(ctx: RunContext, stageId: string): Promise<ResolvedInput> {
  const stage = ctx.cfg.pipeline.stages.find((s) => s.id === stageId)!;
  const files = stage.outputs
    .map((o) => path.posix.join(ctx.outputDir, o.file))
    .filter((p) => fs.existsSync(path.join(ctx.worktree, p)))
    .map((p) => ({ path: p, description: `${stage.name} (approved)` }));
  return { files };
}

function stripMarkers(body: string) {
  return body.replace(/<!-- bob-pipeline:[^>]*-->\s*/g, "").trim();
}

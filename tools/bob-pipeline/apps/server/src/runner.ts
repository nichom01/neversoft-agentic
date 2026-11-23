import fs from "node:fs";
import path from "node:path";
import { fill, isRunStep, labelNames, type Step } from "@bob-pipeline/shared";
import { MACHINE, stageIndex } from "./config.js";
import type { IssueState, RunContext, Services } from "./context.js";
import { MARK } from "./github.js";
import { SCRATCH_DIR } from "./git.js";
import { resolveInput, type InputFile } from "./inputs/index.js";
import { getAction } from "./actions/index.js";
import { runBob } from "./bob.js";
import { exec, tail } from "./exec.js";
import { schemaPath, validateJsonText } from "./schemas.js";
import { deriveState } from "@bob-pipeline/shared";

export class ClaimLost extends Error {}
export class StaleTrigger extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run one stage for one issue, end to end. The sequence is the same for
 * every stage; what differs (mode, prompt, inputs, outputs, steps, gate)
 * comes from pipeline.yaml.
 *
 * Returns the id of the next stage to run immediately (auto gate), or null.
 */
export async function executeRun(svc: Services, runId: string): Promise<string | null> {
  const { cfg, gh, git, db } = svc;
  const p = cfg.pipeline;
  const L = labelNames(p);
  const run = db.getRun(runId)!;
  const { feedback: isRevision, resumeTaskId } = db.getRunInternals(runId);
  const stage = p.stages[stageIndex(p, run.stage)];
  if (!stage) throw new Error(`Stage "${run.stage}" is not in pipeline.yaml`);
  const log = (kind: "bob" | "step" | "info" | "error", text: string) => db.appendLog(runId, kind, text);

  db.updateRun(runId, { status: "running", startedAt: new Date().toISOString() });
  log("info", `Run ${runId}: stage "${stage.name}" for #${run.issue} on ${MACHINE}`);

  // 1. Re-read the issue and check the labels still ask for this stage.
  let issue = await gh.getIssue(run.issue);
  const derived = deriveState(issue.labels, p);
  const wanted = derived.action?.type === "run" ? derived.action.stage : null;
  if (derived.status === "running" || derived.status === "parked" || wanted !== stage.id) {
    throw new StaleTrigger(`Issue is ${derived.status}${wanted ? ` (wants ${wanted})` : ""}; not running ${stage.id}`);
  }

  // 2. Claim the issue: lock label + claim comment, then check nobody beat us.
  const claimId = await claim(svc, run.issue, stage.id, runId);
  let succeeded = false;
  try {
    // 3. Worktree on the issue branch.
    const worktree = await git.ensureWorktree(run.issue);
    const outputDir = git.outputDirFor(run.issue);
    const branch = git.branchFor(run.issue);
    fs.mkdirSync(path.join(worktree, outputDir), { recursive: true });
    log("info", `Worktree ${worktree} on ${branch}`);

    const state = readState(worktree, outputDir, run.issue, p.version);
    if (state.pipelineVersion !== p.version) {
      log("info", `Note: issue started on pipeline v${state.pipelineVersion}; running with v${p.version}`);
    }
    issue = await gh.getIssue(run.issue);
    const ctx: RunContext = { ...svc, runId, issue, stage, worktree, outputDir, branch, isRevision, log, state };

    // 4. Inputs and prompt.
    copySchemas(ctx);
    const files: InputFile[] = [];
    const vars: Record<string, string> = { feedback: "None." };
    for (const spec of stage.inputs) {
      const r = await resolveInput(ctx, spec);
      files.push(...r.files);
      Object.assign(vars, r.vars ?? {});
    }
    const prompt = renderPrompt(ctx, files, vars);
    fs.writeFileSync(path.join(worktree, SCRATCH_DIR, "prompt.md"), prompt);
    log("info", `Prompt rendered (${prompt.length} chars, ${files.length} input files)`);

    // 5. Pre-steps.
    await runSteps(ctx, stage.pre, "pre");

    // 6. Bob, with output validation and retries.
    let taskId = resumeTaskId;
    let totalCost = 0;
    // Bob reports a task's cost cumulatively, including when a task is resumed,
    // so keep the latest figure per task and add them up.
    const costByTask = new Map<string, number>();
    let untrackedCost = 0;
    const seen = new Set<string>();
    const bobOnce = async (text: string) => {
      log("info", taskId ? `Running Bob (resuming task ${taskId})` : `Running Bob in mode "${stage.mode}"`);
      const r = await runBob(p, {
        mode: stage.mode,
        maxCost: stage.max_cost ?? p.defaults.max_cost,
        maxTurns: stage.max_turns ?? p.defaults.max_turns,
        workspace: worktree,
        prompt: text,
        resumeTaskId: taskId,
        onEvent: (s) => log("bob", s),
        seen,
      });
      if (r.taskId) {
        taskId = r.taskId;
        db.updateRun(runId, { taskId: r.taskId });
      }
      if (r.cost !== null) {
        if (r.taskId) costByTask.set(r.taskId, Math.max(costByTask.get(r.taskId) ?? 0, r.cost));
        else untrackedCost += r.cost;
        totalCost = untrackedCost + [...costByTask.values()].reduce((a, b) => a + b, 0);
        db.updateRun(runId, { cost: totalCost });
      }
      if (r.timedOut) throw new Error("Bob timed out");
      if (r.exitCode !== 0) throw new Error(`Bob exited with code ${r.exitCode}\n${r.stderrTail}`);
    };

    await bobOnce(resumeTaskId ? "Continue the task. If it is already complete, check the outputs and stop." : prompt);
    for (let attempt = 0; ; attempt++) {
      const errors = checkOutputs(ctx);
      if (!errors.length) break;
      if (attempt >= stage.retries) throw new Error(`Outputs failed validation:\n${errors.join("\n")}`);
      log("error", `Outputs failed validation, asking Bob to fix (retry ${attempt + 1}/${stage.retries}):\n${errors.join("\n")}`);
      await bobOnce(
        `${taskId ? "" : prompt + "\n\n---\n\n"}The output files failed validation. Fix them so that every required file exists and every JSON file validates against its schema. Errors:\n\n${errors.map((e) => `- ${e}`).join("\n")}`,
      );
    }

    // 7. Post-steps (tests, PR, ...). retry_with_output feeds failures back to Bob once.
    await runSteps(ctx, stage.post, "post", async (output) => {
      await bobOnce(`${taskId ? "" : prompt + "\n\n---\n\n"}A check after your changes failed. Fix the cause. Output:\n\n\`\`\`\n${tail(output, 150)}\n\`\`\``);
    });

    // 8. Record state, commit and push.
    state.history.push({
      stage: stage.id,
      runId,
      machine: MACHINE,
      finishedAt: new Date().toISOString(),
      cost: totalCost || null,
      taskId: taskId ?? null,
      revision: isRevision,
    });
    writeState(worktree, outputDir, state);
    const commitPaths = stage.commit === "all" ? "all" : [outputDir];
    const pushed = await git.commitAndPush(
      worktree,
      commitPaths,
      `Bob: ${stage.name}${isRevision ? " (revised)" : ""} for #${run.issue}\n\nRun ${runId} on ${MACHINE}`,
    );
    log("info", pushed ? `Committed and pushed to ${branch}` : "Nothing new to commit");

    // 9. Comment with the stage output.
    const costText = totalCost ? `, ${totalCost.toFixed(2)} Bobcoins` : "";
    const header = `${MARK.output(stage.id, runId)}\n**🤖 Bob · ${stage.name}**${isRevision ? " (revised)" : ""} · run \`${runId}\`${costText}\n\n`;
    let body = "";
    if (stage.comment) {
      const f = path.join(worktree, outputDir, stage.comment);
      body = fs.existsSync(f) ? fs.readFileSync(f, "utf8") : `_${stage.comment} was not written._`;
    } else {
      body = `Stage complete. Outputs are in \`${outputDir}/\` on \`${branch}\`.`;
    }
    const footer =
      stage.gate === "human"
        ? `\n\n---\n_To approve, use the dashboard or add \`${L.approved(stage.id)}\`. To request changes, comment and add \`${L.revise}\`._`
        : "";
    await gh.comment(run.issue, header + body + footer);

    // 10. Labels: move the issue on.
    const triggers = [L.start, L.revise, L.failed, ...p.stages.filter((s) => s.gate === "human").map((s) => L.review(s.id))];
    const add = stage.gate === "human" ? [L.review(stage.id)] : [L.approved(stage.id)];
    await gh.swapLabels(run.issue, triggers, add);

    db.updateRun(runId, { status: "succeeded", finishedAt: new Date().toISOString(), error: null });
    log("info", `Done. Issue is now ${add.join(", ")}`);
    succeeded = true;

    const idx = stageIndex(p, stage.id);
    if (stage.gate === "auto") {
      if (idx < p.stages.length - 1) return p.stages[idx + 1].id;
      await gh.addLabels(run.issue, [L.done]);
    }
    return null;
  } catch (err) {
    if (err instanceof ClaimLost) throw err;
    await gh.addLabels(run.issue, [L.failed]).catch(() => {});
    await gh
      .comment(
        run.issue,
        `${MARK.status}\n**🤖 Bob · ${stage.name} failed** · run \`${runId}\` on ${MACHINE}\n\n\`\`\`\n${tail(String((err as Error).message ?? err), 40)}\n\`\`\`\n\nRemove \`${L.failed}\` (or press Retry in the dashboard) to try again.`,
      )
      .catch(() => {});
    throw err;
  } finally {
    await gh.removeLabels(run.issue, [L.working]).catch(() => {});
    if (claimId) await gh.deleteComment(claimId).catch(() => {});
    if (!succeeded) log("info", "Lock released");
  }
}

/**
 * Run a stage's on_approve actions outside a Bob run. Used when a human
 * approves, e.g. to record dependencies the reviewer agreed with.
 * Returns log messages for the UI.
 */
export async function runApprovalActions(svc: Services, issueNumber: number, stageId: string): Promise<string[]> {
  const p = svc.cfg.pipeline;
  const stage = p.stages[stageIndex(p, stageId)];
  if (!stage?.on_approve.length) return [];
  const messages: string[] = [];
  const worktree = await svc.git.ensureWorktree(issueNumber);
  const outputDir = svc.git.outputDirFor(issueNumber);
  const ctx: RunContext = {
    ...svc,
    runId: "approve",
    issue: await svc.gh.getIssue(issueNumber),
    stage,
    worktree,
    outputDir,
    branch: svc.git.branchFor(issueNumber),
    isRevision: false,
    log: (_kind, text) => messages.push(text),
    state: readState(worktree, outputDir, issueNumber, p.version),
  };
  for (const step of stage.on_approve) {
    messages.push(`on_approve: ${step.action}`);
    await getAction(step.action)(ctx, step.with);
  }
  return messages;
}

async function claim(svc: Services, issue: number, stageId: string, runId: string): Promise<number> {
  const { gh, cfg } = svc;
  const L = labelNames(cfg.pipeline);
  await gh.addLabels(issue, [L.working]);
  const id = await gh.comment(issue, `${MARK.claim(stageId, runId, MACHINE)}\n_🤖 Bob is working on this (${stageId}) on ${MACHINE}…_`);
  await sleep(cfg.pipeline.poller.claim_settle_seconds * 1000);
  const comments = await gh.listComments(issue);
  const mine = comments.find((c) => c.id === id);
  const cutoff = mine ? new Date(mine.createdAt).getTime() - 120_000 : 0;
  const claims = comments
    .filter((c) => MARK.claimRe.exec(c.body)?.[1] === stageId && new Date(c.createdAt).getTime() >= cutoff)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
  if (claims.length && claims[0].id !== id) {
    await gh.deleteComment(id);
    const winner = MARK.claimRe.exec(claims[0].body)?.[3] ?? "another machine";
    throw new ClaimLost(`${winner} claimed #${issue} first`);
  }
  return id;
}

function renderPrompt(ctx: RunContext, files: InputFile[], vars: Record<string, string>): string {
  const template = fs.readFileSync(path.resolve(ctx.cfg.pipelineDir, ctx.stage.prompt), "utf8");
  const inputs = files.length ? files.map((f) => `- \`${f.path}\` — ${f.description}`).join("\n") : "- (none)";
  const outputs = ctx.stage.outputs.length
    ? ctx.stage.outputs
        .map((o) => {
          const schema = o.schema ? ` — must validate against \`${SCRATCH_DIR}/schemas/${path.basename(o.schema)}\`` : "";
          return `- \`${ctx.outputDir}/${o.file}\`${o.required ? "" : " (optional)"}${schema}`;
        })
        .join("\n")
    : "- (no files; the code changes are the output)";
  return fill(template, {
    "issue.number": ctx.issue.number,
    "issue.title": ctx.issue.title,
    output_dir: ctx.outputDir,
    branch: ctx.branch,
    stage: ctx.stage.id,
    inputs,
    outputs,
    ...vars,
  });
}

function copySchemas(ctx: RunContext) {
  const dir = path.join(ctx.worktree, SCRATCH_DIR, "schemas");
  fs.mkdirSync(dir, { recursive: true });
  for (const o of ctx.stage.outputs) {
    if (o.schema) fs.copyFileSync(schemaPath(ctx.cfg.pipelineDir, o.schema), path.join(dir, path.basename(o.schema)));
  }
}

/** Every required output exists, and every JSON output validates. */
export function checkOutputs(ctx: Pick<RunContext, "worktree" | "outputDir" | "stage" | "cfg">): string[] {
  const errors: string[] = [];
  for (const o of ctx.stage.outputs) {
    const rel = `${ctx.outputDir}/${o.file}`;
    const abs = path.join(ctx.worktree, rel);
    if (!fs.existsSync(abs)) {
      if (o.required) errors.push(`${rel}: missing`);
      continue;
    }
    const text = fs.readFileSync(abs, "utf8");
    if (!text.trim()) errors.push(`${rel}: empty`);
    if (o.schema) for (const e of validateJsonText(text, schemaPath(ctx.cfg.pipelineDir, o.schema))) errors.push(`${rel}: ${e}`);
  }
  return errors;
}

async function runSteps(ctx: RunContext, steps: Step[], phase: "pre" | "post", fixWithBob?: (output: string) => Promise<void>) {
  for (const step of steps) {
    if (!isRunStep(step)) {
      ctx.log("step", `${phase}: action ${step.action}`);
      await getAction(step.action)(ctx, step.with);
      continue;
    }
    const once = async () => {
      ctx.log("step", `${phase}: $ ${step.run}`);
      const r = await exec(step.run, [], {
        cwd: ctx.worktree,
        shell: true,
        timeoutMs: step.timeout_seconds * 1000,
        onLine: (l) => ctx.log("step", l),
      });
      return { ok: r.code === 0 && !r.timedOut, output: `${r.stdout}\n${r.stderr}`, code: r.code, timedOut: r.timedOut };
    };
    let r = await once();
    if (r.ok) continue;
    if (step.on_fail === "continue") {
      ctx.log("error", `Step failed (exit ${r.code}), continuing`);
      continue;
    }
    if (step.on_fail === "retry_with_output" && fixWithBob) {
      ctx.log("error", `Step failed (exit ${r.code}); asking Bob to fix it`);
      await fixWithBob(r.output);
      r = await once();
      if (r.ok) continue;
    }
    throw new Error(`Step "${step.run}" failed (exit ${r.code}${r.timedOut ? ", timed out" : ""}):\n${tail(r.output, 40)}`);
  }
}

function readState(wt: string, outputDir: string, issue: number, version: number): IssueState {
  const f = path.join(wt, outputDir, "state.json");
  if (fs.existsSync(f)) {
    try {
      return JSON.parse(fs.readFileSync(f, "utf8")) as IssueState;
    } catch {
      /* fall through */
    }
  }
  return { issue, pipelineVersion: version, history: [] };
}

function writeState(wt: string, outputDir: string, state: IssueState) {
  fs.writeFileSync(path.join(wt, outputDir, "state.json"), JSON.stringify(state, null, 2) + "\n");
}

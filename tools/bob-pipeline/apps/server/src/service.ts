import {
  deriveState,
  labelNames,
  type IssueDetail,
  type IssueSummary,
  type StageOutputs,
} from "@bob-pipeline/shared";
import type { Services } from "./context.js";
import type { Issue } from "./github.js";
import { MARK } from "./github.js";
import { bus } from "./events.js";
import { Queue } from "./queue.js";
import { schemaPath, validateJsonText } from "./schemas.js";
import { stageById } from "./config.js";
import { runApprovalActions } from "./runner.js";
import { buildDependencyGraph } from "./dependencies.js";
import type { DependencyGraph } from "@bob-pipeline/shared";

/**
 * The pipeline's operations: listing issues, the review actions, and the
 * poller. The HTTP API is a thin layer over this.
 */
export class PipelineService {
  readonly queue: Queue;
  private issuesCache: { at: number; issues: Issue[] } | null = null;
  private graphCache: { at: number; graph: DependencyGraph } | null = null;
  private timer: NodeJS.Timeout | null = null;
  private poll = { enabled: false, lastPollAt: null as string | null, lastError: null as string | null };

  constructor(readonly svc: Services) {
    this.queue = new Queue(svc);
  }

  get L() {
    return labelNames(this.svc.cfg.pipeline);
  }

  // ---------- reading ----------

  async openIssues(maxAgeMs = 15_000): Promise<Issue[]> {
    if (this.issuesCache && Date.now() - this.issuesCache.at < maxAgeMs) return this.issuesCache.issues;
    const issues = await this.svc.gh.listOpenIssues();
    this.issuesCache = { at: Date.now(), issues };
    return issues;
  }

  invalidate() {
    this.issuesCache = null;
    bus.publish({ type: "issues-changed" });
  }

  summarise(i: Issue): IssueSummary {
    const latest = this.svc.db.latestRuns();
    return {
      number: i.number,
      title: i.title,
      url: i.url,
      author: i.author,
      labels: i.labels,
      updatedAt: i.updatedAt,
      state: deriveState(i.labels, this.svc.cfg.pipeline),
      lastRun: latest.get(i.number) ?? null,
      activeHere: this.queue.busyIssues().has(i.number),
    };
  }

  async listIssues(): Promise<IssueSummary[]> {
    const issues = await this.openIssues();
    const latest = this.svc.db.latestRuns();
    const busy = this.queue.busyIssues();
    const p = this.svc.cfg.pipeline;
    return issues.map((i) => ({
      number: i.number,
      title: i.title,
      url: i.url,
      author: i.author,
      labels: i.labels,
      updatedAt: i.updatedAt,
      state: deriveState(i.labels, p),
      lastRun: latest.get(i.number) ?? null,
      activeHere: busy.has(i.number),
    }));
  }

  async issueDetail(n: number): Promise<IssueDetail> {
    const { gh, git, cfg, db } = this.svc;
    const [issue, comments] = await Promise.all([gh.getIssue(n), gh.listComments(n)]);
    await git.fetch(10_000).catch(() => {});
    const branch = git.branchFor(n);
    const branchExists = await git.remoteBranchExists(branch);
    const dir = git.outputDirFor(n);
    const outputs: StageOutputs[] = [];
    for (const stage of cfg.pipeline.stages) {
      const files = [];
      const declared = [...stage.outputs];
      if (stage.id === "implement" || stage.commit === "all") declared.push({ file: "deviations.md", required: false });
      for (const o of declared) {
        const rel = `${dir}/${o.file}`;
        const content = branchExists ? await git.show(branch, rel) : null;
        const previous = content !== null ? await git.previousVersion(branch, rel) : null;
        const schemaErrors =
          content !== null && o.schema ? validateJsonText(content, schemaPath(cfg.pipelineDir, o.schema)) : null;
        files.push({ file: o.file, exists: content !== null, content, previous, schemaErrors });
      }
      outputs.push({ stage: stage.id, files });
    }
    const pr = branchExists ? await gh.findOpenPr(branch).catch(() => null) : null;
    const blockedBy = (await gh.listBlockedBy(n).catch(() => null)) ?? [];
    return {
      ...this.summarise(issue),
      blockedBy,
      body: issue.body,
      branch,
      branchExists,
      prUrl: pr?.url ?? null,
      outputs,
      comments: comments.filter((c) => !MARK.claimRe.test(c.body)),
      runs: db.runsForIssue(n),
    };
  }

  async branchDiff(n: number): Promise<string> {
    await this.svc.git.fetch(10_000).catch(() => {});
    return this.svc.git.branchDiff(this.svc.git.branchFor(n));
  }

  // ---------- review actions (all are label changes on GitHub) ----------

  async start(n: number, runNow: boolean) {
    await this.svc.gh.addLabels(n, [this.L.start]);
    this.invalidate();
    if (runNow) await this.runNext(n);
  }

  async approve(n: number, stageId: string, note: string | undefined, runNow: boolean) {
    const stage = stageById(this.svc.cfg.pipeline, stageId);
    const { gh } = this.svc;
    const issue = await gh.getIssue(n);
    const state = deriveState(issue.labels, this.svc.cfg.pipeline);
    if (state.status !== "review" || state.stage !== stageId) {
      throw new HttpError(409, `#${n} is not waiting for review of ${stage.name} (it is ${state.status} at ${state.stage ?? "-"})`);
    }
    // Approval hooks first, so their results are visible before the next stage starts.
    let messages: string[] = [];
    try {
      messages = await runApprovalActions(this.svc, n, stageId);
    } catch (e) {
      messages.push(`on_approve failed: ${(e as Error).message}`);
    }
    if (note?.trim()) await gh.comment(n, `✅ **Approved: ${stage.name}**\n\n${note.trim()}`);
    await gh.swapLabels(n, [this.L.review(stageId), this.L.revise], [this.L.approved(stageId)]);
    this.invalidate();
    if (runNow) {
      try {
        await this.runNext(n);
      } catch (e) {
        // Approval stands even if the next stage can't start yet (e.g. blocked).
        if (e instanceof HttpError) messages.push(e.message);
        else throw e;
      }
    }
    return messages;
  }

  async requestChanges(n: number, stageId: string, comment: string, runNow: boolean) {
    if (!comment.trim()) throw new HttpError(400, "A comment is required when requesting changes");
    const stage = stageById(this.svc.cfg.pipeline, stageId);
    await this.svc.gh.comment(n, `${MARK.feedback(stageId)}\n🔁 **Changes requested: ${stage.name}**\n\n${comment.trim()}`);
    await this.svc.gh.addLabels(n, [this.L.revise]);
    this.invalidate();
    if (runNow) await this.runNext(n);
  }

  async park(n: number, parked: boolean) {
    if (parked) await this.svc.gh.addLabels(n, [this.L.parked]);
    else await this.svc.gh.removeLabels(n, [this.L.parked]);
    this.invalidate();
  }

  /** Clear bob:failed and run the same step again, optionally resuming the Bob task. */
  async retry(n: number, resume: boolean) {
    await this.svc.gh.removeLabels(n, [this.L.failed]);
    this.invalidate();
    const last = this.svc.db.runsForIssue(n, 1)[0];
    await this.runNext(n, resume && last?.taskId ? last.taskId : null);
  }

  /** Clear a stale lock left by a crashed machine. */
  async unlock(n: number) {
    await this.svc.gh.removeLabels(n, [this.L.working]);
    this.invalidate();
  }

  /** Do whatever the labels say is next, on this machine. */
  async runNext(n: number, resumeTaskId: string | null = null) {
    const issue = await this.svc.gh.getIssue(n);
    const state = deriveState(issue.labels, this.svc.cfg.pipeline);
    if (!state.action) throw new HttpError(409, `Nothing to run for #${n} (status: ${state.status})`);
    if (["running", "failed", "parked"].includes(state.status)) throw new HttpError(409, `#${n} is ${state.status}`);
    if (state.action.type === "finish") {
      await this.svc.gh.addLabels(n, [this.L.done]);
      await this.svc.gh.comment(n, `${MARK.status}\n🎉 **Bob pipeline complete.** All stages approved.`);
      this.invalidate();
      return null;
    }
    const blockers = await this.openBlockers(n, state.action.stage);
    if (blockers.length) {
      throw new HttpError(409, `#${n} is waiting for ${blockers.map((b) => `#${b}`).join(", ")} to be closed before ${state.action.stage} can start`);
    }
    const run = this.queue.enqueue(n, state.action.stage, { feedback: state.action.feedback, resumeTaskId });
    if (!run) throw new HttpError(409, `#${n} already has a run on this machine`);
    return run;
  }

  /** Open "blocked by" issues, if the stage is configured to wait for them. */
  async openBlockers(n: number, stageId: string): Promise<number[]> {
    const stage = stageById(this.svc.cfg.pipeline, stageId);
    if (!stage.wait_for_blockers) return [];
    const blockers = (await this.svc.gh.listBlockedBy(n).catch(() => null)) ?? [];
    return blockers.filter((b) => b.state === "open").map((b) => b.number);
  }

  // ---------- dependencies (phase 2) ----------

  async dependencies(force = false): Promise<DependencyGraph> {
    if (!force && this.graphCache && Date.now() - this.graphCache.at < 15_000) return this.graphCache.graph;
    const graph = await buildDependencyGraph(this.svc, await this.openIssues());
    this.graphCache = { at: Date.now(), graph };
    return graph;
  }

  /** Record "n is blocked by other" on GitHub (from the dependency review UI). */
  async addDependency(n: number, blockedBy: number) {
    if (n === blockedBy) throw new HttpError(400, "An issue can't block itself");
    try {
      await this.svc.gh.addBlockedBy(n, blockedBy);
    } catch (e) {
      throw new HttpError(502, `GitHub refused the dependency: ${(e as Error).message}`);
    }
    this.graphCache = null;
    this.invalidate();
  }

  // ---------- poller ----------

  pollerStatus() {
    return this.queue.status(this.poll);
  }

  setPolling(enabled: boolean) {
    this.poll.enabled = enabled;
    this.svc.db.setSetting("autoPoll", enabled ? "1" : "0");
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (enabled) {
      this.timer = setInterval(() => void this.pollOnce(), this.svc.cfg.pipeline.poller.interval_seconds * 1000);
      void this.pollOnce();
    }
    bus.publish({ type: "poller", status: this.pollerStatus() });
  }

  async pollOnce() {
    try {
      const issues = await this.openIssues(0);
      const busy = this.queue.busyIssues();
      for (const i of issues) {
        if (busy.has(i.number)) continue;
        const s = deriveState(i.labels, this.svc.cfg.pipeline);
        if (!s.action || !["ready", "revise"].includes(s.status)) continue;
        try {
          await this.runNext(i.number);
        } catch (e) {
          if (!(e instanceof HttpError)) throw e;
        }
      }
      this.poll.lastError = null;
    } catch (e) {
      this.poll.lastError = (e as Error).message;
    } finally {
      this.poll.lastPollAt = new Date().toISOString();
      bus.publish({ type: "poller", status: this.pollerStatus() });
      bus.publish({ type: "issues-changed" });
    }
  }
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

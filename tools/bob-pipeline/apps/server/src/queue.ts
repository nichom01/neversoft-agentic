import { labelNames, type PollerStatus } from "@bob-pipeline/shared";
import { MACHINE } from "./config.js";
import type { Services } from "./context.js";
import { bus } from "./events.js";
import { ClaimLost, StaleTrigger, executeRun } from "./runner.js";

/**
 * In-process job queue with a concurrency limit. One issue never has two
 * runs at once on this machine; across machines the claim check in the
 * runner handles it.
 */
export class Queue {
  private pending: string[] = [];
  private active = new Map<string, number>(); // runId -> issue
  constructor(private svc: Services) {}

  get concurrency() {
    return this.svc.cfg.pipeline.poller.concurrency;
  }

  size() {
    return this.pending.length;
  }
  runningCount() {
    return this.active.size;
  }

  /** Issues with a queued or running job on this machine. */
  busyIssues(): Set<number> {
    const s = new Set(this.active.values());
    for (const id of this.pending) {
      const r = this.svc.db.getRun(id);
      if (r) s.add(r.issue);
    }
    return s;
  }

  enqueue(issue: number, stage: string, opts: { feedback?: boolean; resumeTaskId?: string | null } = {}) {
    if (this.busyIssues().has(issue)) return null;
    const run = this.svc.db.createRun({
      issue,
      stage,
      machine: MACHINE,
      pipelineVersion: this.svc.cfg.pipeline.version,
      feedback: !!opts.feedback,
      resumeTaskId: opts.resumeTaskId,
    });
    this.pending.push(run.id);
    queueMicrotask(() => this.pump());
    return run;
  }

  cancel(runId: string): boolean {
    const i = this.pending.indexOf(runId);
    if (i < 0) return false;
    this.pending.splice(i, 1);
    this.svc.db.updateRun(runId, { status: "cancelled", finishedAt: new Date().toISOString() });
    return true;
  }

  private pump() {
    while (this.active.size < this.concurrency && this.pending.length) {
      const id = this.pending.shift()!;
      const run = this.svc.db.getRun(id);
      if (!run) continue;
      this.active.set(id, run.issue);
      void this.execute(id, run.issue);
    }
  }

  private async execute(id: string, issue: number) {
    const { db } = this.svc;
    let next: string | null = null;
    try {
      next = await executeRun(this.svc, id);
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      const status = err instanceof ClaimLost || err instanceof StaleTrigger ? "cancelled" : "failed";
      db.appendLog(id, status === "failed" ? "error" : "info", msg);
      db.updateRun(id, { status, finishedAt: new Date().toISOString(), error: msg });
    } finally {
      this.active.delete(id);
      bus.publish({ type: "issues-changed" });
      if (next) this.enqueue(issue, next);
      this.pump();
    }
  }

  /**
   * After a restart, runs that were "running" were interrupted. Mark them,
   * release the lock and flag the issue so a human can resume or retry.
   */
  async recoverInterrupted() {
    const { db, gh, cfg } = this.svc;
    const L = labelNames(cfg.pipeline);
    for (const r of db.runsWithStatus(["running", "queued"])) {
      if (r.machine !== MACHINE) continue;
      const wasRunning = r.status === "running";
      db.updateRun(r.id, {
        status: wasRunning ? "failed" : "cancelled",
        finishedAt: new Date().toISOString(),
        error: wasRunning ? "Interrupted (the app stopped while this was running). Resume or retry it." : "Cancelled at restart",
      });
      if (wasRunning) {
        await gh.removeLabels(r.issue, [L.working]).catch(() => {});
        await gh.addLabels(r.issue, [L.failed]).catch(() => {});
      }
    }
  }

  status(poller: { enabled: boolean; lastPollAt: string | null; lastError: string | null }): PollerStatus {
    return {
      ...poller,
      intervalSeconds: this.svc.cfg.pipeline.poller.interval_seconds,
      queueSize: this.size(),
      running: this.runningCount(),
      concurrency: this.concurrency,
      machine: MACHINE,
    };
  }
}

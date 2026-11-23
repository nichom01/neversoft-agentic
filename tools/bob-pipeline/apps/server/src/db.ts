import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { LogLine, RunInfo, RunStatus } from "@bob-pipeline/shared";
import { bus } from "./events.js";

/**
 * Local cache of runs and logs for this machine. GitHub labels and the files
 * on each issue branch are the source of truth; deleting this file loses
 * history only.
 */
export class Db {
  private db: DatabaseSync;

  constructor(dataDir: string) {
    const { DatabaseSync } = loadSqlite();
    this.db = new DatabaseSync(path.join(dataDir, "bob-pipeline.sqlite"));
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        issue INTEGER NOT NULL,
        stage TEXT NOT NULL,
        status TEXT NOT NULL,
        attempt INTEGER NOT NULL DEFAULT 1,
        machine TEXT NOT NULL,
        queued_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT,
        task_id TEXT,
        resume_task_id TEXT,
        cost REAL,
        error TEXT,
        pipeline_version INTEGER NOT NULL,
        feedback INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS runs_issue ON runs(issue, queued_at);
      CREATE TABLE IF NOT EXISTS logs (
        run_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        ts TEXT NOT NULL,
        kind TEXT NOT NULL,
        text TEXT NOT NULL,
        PRIMARY KEY (run_id, seq)
      );
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
  }

  createRun(r: {
    issue: number;
    stage: string;
    machine: string;
    pipelineVersion: number;
    feedback: boolean;
    resumeTaskId?: string | null;
  }): RunInfo {
    const id = crypto.randomUUID().slice(0, 8);
    const now = new Date().toISOString();
    const attempt =
      (this.db
        .prepare("SELECT COUNT(*) AS n FROM runs WHERE issue = ? AND stage = ?")
        .get(r.issue, r.stage) as unknown as { n: number }).n + 1;
    this.db
      .prepare(
        `INSERT INTO runs (id, issue, stage, status, attempt, machine, queued_at, pipeline_version, feedback, resume_task_id)
         VALUES (?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, r.issue, r.stage, attempt, r.machine, now, r.pipelineVersion, r.feedback ? 1 : 0, r.resumeTaskId ?? null);
    const run = this.getRun(id)!;
    bus.publish({ type: "run", run });
    return run;
  }

  updateRun(id: string, patch: Partial<{ status: RunStatus; startedAt: string; finishedAt: string; taskId: string; cost: number; error: string | null }>) {
    const cols: Record<string, string> = {
      status: "status",
      startedAt: "started_at",
      finishedAt: "finished_at",
      taskId: "task_id",
      cost: "cost",
      error: "error",
    };
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      sets.push(`${cols[k]} = ?`);
      vals.push(v);
    }
    if (!sets.length) return;
    this.db.prepare(`UPDATE runs SET ${sets.join(", ")} WHERE id = ?`).run(...(vals as SQLInputValue[]), id);
    const run = this.getRun(id);
    if (run) bus.publish({ type: "run", run });
  }

  getRun(id: string): RunInfo | null {
    const row = this.db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as unknown as RunRow | undefined;
    return row ? toRun(row) : null;
  }

  /** Extra fields the runner needs that the UI doesn't. */
  getRunInternals(id: string): { feedback: boolean; resumeTaskId: string | null } {
    const row = this.db.prepare("SELECT feedback, resume_task_id FROM runs WHERE id = ?").get(id) as
      | { feedback: number; resume_task_id: string | null }
      | undefined;
    return { feedback: !!row?.feedback, resumeTaskId: row?.resume_task_id ?? null };
  }

  runsForIssue(issue: number, limit = 50): RunInfo[] {
    return (this.db
      .prepare("SELECT * FROM runs WHERE issue = ? ORDER BY queued_at DESC LIMIT ?")
      .all(issue, limit) as unknown as RunRow[]).map(toRun);
  }

  latestRuns(): Map<number, RunInfo> {
    const rows = this.db
      .prepare(
        `SELECT r.* FROM runs r JOIN (SELECT issue, MAX(queued_at) AS q FROM runs GROUP BY issue) m
         ON r.issue = m.issue AND r.queued_at = m.q`,
      )
      .all() as unknown as RunRow[];
    return new Map(rows.map((r) => [r.issue, toRun(r)]));
  }

  runsWithStatus(statuses: RunStatus[]): RunInfo[] {
    const q = statuses.map(() => "?").join(",");
    return (this.db.prepare(`SELECT * FROM runs WHERE status IN (${q})`).all(...statuses) as unknown as RunRow[]).map(toRun);
  }

  appendLog(runId: string, kind: LogLine["kind"], text: string): LogLine {
    const line: LogLine = { ts: new Date().toISOString(), kind, text };
    const seq =
      ((this.db.prepare("SELECT MAX(seq) AS s FROM logs WHERE run_id = ?").get(runId) as unknown as { s: number | null }).s ?? 0) + 1;
    this.db.prepare("INSERT INTO logs (run_id, seq, ts, kind, text) VALUES (?, ?, ?, ?, ?)").run(runId, seq, line.ts, kind, text);
    bus.publish({ type: "log", runId, line });
    return line;
  }

  logs(runId: string): LogLine[] {
    return this.db
      .prepare("SELECT ts, kind, text FROM logs WHERE run_id = ? ORDER BY seq")
      .all(runId) as unknown as LogLine[];
  }

  getSetting(key: string): string | null {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as unknown as { value: string } | undefined;
    return row?.value ?? null;
  }

  setSetting(key: string, value: string) {
    this.db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
  }
}

interface RunRow {
  id: string;
  issue: number;
  stage: string;
  status: RunStatus;
  attempt: number;
  machine: string;
  queued_at: string;
  started_at: string | null;
  finished_at: string | null;
  task_id: string | null;
  cost: number | null;
  error: string | null;
  pipeline_version: number;
}

function toRun(r: RunRow): RunInfo {
  return {
    id: r.id,
    issue: r.issue,
    stage: r.stage,
    status: r.status,
    attempt: r.attempt,
    machine: r.machine,
    queuedAt: r.queued_at,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    taskId: r.task_id,
    cost: r.cost,
    error: r.error,
    pipelineVersion: r.pipeline_version,
  };
}

/**
 * Node's built-in SQLite (node:sqlite, Node 22.13+), so there is no native
 * module to compile. Loaded lazily so its one-time "experimental" warning on
 * older Node versions can be silenced.
 */
function loadSqlite(): typeof import("node:sqlite") {
  const emit = process.emitWarning;
  process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
    if (String(warning).includes("SQLite is an experimental feature")) return;
    return (emit as (...a: unknown[]) => void).call(process, warning, ...rest);
  }) as typeof process.emitWarning;
  try {
    return createRequire(import.meta.url)("node:sqlite");
  } catch {
    throw new Error(`bob-pipeline needs Node 22.13 or later for built-in SQLite (you have ${process.version}).`);
  } finally {
    process.emitWarning = emit;
  }
}

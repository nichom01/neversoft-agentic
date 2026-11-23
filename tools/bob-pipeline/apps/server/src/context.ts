import type { Stage, LogLine } from "@bob-pipeline/shared";
import type { LoadedConfig } from "./config.js";
import type { GitHub, Issue } from "./github.js";
import type { Git } from "./git.js";
import type { Db } from "./db.js";

/** Long-lived services shared by the server, poller and runner. */
export interface Services {
  cfg: LoadedConfig;
  gh: GitHub;
  git: Git;
  db: Db;
}

/** Everything an input resolver or action gets while a stage runs. */
export interface RunContext extends Services {
  runId: string;
  issue: Issue;
  stage: Stage;
  /** Absolute path of the issue worktree. */
  worktree: string;
  /** Output dir relative to the worktree, e.g. docs/bob/42 */
  outputDir: string;
  branch: string;
  /** True when this run was triggered by bob:revise. */
  isRevision: boolean;
  log: (kind: LogLine["kind"], text: string) => void;
  /** Mutable per-issue state persisted to <outputDir>/state.json. */
  state: IssueState;
}

export interface IssueState {
  issue: number;
  pipelineVersion: number;
  prUrl?: string;
  prNumber?: number;
  history: {
    stage: string;
    runId: string;
    machine: string;
    finishedAt: string;
    cost: number | null;
    taskId: string | null;
    revision: boolean;
  }[];
}

import type { DerivedState, IssueStatus } from "./state.js";

export type RunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface RunInfo {
  id: string;
  issue: number;
  stage: string;
  status: RunStatus;
  attempt: number;
  machine: string;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  taskId: string | null;
  cost: number | null;
  error: string | null;
  pipelineVersion: number;
}

export interface IssueSummary {
  number: number;
  title: string;
  url: string;
  author: string;
  labels: string[];
  updatedAt: string;
  state: DerivedState;
  /** Latest local run for this issue (this machine only). */
  lastRun: RunInfo | null;
  /** True when this machine has a run queued or running for it. */
  activeHere: boolean;
}

export interface StageOutputFile {
  file: string;
  exists: boolean;
  content: string | null;
  /** Content of the previous committed version, for revision diffs. */
  previous: string | null;
  /** Result of JSON Schema validation when the output declares a schema. */
  schemaErrors: string[] | null;
}

export interface StageOutputs {
  stage: string;
  files: StageOutputFile[];
}

export interface IssueComment {
  id: number;
  author: string;
  body: string;
  createdAt: string;
}

export interface IssueRef {
  number: number;
  title: string;
  state: "open" | "closed";
}

export interface IssueDetail extends IssueSummary {
  /** GitHub "blocked by" dependencies (all states). */
  blockedBy: IssueRef[];
  body: string;
  branch: string;
  branchExists: boolean;
  prUrl: string | null;
  outputs: StageOutputs[];
  comments: IssueComment[];
  runs: RunInfo[];
}

export interface PollerStatus {
  enabled: boolean;
  intervalSeconds: number;
  lastPollAt: string | null;
  lastError: string | null;
  queueSize: number;
  running: number;
  concurrency: number;
  machine: string;
}

export type ServerEvent =
  | { type: "run"; run: RunInfo }
  | { type: "log"; runId: string; line: LogLine }
  | { type: "issues-changed" }
  | { type: "poller"; status: PollerStatus };

export interface LogLine {
  ts: string;
  kind: "bob" | "step" | "info" | "error";
  text: string;
}

// ---------- dependency graph (phase 2) ----------

export type DependencyKind = "blocked_by" | "blocks" | "overlaps";

export interface DependencyNode {
  number: number;
  title: string;
  status: IssueStatus;
  stage: string | null;
  components: string[];
  files: string[];
  hasPlan: boolean;
}

export interface DependencyEdge {
  /** Edges are normalised so `from` depends on / is blocked by `to`. Overlaps have no direction. */
  from: number;
  to: number;
  kind: DependencyKind;
  /** Where the edge came from. */
  source: "github" | "deps-check" | "plan" | "heuristic";
  confidence: "low" | "medium" | "high";
  reason: string;
  shared: string[];
  /** True when GitHub already has this as an issue dependency. */
  recorded: boolean;
}

export interface DependencyConflict {
  issues: number[];
  description: string;
  reportedBy: number;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  conflicts: DependencyConflict[];
  /** Topological order of issues by blocked_by edges (cycles listed separately). */
  suggestedOrder: number[];
  cycles: number[][];
  githubDependenciesAvailable: boolean;
}

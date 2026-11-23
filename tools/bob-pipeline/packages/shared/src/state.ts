import { labelNames, type Pipeline } from "./pipeline.js";

export type IssueStatus =
  | "not-started" // no pipeline labels
  | "ready" // has a trigger label, waiting for a worker
  | "running" // bob:working present
  | "review" // waiting for a human at a gate
  | "revise" // reviewer asked for changes, waiting for a worker
  | "failed"
  | "done"
  | "parked";

export type NextAction =
  | { type: "run"; stage: string; feedback: boolean }
  | { type: "finish"; afterStage: string };

export interface DerivedState {
  status: IssueStatus;
  /** Stage the issue is at (being run, under review, or last completed). */
  stage: string | null;
  /** Index of `stage` in pipeline.stages, or -1. */
  stageIndex: number;
  /** What a worker should do next, if anything. Present even while running/failed. */
  action: NextAction | null;
  /** Stage ids that have been approved/completed. */
  completed: string[];
}

/**
 * Work out where an issue is purely from its labels. GitHub labels are the
 * source of truth, so every machine (and the UI) reaches the same answer.
 *
 * Label lifecycle for a stage run:
 *   trigger label (start | <prev>-approved | revise+<stage>-review) stays on
 *   while bob:working is set, and is only swapped when the stage succeeds.
 *   On failure bob:failed is added and the trigger stays, so removing
 *   bob:failed retries exactly the same step.
 */
export function deriveState(labels: string[], p: Pipeline): DerivedState {
  const n = labelNames(p);
  const has = (l: string) => labels.includes(l);
  const stages = p.stages;

  const completed = stages.filter((s) => has(n.approved(s.id))).map((s) => s.id);
  const lastApprovedIdx = stages.reduce((acc, s, i) => (has(n.approved(s.id)) ? i : acc), -1);
  const reviewIdx = stages.findIndex((s) => s.gate === "human" && has(n.review(s.id)));

  let action: NextAction | null = null;
  let stageIndex = -1;

  if (reviewIdx >= 0 && has(n.revise)) {
    action = { type: "run", stage: stages[reviewIdx].id, feedback: true };
    stageIndex = reviewIdx;
  } else if (reviewIdx >= 0) {
    stageIndex = reviewIdx;
  } else if (lastApprovedIdx >= 0) {
    if (lastApprovedIdx === stages.length - 1) {
      action = has(n.done) ? null : { type: "finish", afterStage: stages[lastApprovedIdx].id };
      stageIndex = lastApprovedIdx;
    } else {
      action = { type: "run", stage: stages[lastApprovedIdx + 1].id, feedback: false };
      stageIndex = lastApprovedIdx + 1;
    }
  } else if (has(n.start)) {
    action = { type: "run", stage: stages[0].id, feedback: false };
    stageIndex = 0;
  }

  const stage = stageIndex >= 0 ? stages[stageIndex].id : null;
  const base = { stage, stageIndex, action, completed };

  if (has(n.parked)) return { ...base, status: "parked", action: null };
  if (has(n.done)) return { ...base, status: "done", stage: stages[stages.length - 1].id, stageIndex: stages.length - 1, action: null };
  if (has(n.working)) return { ...base, status: "running" };
  if (has(n.failed)) return { ...base, status: "failed" };
  if (action?.type === "run" && action.feedback) return { ...base, status: "revise" };
  if (reviewIdx >= 0) return { ...base, status: "review" };
  if (action) return { ...base, status: "ready" };
  return { ...base, status: "not-started" };
}

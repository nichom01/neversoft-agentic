import { z } from "zod";

/**
 * Schema for pipeline.yaml. This is the single definition of "the process":
 * the server engine, the label names and the UI are all derived from it.
 */

export const RunStepSchema = z.object({
  run: z.string().describe("Shell command run in the issue worktree"),
  on_fail: z.enum(["fail", "continue", "retry_with_output"]).default("fail"),
  timeout_seconds: z.number().int().positive().default(900),
});

export const ActionStepSchema = z.object({
  action: z.string().describe("Name of a registered action, e.g. open_draft_pr"),
  with: z.record(z.unknown()).default({}),
});

export const StepSchema = z.union([RunStepSchema, ActionStepSchema]);

export const OutputSchema = z.object({
  file: z.string().describe("File name, relative to the stage output dir"),
  schema: z.string().optional().describe("JSON Schema path, relative to the pipeline dir"),
  required: z.boolean().default(true),
});

export const StageSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/, "stage ids must be lowercase kebab-case"),
  name: z.string(),
  description: z.string().optional(),
  mode: z.string().describe("Bob custom mode slug from .bob/custom_modes.yaml"),
  prompt: z.string().describe("Prompt template path, relative to the pipeline dir"),
  inputs: z.array(z.string()).default([]),
  outputs: z.array(OutputSchema).default([]),
  gate: z.enum(["human", "auto"]).default("human"),
  view: z.string().default("plan"),
  comment: z.string().optional().describe("Output file to post as an issue comment"),
  commit: z.enum(["outputs", "all"]).default("outputs"),
  max_cost: z.number().positive().optional(),
  max_turns: z.number().int().positive().optional(),
  retries: z.number().int().min(0).default(1).describe("Retries when outputs fail validation"),
  pre: z.array(StepSchema).default([]),
  post: z.array(StepSchema).default([]),
  /** Actions run when a human approves this stage (e.g. record dependencies). */
  on_approve: z.array(ActionStepSchema).default([]),
  /** Don't start this stage while the issue has open "blocked by" issues on GitHub. */
  wait_for_blockers: z.boolean().default(false),
});

export const PipelineSchema = z.object({
  version: z.number().int().positive(),
  repo: z
    .object({
      path: z.string().default("../.."),
      base_branch: z.string().default("main"),
      remote: z.string().default("origin"),
      owner: z.string().optional(),
      name: z.string().optional(),
    })
    .default({}),
  labels: z
    .object({
      prefix: z.string().default("bob:"),
      start: z.string().default("start"),
      working: z.string().default("working"),
      revise: z.string().default("revise"),
      failed: z.string().default("failed"),
      done: z.string().default("done"),
      parked: z.string().default("parked"),
    })
    .default({}),
  branch: z.string().default("bob/issue-{{issue}}"),
  output_dir: z.string().default("docs/bob/{{issue}}"),
  worktrees_dir: z.string().default("~/.bob-pipeline/worktrees"),
  poller: z
    .object({
      interval_seconds: z.number().int().min(15).default(120),
      concurrency: z.number().int().min(1).default(2),
      claim_settle_seconds: z.number().min(0).default(3),
    })
    .default({}),
  bob: z
    .object({
      bin: z.string().default("bob"),
      args: z
        .array(z.string())
        .default([
          "run",
          "--accept-license",
          "--trust",
          "--format",
          "stream-json",
          "--mode",
          "{{mode}}",
          "--max-cost",
          "{{max_cost}}",
          "--max-turns",
          "{{max_turns}}",
          "--workspace",
          "{{workspace}}",
        ]),
      resume_args: z.array(z.string()).default(["--resume", "{{task_id}}"]),
      prompt_via: z.enum(["stdin", "arg"]).default("stdin"),
      env: z.record(z.string()).default({}),
    })
    .default({}),
  defaults: z
    .object({
      max_cost: z.number().positive().default(2),
      max_turns: z.number().int().positive().default(40),
    })
    .default({}),
  stages: z.array(StageSchema).min(1),
});

export type Pipeline = z.infer<typeof PipelineSchema>;
export type Stage = z.infer<typeof StageSchema>;
export type Step = z.infer<typeof StepSchema>;
export type RunStep = z.infer<typeof RunStepSchema>;
export type ActionStep = z.infer<typeof ActionStepSchema>;

export function isRunStep(s: Step): s is RunStep {
  return "run" in s;
}

/** Fill {{name}} placeholders. Unknown names are left as-is. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key: string) =>
    key in vars ? String(vars[key]) : m,
  );
}

/** All label names the pipeline uses, derived from config. */
export function labelNames(p: Pipeline) {
  const L = p.labels;
  const pre = L.prefix;
  return {
    start: pre + L.start,
    working: pre + L.working,
    revise: pre + L.revise,
    failed: pre + L.failed,
    done: pre + L.done,
    parked: pre + L.parked,
    review: (stageId: string) => `${pre}${stageId}-review`,
    approved: (stageId: string) => `${pre}${stageId}-approved`,
  };
}

/** Every label (with a colour and description) so they can be created in the repo. */
export function allLabels(p: Pipeline): { name: string; color: string; description: string }[] {
  const n = labelNames(p);
  const out = [
    { name: n.start, color: "0e8a16", description: "Start the Bob pipeline for this issue" },
    { name: n.working, color: "fbca04", description: "Bob is working on this issue (lock)" },
    { name: n.revise, color: "d93f0b", description: "Rerun the current stage with review feedback" },
    { name: n.failed, color: "b60205", description: "The last Bob stage failed" },
    { name: n.done, color: "5319e7", description: "Bob pipeline complete" },
    { name: n.parked, color: "c5def5", description: "Parked: the pipeline ignores this issue" },
  ];
  for (const s of p.stages) {
    if (s.gate === "human") {
      out.push({ name: n.review(s.id), color: "1d76db", description: `Waiting for review: ${s.name}` });
    }
    // Auto-gated stages also get an "approved" label: it marks them complete,
    // so a failure further on resumes from the right place.
    out.push({
      name: n.approved(s.id),
      color: "0e8a16",
      description: s.gate === "human" ? `Approved: ${s.name}` : `Completed: ${s.name}`,
    });
  }
  return out;
}

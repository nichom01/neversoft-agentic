import { exec } from "./exec.js";
import { fill, type Pipeline } from "@bob-pipeline/shared";

export interface BobRunOptions {
  mode: string;
  maxCost: number;
  maxTurns: number;
  workspace: string;
  prompt: string;
  resumeTaskId?: string | null;
  onEvent: (summary: string) => void;
  timeoutMs?: number;
}

export interface BobRunResult {
  exitCode: number;
  taskId: string | null;
  cost: number | null;
  stderrTail: string;
  timedOut: boolean;
}

/**
 * Invoke Bob Shell headlessly using the command defined in pipeline.yaml.
 * Output is expected as stream-json (one JSON object per line), but any
 * line that isn't JSON is passed through as plain text, so this keeps
 * working if the format differs between Bob Shell versions.
 */
export async function runBob(p: Pipeline, o: BobRunOptions): Promise<BobRunResult> {
  const vars = {
    mode: o.mode,
    max_cost: o.maxCost,
    max_turns: o.maxTurns,
    workspace: o.workspace,
    task_id: o.resumeTaskId ?? "",
  };
  const args = p.bob.args.map((a) => fill(a, vars));
  if (o.resumeTaskId) args.push(...p.bob.resume_args.map((a) => fill(a, vars)));
  if (p.bob.prompt_via === "arg") args.push(o.prompt);

  if (!process.env.BOB_API_KEY && !p.bob.env.BOB_API_KEY) {
    o.onEvent("warning: BOB_API_KEY is not set; Bob Shell headless runs need it");
  }

  let taskId: string | null = null;
  let cost: number | null = null;

  const r = await exec(p.bob.bin, args, {
    cwd: o.workspace,
    env: { ...process.env, ...p.bob.env },
    input: p.bob.prompt_via === "stdin" ? o.prompt : undefined,
    timeoutMs: o.timeoutMs ?? 60 * 60 * 1000,
    onLine: (line, stream) => {
      if (!line.trim()) return;
      if (stream === "stderr") return o.onEvent(`stderr: ${line}`);
      const ev = tryJson(line);
      if (!ev) return o.onEvent(line);
      taskId = taskId ?? findString(ev, ["task_id", "taskId", "session_id", "sessionId"]);
      const c = findNumber(ev, ["session_costs", "total_cost", "totalCost", "cost", "bobcoins", "cost_bobcoins"]);
      if (c !== null) cost = c;
      o.onEvent(summarise(ev));
    },
  }).catch((err: NodeJS.ErrnoException) => {
    if (err.code === "ENOENT") throw new Error(`Bob Shell not found ("${p.bob.bin}"). Install it or set bob.bin in pipeline.yaml.`);
    throw err;
  });

  return {
    exitCode: r.code,
    taskId,
    cost,
    stderrTail: r.stderr.trim().split("\n").slice(-30).join("\n"),
    timedOut: r.timedOut,
  };
}

function tryJson(line: string): Record<string, unknown> | null {
  const t = line.trim();
  if (!t.startsWith("{")) return null;
  try {
    const v = JSON.parse(t);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function walk(v: unknown, visit: (k: string, val: unknown) => void, depth = 0) {
  if (!v || typeof v !== "object" || depth > 4) return;
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    visit(k, val);
    walk(val, visit, depth + 1);
  }
}

function findString(v: unknown, keys: string[]): string | null {
  let found: string | null = null;
  walk(v, (k, val) => {
    if (!found && keys.includes(k) && typeof val === "string" && val) found = val;
  });
  return found;
}

function findNumber(v: unknown, keys: string[]): number | null {
  let found: number | null = null;
  walk(v, (k, val) => {
    if (found === null && keys.includes(k) && typeof val === "number") found = val;
  });
  return found;
}

/** One readable line per event for the live log. */
function summarise(ev: Record<string, unknown>): string {
  const type = String(ev.type ?? ev.event ?? "event") + (typeof ev.role === "string" ? `:${ev.role}` : "");
  if (ev.type === "result") {
    const cost = findNumber(ev, ["session_costs", "total_cost", "cost"]);
    const ms = findNumber(ev, ["duration_ms"]);
    const tools = findNumber(ev, ["tool_calls"]);
    return `[result] ${String(ev.status ?? "done")}` +
      (cost !== null ? ` · cost ${cost}` : "") +
      (ms !== null ? ` · ${(ms / 1000).toFixed(1)}s` : "") +
      (tools !== null ? ` · ${tools} tool calls` : "");
  }
  const text =
    pickText(ev.text) ?? pickText(ev.content) ?? pickText(ev.message) ?? pickText(ev.delta) ?? pickText(ev.result);
  const tool = findString(ev, ["tool", "tool_name", "toolName", "name"]);
  const body = text ?? (tool ? `tool: ${tool}` : JSON.stringify(ev));
  return `[${type}] ${body.length > 2000 ? body.slice(0, 2000) + "…" : body}`;
}

function pickText(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    const parts = v.map((x) => (typeof x === "string" ? x : pickText((x as Record<string, unknown>)?.text))).filter(Boolean);
    return parts.length ? parts.join("") : null;
  }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return pickText(o.text) ?? pickText(o.content);
  }
  return null;
}

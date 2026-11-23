import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { isRunStep } from "@bob-pipeline/shared";
import type { LoadedConfig } from "./config.js";
import { knownInputNames } from "./inputs/index.js";
import { knownActionNames } from "./actions/index.js";
import { compileSchema } from "./schemas.js";

/** UI views that ship with the dashboard. Others fall back to "plan". */
export const KNOWN_VIEWS = ["plan", "raw", "diff", "dependency-graph", "test-pyramid"];

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

/** Check pipeline.yaml against the files and code it refers to. */
export function validatePipeline(cfg: LoadedConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const p = cfg.pipeline;

  if (!fs.existsSync(path.join(cfg.repoPath, ".git"))) errors.push(`repo.path does not point at a git repo: ${cfg.repoPath}`);

  // Bob modes defined in the repo.
  const modesFile = path.join(cfg.repoPath, ".bob", "custom_modes.yaml");
  let modes: string[] | null = null;
  if (fs.existsSync(modesFile)) {
    try {
      const doc = YAML.parse(fs.readFileSync(modesFile, "utf8")) as { customModes?: { slug: string }[] };
      modes = (doc.customModes ?? []).map((m) => m.slug);
    } catch (e) {
      errors.push(`.bob/custom_modes.yaml is not valid YAML: ${(e as Error).message}`);
    }
  } else {
    warnings.push(`${modesFile} not found; cannot check stage modes (global modes in ~/.bob may still work)`);
  }
  const builtInModes = ["agent", "plan", "ask", "code", "advanced", "orchestrator"];

  const ids = new Set<string>();
  const inputNames = new Set(knownInputNames());
  const actions = new Set(knownActionNames());

  p.stages.forEach((s, idx) => {
    const where = `stage "${s.id}"`;
    if (ids.has(s.id)) errors.push(`${where}: duplicate id`);
    ids.add(s.id);

    if (!fs.existsSync(path.resolve(cfg.pipelineDir, s.prompt))) errors.push(`${where}: prompt file not found: ${s.prompt}`);
    if (modes && !modes.includes(s.mode) && !builtInModes.includes(s.mode)) {
      errors.push(`${where}: mode "${s.mode}" is not in .bob/custom_modes.yaml`);
    }
    if (!fs.existsSync(path.join(cfg.repoPath, ".bob", `rules-${s.mode}`)) && modes?.includes(s.mode)) {
      warnings.push(`${where}: no .bob/rules-${s.mode}/ folder (templates/instructions for the mode)`);
    }

    for (const o of s.outputs) {
      if (!o.schema) continue;
      const abs = path.resolve(cfg.pipelineDir, o.schema);
      if (!fs.existsSync(abs)) errors.push(`${where}: schema not found: ${o.schema}`);
      else {
        try {
          compileSchema(abs);
        } catch (e) {
          errors.push(`${where}: schema ${o.schema} is invalid: ${(e as Error).message}`);
        }
      }
      if (!o.file.endsWith(".json")) warnings.push(`${where}: ${o.file} has a schema but is not a .json file`);
    }
    if (s.comment && !s.outputs.some((o) => o.file === s.comment)) {
      warnings.push(`${where}: comment "${s.comment}" is not one of its outputs`);
    }

    const earlier = new Set(p.stages.slice(0, idx).map((x) => x.id));
    for (const spec of s.inputs) {
      const [name, arg] = spec.split(":", 2);
      if (inputNames.has(name)) {
        if (name === "all_open" && (!arg || !p.stages.some((x) => x.id === arg))) {
          errors.push(`${where}: input "${spec}" must name a stage, e.g. all_open:hlp`);
        }
        continue;
      }
      if (earlier.has(name)) continue;
      if (ids.has(name) || p.stages.some((x) => x.id === name)) errors.push(`${where}: input "${spec}" refers to a stage that runs later or is itself`);
      else errors.push(`${where}: unknown input "${spec}". Known: ${[...inputNames].join(", ")} or an earlier stage id`);
    }

    for (const step of [...s.pre, ...s.post]) {
      if (!isRunStep(step) && !actions.has(step.action)) errors.push(`${where}: unknown action "${step.action}"`);
    }

    for (const step of s.on_approve) {
      if (!actions.has(step.action)) errors.push(`${where}: unknown on_approve action "${step.action}"`);
    }
    if (s.on_approve.length && s.gate !== "human") warnings.push(`${where}: on_approve only runs for human-gated stages`);

    if (!KNOWN_VIEWS.includes(s.view)) warnings.push(`${where}: view "${s.view}" is not built in; the UI will use "plan"`);
    if (s.gate === "auto" && idx === p.stages.length - 1) {
      warnings.push(`${where}: the last stage is auto-gated, so nobody reviews the final output`);
    }
  });

  return { errors, warnings };
}

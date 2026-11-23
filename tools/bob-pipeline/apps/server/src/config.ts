import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { PipelineSchema, type Pipeline, type Stage } from "@bob-pipeline/shared";

const here = path.dirname(fileURLToPath(import.meta.url));
/** tools/bob-pipeline */
export const TOOL_DIR = path.resolve(here, "../../..");

export interface LoadedConfig {
  pipeline: Pipeline;
  /** Directory containing pipeline.yaml; prompt/schema paths are relative to it. */
  pipelineDir: string;
  pipelinePath: string;
  /** Absolute path of the developer's repo clone. */
  repoPath: string;
  /** Absolute root for this repo's worktrees. */
  worktreesRoot: string;
  dataDir: string;
}

export function expandHome(p: string): string {
  return p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p;
}

export function loadConfig(configPath = process.env.BOB_PIPELINE_CONFIG): LoadedConfig {
  const pipelinePath = path.resolve(configPath ?? path.join(TOOL_DIR, "pipeline.yaml"));
  const raw = fs.readFileSync(pipelinePath, "utf8");
  const parsed = PipelineSchema.safeParse(YAML.parse(raw));
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid ${pipelinePath}:\n${issues}`);
  }
  const pipeline = parsed.data;
  const pipelineDir = path.dirname(pipelinePath);
  const repoPath = path.resolve(pipelineDir, pipeline.repo.path);
  const repoKey = path.basename(repoPath);
  const worktreesRoot = path.join(path.resolve(expandHome(pipeline.worktrees_dir)), repoKey);
  const dataDir = path.resolve(process.env.BOB_PIPELINE_DATA ?? path.join(TOOL_DIR, ".data"));
  fs.mkdirSync(dataDir, { recursive: true });
  return { pipeline, pipelineDir, pipelinePath, repoPath, worktreesRoot, dataDir };
}

export function stageById(p: Pipeline, id: string): Stage {
  const s = p.stages.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown stage "${id}"`);
  return s;
}

export function stageIndex(p: Pipeline, id: string): number {
  return p.stages.findIndex((x) => x.id === id);
}

export const MACHINE = `${os.userInfo().username}@${os.hostname()}`;

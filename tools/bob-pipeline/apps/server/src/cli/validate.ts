import { loadConfig } from "../config.js";
import { validatePipeline } from "../validate.js";
import { allLabels } from "@bob-pipeline/shared";

try {
  const cfg = loadConfig(process.argv[2]);
  const { errors, warnings } = validatePipeline(cfg);
  console.log(`Pipeline v${cfg.pipeline.version}: ${cfg.pipeline.stages.map((s) => `${s.id}${s.gate === "auto" ? "(auto)" : ""}`).join(" → ")}`);
  console.log(`Repo: ${cfg.repoPath}`);
  console.log(`Labels: ${allLabels(cfg.pipeline).map((l) => l.name).join(", ")}`);
  for (const w of warnings) console.log(`  warning: ${w}`);
  for (const e of errors) console.log(`  ERROR:   ${e}`);
  if (errors.length) {
    console.log(`\n${errors.length} error(s).`);
    process.exit(1);
  }
  console.log("\nOK");
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}

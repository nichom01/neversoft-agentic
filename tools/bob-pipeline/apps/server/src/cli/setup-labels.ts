import { loadConfig } from "../config.js";
import { GitHub } from "../github.js";
import { allLabels } from "@bob-pipeline/shared";

try {
  const cfg = loadConfig(process.argv[2]);
  const gh = await GitHub.create(cfg);
  const created = await gh.ensureLabels(allLabels(cfg.pipeline));
  console.log(created.length ? `Created ${created.length} label(s): ${created.join(", ")}` : "All labels already exist.");
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}

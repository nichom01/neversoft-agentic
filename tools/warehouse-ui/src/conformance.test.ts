// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import viteConfig from "../vite.config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../../..");

describe("warehouse-ui conformance", () => {
  // T-32: UI dependency ranges match the pipeline web app
  it("T-32: UI dependency ranges match the pipeline web app", () => {
    const uiPkgPath = path.join(rootDir, "tools/warehouse-ui/package.json");
    const uiPkg = JSON.parse(fs.readFileSync(uiPkgPath, "utf-8"));

    const pipelineWebPkgPath = path.join(rootDir, "tools/bob-pipeline/apps/web/package.json");
    const pipelineWebPkg = JSON.parse(fs.readFileSync(pipelineWebPkgPath, "utf-8"));

    const pipelineRootPkgPath = path.join(rootDir, "tools/bob-pipeline/package.json");
    const pipelineRootPkg = JSON.parse(fs.readFileSync(pipelineRootPkgPath, "utf-8"));

    const pipelineServerPkgPath = path.join(rootDir, "tools/bob-pipeline/apps/server/package.json");
    const pipelineServerPkg = JSON.parse(fs.readFileSync(pipelineServerPkgPath, "utf-8"));

    // Check dependency matches
    const allUiDeps = { ...uiPkg.dependencies, ...uiPkg.devDependencies };
    const allPipelineDeps = { ...pipelineWebPkg.dependencies, ...pipelineWebPkg.devDependencies };

    const expectedKeys = [
      "react",
      "react-dom",
      "react-router-dom",
      "@tanstack/react-query",
      "tailwindcss",
      "@tailwindcss/vite",
      "vite",
      "@vitejs/plugin-react",
      "@types/react",
      "@types/react-dom",
    ];

    for (const key of expectedKeys) {
      expect(allUiDeps[key]).toBe(allPipelineDeps[key]);
    }

    const pipelineTsVersion =
      pipelineRootPkg.devDependencies?.typescript ||
      pipelineServerPkg.devDependencies?.typescript;
    expect(allUiDeps.typescript).toBe(pipelineTsVersion);

    // Check pipeline-only packages are absent
    const excludedKeys = [
      "@bob-pipeline/shared",
      "@xyflow/react",
      "@dagrejs/dagre",
      "diff",
      "react-markdown",
      "remark-gfm",
      "@tailwindcss/typography",
      "@types/diff",
    ];

    for (const key of excludedKeys) {
      expect(allUiDeps[key]).toBeUndefined();
    }
  });

  // T-33: vite.config.ts static settings
  it("T-33: vite.config.ts static settings", () => {
    expect(viteConfig.server?.port).toBe(4322);
    expect(viteConfig.server?.strictPort).toBe(true);

    const apiProxy = viteConfig.server?.proxy?.["/api"];
    expect(typeof apiProxy === "object" ? apiProxy.target : apiProxy).toBe("http://127.0.0.1:4323");

    // Ensure no proxy targets 4321
    const proxyStr = JSON.stringify(viteConfig.server?.proxy ?? {});
    expect(proxyStr).not.toContain("4321");

    // Ensure React and Tailwind plugins are present
    const plugins = viteConfig.plugins as Array<{ name?: string }>;
    expect(Array.isArray(plugins)).toBe(true);
    const pluginNames = plugins.map((p) => p?.name || "").filter(Boolean);
    expect(pluginNames.some((n) => n.includes("react"))).toBe(true);
    expect(pluginNames.some((n) => n.includes("tailwind"))).toBe(true);
  });
});

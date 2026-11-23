// Static checks for the #8 UI restyle. Run: npm run test:style -w @bob-pipeline/web
// Uses node:test, so no new dependency. Test ids (T-n) trace to docs/bob/8/tests.json.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const src = join(root, "src");
const read = (p) => readFileSync(join(src, p), "utf8");

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const files = walk(src).filter((f) => /\.(tsx?|css)$/.test(f));

function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test("T-2: no slate/indigo chrome, no outline-none, hex only in graph and pyramid", () => {
  for (const f of files) {
    const rel = relative(src, f);
    const text = readFileSync(f, "utf8");
    assert.ok(!/slate-/.test(text), `${rel} still uses slate-*`);
    assert.ok(!/outline-none/.test(text), `${rel} uses outline-none`);
    assert.ok(!/emerald-600/.test(text), `${rel} uses emerald-600 text`);
    if (rel !== "index.css" && !/DepGraph\.tsx|TestPyramidView\.tsx/.test(rel)) {
      assert.ok(!/#[0-9a-fA-F]{6}\b/.test(text), `${rel} has hex colours outside graph/pyramid`);
    }
    if (!/ui\.tsx$/.test(rel)) assert.ok(!/indigo-/.test(text), `${rel} uses indigo-* outside the review badge`);
  }
});

test("T-10: WCAG AA contrast >= 4.5 for introduced text/background pairs", () => {
  const white = "#ffffff";
  const pairs = [
    ["white on brand-700", white, "#0f766e"],
    ["white on brand-800", white, "#115e59"],
    ["brand-700 on brand-50", "#0f766e", "#f0fdfa"],
    ["muted on surface", "#4b5563", white],
    ["muted on canvas", "#4b5563", "#f9fafb"],
    ["muted on subtle", "#4b5563", "#f3f4f6"],
    ["code-ink on code", "#e5e7eb", "#111827"],
    ["code-muted on code", "#9ca3af", "#111827"],
    ["code-ink on code-bar", "#e5e7eb", "#1f2937"],
    ["gray-700 on gray-100", "#374151", "#f3f4f6"],
    ["gray-700 on gray-200", "#374151", "#e5e7eb"],
    ["white on pyramid smoke", white, "#c2410c"],
    ["white on pyramid bdd", white, "#6d28d9"],
    ["white on pyramid component", white, "#1d4ed8"],
    ["white on pyramid unit", white, "#0f766e"],
  ];
  for (const [name, fg, bg] of pairs) assert.ok(contrast(fg, bg) >= 4.5, `${name}: ${contrast(fg, bg).toFixed(2)}`);
});

test("T-11: edgeStyle maps each edge kind to its GRAPH_COLORS value and dash", () => {
  const t = read("components/DepGraph.tsx");
  const colors = Object.fromEntries([...t.matchAll(/^\s+(\w+): "(#[0-9a-f]{6})"/gm)].map((m) => [m[1], m[2]]));
  assert.equal(colors.overlaps, "#6b7280");
  assert.equal(colors.recorded, "#0f766e");
  assert.equal(colors.depsCheck, "#c2410c");
  assert.equal(colors.plan, "#4f46e5");
  assert.match(t, /kind === "overlaps"\) return \{ stroke: GRAPH_COLORS\.overlaps, strokeDasharray: "2 4"/);
  assert.match(t, /e\.recorded\) return \{ stroke: GRAPH_COLORS\.recorded, strokeDasharray: undefined/);
  assert.match(t, /"deps-check"\) return \{ stroke: GRAPH_COLORS\.depsCheck, strokeDasharray: "6 4"/);
  assert.match(t, /return \{ stroke: GRAPH_COLORS\.plan, strokeDasharray: "6 4"/);
  assert.equal(new Set([colors.overlaps, colors.recorded, colors.depsCheck, colors.plan]).size, 4);
});

test("T-12: statusStyle keeps eight statuses, gray neutrals, pulse on running", () => {
  const t = read("components/ui.tsx");
  const block = t.slice(t.indexOf("const statusStyle"), t.indexOf("export function StatusBadge"));
  for (const k of ["not-started", "ready", "running", "review", "revise", "failed", "done", "parked"]) assert.ok(block.includes(k), `missing ${k}`);
  assert.match(block, /"not-started".*bg-gray-100 text-gray-700/);
  assert.match(block, /parked.*bg-gray-200 text-gray-700/);
  assert.match(block, /running.*animate-pulse/);
});

test("T-13: test pyramid META uses darkened colours and literal text classes", () => {
  const t = read("views/TestPyramidView.tsx");
  assert.match(t, /smoke: .*color: "#c2410c", text: "text-orange-700"/);
  assert.match(t, /bdd: .*color: "#6d28d9", text: "text-violet-700"/);
  assert.match(t, /component: .*color: "#1d4ed8", text: "text-blue-700"/);
  assert.match(t, /unit: .*color: "#0f766e", text: "text-brand-700"/);
});

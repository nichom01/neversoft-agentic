import {
  deriveState,
  type DependencyConflict,
  type DependencyEdge,
  type DependencyGraph,
  type DependencyNode,
} from "@bob-pipeline/shared";
import type { Services } from "./context.js";
import type { Issue } from "./github.js";

/**
 * Build the cross-issue dependency graph from four sources, strongest first:
 *   github     "blocked by" relationships already recorded on GitHub
 *   deps-check the dependency-check stage's output (deps.json)
 *   plan       depends_on_issues in each issue's plan JSON
 *   heuristic  plans that name the same files or components
 *
 * Plan fields are found by shape (components / files_likely_touched /
 * depends_on_issues / dependencies / conflicts), not by stage id, so renamed
 * or extra stages still feed the graph.
 */
export async function buildDependencyGraph(svc: Services, openIssues: Issue[]): Promise<DependencyGraph> {
  const { cfg, gh, git } = svc;
  const p = cfg.pipeline;
  await git.fetch(10_000).catch(() => {});

  const inPipeline = openIssues.filter((i) => {
    const s = deriveState(i.labels, p).status;
    return s !== "not-started" && s !== "parked";
  });
  const byNumber = new Map(openIssues.map((i) => [i.number, i]));

  const nodes = new Map<number, DependencyNode>();
  const plans = new Map<number, Record<string, unknown>[]>();
  const jsonOutputs = p.stages.flatMap((s) => s.outputs.filter((o) => o.file.endsWith(".json")).map((o) => o.file));

  for (const issue of inPipeline) {
    const branch = git.branchFor(issue.number);
    const dir = git.outputDirFor(issue.number);
    const docs: Record<string, unknown>[] = [];
    if (await git.remoteBranchExists(branch)) {
      for (const f of jsonOutputs) {
        const text = await git.show(branch, `${dir}/${f}`);
        if (!text) continue;
        try {
          const v = JSON.parse(text);
          if (v && typeof v === "object") docs.push(v as Record<string, unknown>);
        } catch {
          /* invalid JSON is reported on the issue page */
        }
      }
    }
    plans.set(issue.number, docs);
    const st = deriveState(issue.labels, p);
    nodes.set(issue.number, {
      number: issue.number,
      title: issue.title,
      status: st.status,
      stage: st.stage,
      components: strings(docs, "components"),
      files: strings(docs, "files_likely_touched"),
      hasPlan: docs.length > 0,
    });
  }

  const edges = new Map<string, DependencyEdge>();
  const rank = { github: 3, "deps-check": 2, plan: 1, heuristic: 0 } as const;
  const add = (e: DependencyEdge) => {
    if (e.from === e.to) return;
    if (e.kind === "overlaps" && e.from > e.to) [e.from, e.to] = [e.to, e.from];
    if (e.kind === "blocks") [e.from, e.to, e.kind] = [e.to, e.from, "blocked_by"];
    const key = `${e.kind}:${e.from}:${e.to}`;
    const prev = edges.get(key);
    if (!prev) return void edges.set(key, e);
    const keep = rank[e.source] > rank[prev.source] ? e : prev;
    const other = keep === e ? prev : e;
    edges.set(key, {
      ...keep,
      recorded: prev.recorded || e.recorded,
      reason: keep.reason.includes(other.reason) ? keep.reason : `${keep.reason}; ${other.reason}`,
      shared: [...new Set([...keep.shared, ...other.shared])],
    });
  };

  // 1. GitHub's recorded dependencies.
  let githubAvailable = true;
  for (const n of nodes.keys()) {
    const blockers = await gh.listBlockedBy(n).catch(() => null);
    if (blockers === null) {
      githubAvailable = false;
      continue;
    }
    for (const b of blockers) {
      if (!nodes.has(b.number)) {
        const st = byNumber.has(b.number) ? deriveState(byNumber.get(b.number)!.labels, p) : null;
        nodes.set(b.number, {
          number: b.number,
          title: b.title,
          status: b.state === "closed" ? "done" : st?.status ?? "not-started",
          stage: st?.stage ?? null,
          components: [],
          files: [],
          hasPlan: false,
        });
      }
      add({ from: n, to: b.number, kind: "blocked_by", source: "github", confidence: "high", reason: "Recorded on GitHub", shared: [], recorded: true });
    }
  }

  // 2 + 3. Dependency check and plan output.
  const conflicts: DependencyConflict[] = [];
  for (const [n, docs] of plans) {
    for (const doc of docs) {
      for (const d of arr(doc.dependencies)) {
        const other = Number(d.issue);
        if (!Number.isInteger(other)) continue;
        const kind = d.kind === "blocks" || d.kind === "overlaps" ? d.kind : "blocked_by";
        add({
          from: n,
          to: other,
          kind,
          source: "deps-check",
          confidence: d.confidence === "high" || d.confidence === "low" ? d.confidence : "medium",
          reason: String(d.reason ?? `#${n}'s dependency check`),
          shared: Array.isArray(d.shared) ? d.shared.map(String) : [],
          recorded: false,
        });
      }
      for (const c of arr(doc.conflicts)) {
        conflicts.push({ issues: Array.isArray(c.issues) ? c.issues.map(Number) : [n], description: String(c.description ?? ""), reportedBy: n });
      }
      for (const other of Array.isArray(doc.depends_on_issues) ? doc.depends_on_issues : []) {
        if (Number.isInteger(other)) {
          add({ from: n, to: other as number, kind: "blocked_by", source: "plan", confidence: "medium", reason: `#${n}'s plan depends on it`, shared: [], recorded: false });
        }
      }
    }
  }

  // 4. Overlapping files and components between plans.
  const list = [...nodes.values()].filter((x) => x.hasPlan);
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const files = a.files.filter((f) => b.files.some((g) => pathsOverlap(f, g)));
      const comps = a.components.filter((c) => b.components.some((d) => d.toLowerCase() === c.toLowerCase()));
      if (!files.length && !comps.length) continue;
      add({
        from: a.number,
        to: b.number,
        kind: "overlaps",
        source: "heuristic",
        confidence: files.length ? "medium" : "low",
        reason: [files.length && `both plan to touch ${files.length} file path(s)`, comps.length && `shared components: ${comps.join(", ")}`].filter(Boolean).join("; "),
        shared: [...files, ...comps],
        recorded: false,
      });
    }
  }

  // Mark blocked_by edges GitHub already knows about.
  const recorded = new Set([...edges.values()].filter((e) => e.source === "github").map((e) => `${e.from}:${e.to}`));
  for (const e of edges.values()) if (e.kind === "blocked_by" && recorded.has(`${e.from}:${e.to}`)) e.recorded = true;

  // An overlap between two issues that already have a blocking link adds nothing: the order is decided.
  const ordered = new Set([...edges.values()].filter((e) => e.kind === "blocked_by").flatMap((e) => [`${e.from}:${e.to}`, `${e.to}:${e.from}`]));
  const allEdges = [...edges.values()].filter(
    (e) => (nodes.has(e.from) || nodes.has(e.to)) && !(e.kind === "overlaps" && ordered.has(`${e.from}:${e.to}`)),
  );
  // Make sure every edge endpoint has a node (e.g. a plan names an issue not in the pipeline).
  for (const e of allEdges) {
    for (const n of [e.from, e.to]) {
      if (nodes.has(n)) continue;
      const i = byNumber.get(n);
      const st = i ? deriveState(i.labels, p) : null;
      nodes.set(n, {
        number: n,
        title: i?.title ?? `#${n} (closed or not found)`,
        status: st?.status ?? "done",
        stage: st?.stage ?? null,
        components: [],
        files: [],
        hasPlan: false,
      });
    }
  }

  const { order, cycles } = orderByBlockers([...nodes.keys()], allEdges.filter((e) => e.kind === "blocked_by"));
  return { nodes: [...nodes.values()], edges: allEdges, conflicts, suggestedOrder: order, cycles, githubDependenciesAvailable: githubAvailable };
}

function arr(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : [];
}

function strings(docs: Record<string, unknown>[], key: string): string[] {
  return [...new Set(docs.flatMap((d) => (Array.isArray(d[key]) ? (d[key] as unknown[]).map(String) : [])))];
}

/** "src/auth/*" overlaps "src/auth/token.ts"; "src/a.ts" overlaps "src/a.ts". */
export function pathsOverlap(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/^\.\//, "").replace(/\/?\*\*?.*$/, "").replace(/\/$/, "");
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  return x === y || y.startsWith(x + "/") || x.startsWith(y + "/");
}

/** Topological order (blockers first) plus any cycles, via Tarjan's SCC. */
export function orderByBlockers(nodes: number[], blockedBy: { from: number; to: number }[]) {
  const deps = new Map<number, number[]>(nodes.map((n) => [n, []]));
  for (const e of blockedBy) deps.get(e.from)?.push(e.to);

  let index = 0;
  const idx = new Map<number, number>();
  const low = new Map<number, number>();
  const stack: number[] = [];
  const onStack = new Set<number>();
  const sccs: number[][] = [];
  const strong = (v: number) => {
    idx.set(v, index);
    low.set(v, index++);
    stack.push(v);
    onStack.add(v);
    for (const w of deps.get(v) ?? []) {
      if (!idx.has(w)) {
        strong(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) low.set(v, Math.min(low.get(v)!, idx.get(w)!));
    }
    if (low.get(v) === idx.get(v)) {
      const comp: number[] = [];
      let w: number;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        comp.push(w);
      } while (w !== v);
      sccs.push(comp);
    }
  };
  for (const n of [...nodes].sort((a, b) => a - b)) if (!idx.has(n)) strong(n);
  // Tarjan emits SCCs with dependencies first, which is the order we want.
  return {
    order: sccs.flatMap((c) => c.sort((a, b) => a - b)),
    cycles: sccs.filter((c) => c.length > 1 || (deps.get(c[0]) ?? []).includes(c[0])),
  };
}

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Background, Controls, MarkerType, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import type { DependencyEdge, DependencyGraph } from "@bob-pipeline/shared";
import { StatusBadge } from "./ui";

const W = 220;
const H = 74;

/** Edge styling, also used by the legend. */
export function edgeStyle(e: Pick<DependencyEdge, "kind" | "source" | "recorded">) {
  if (e.kind === "overlaps") return { stroke: "#94a3b8", strokeDasharray: "2 4", label: "overlaps" };
  if (e.recorded) return { stroke: "#059669", strokeDasharray: undefined, label: "blocked by (on GitHub)" };
  if (e.source === "deps-check") return { stroke: "#ea580c", strokeDasharray: "6 4", label: "blocked by (dependency check)" };
  return { stroke: "#6366f1", strokeDasharray: "6 4", label: "blocked by (plan)" };
}

/**
 * Blockers are laid out to the left of the issues they block. Arrows point
 * from a blocker to the issue waiting on it. Overlaps are dotted, undirected.
 */
export function DepGraph({
  graph,
  focus,
  showOverlaps = true,
  height = 520,
}: {
  graph: DependencyGraph;
  focus?: number;
  showOverlaps?: boolean;
  height?: number;
}) {
  const navigate = useNavigate();

  const { nodes, edges } = useMemo(() => {
    let es = graph.edges.filter((e) => showOverlaps || e.kind !== "overlaps");
    let ns = graph.nodes;
    if (focus !== undefined) {
      es = es.filter((e) => e.from === focus || e.to === focus);
      const keep = new Set([focus, ...es.flatMap((e) => [e.from, e.to])]);
      ns = ns.filter((n) => keep.has(n.number));
    }

    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: "LR", nodesep: 30, ranksep: 90, marginx: 10, marginy: 10 });
    g.setDefaultEdgeLabel(() => ({}));
    for (const n of ns) g.setNode(String(n.number), { width: W, height: H });
    for (const e of es) if (e.kind === "blocked_by") g.setEdge(String(e.to), String(e.from));
    dagre.layout(g);

    const nodes: Node[] = ns.map((n) => {
      const pos = g.node(String(n.number));
      const isFocus = n.number === focus;
      return {
        id: String(n.number),
        position: { x: (pos?.x ?? 0) - W / 2, y: (pos?.y ?? 0) - H / 2 },
        draggable: true,
        connectable: false,
        data: {
          label: (
            <div className="text-left">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-slate-500">#{n.number}</span>
                <StatusBadge status={n.status} />
              </div>
              <div className="line-clamp-2 text-xs font-medium leading-snug">{n.title}</div>
            </div>
          ),
        },
        style: {
          width: W,
          padding: 8,
          borderRadius: 8,
          border: isFocus ? "2px solid #4f46e5" : n.hasPlan ? "1px solid #cbd5e1" : "1px dashed #cbd5e1",
          background: n.status === "done" ? "#f8fafc" : "white",
          cursor: "pointer",
        },
      };
    });

    const edges: Edge[] = es.map((e, i) => {
      const s = edgeStyle(e);
      const directed = e.kind === "blocked_by";
      return {
        id: `${e.kind}-${e.from}-${e.to}-${i}`,
        source: String(directed ? e.to : e.from),
        target: String(directed ? e.from : e.to),
        type: "smoothstep",
        animated: directed && !e.recorded && e.confidence === "high",
        style: { stroke: s.stroke, strokeDasharray: s.strokeDasharray, strokeWidth: e.confidence === "high" ? 2.2 : 1.4 },
        markerEnd: directed ? { type: MarkerType.ArrowClosed, color: s.stroke } : undefined,
        label: e.confidence === "low" ? undefined : e.shared.length ? `${e.shared.length} shared` : undefined,
        labelStyle: { fontSize: 10, fill: "#64748b" },
      };
    });
    return { nodes, edges };
  }, [graph, focus, showOverlaps]);

  if (!nodes.length) return <p className="text-sm text-slate-500">No issues to show.</p>;

  return (
    <div style={{ height }} className="rounded-lg border border-slate-200 bg-white">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesConnectable={false}
        onNodeClick={(_, n) => navigate(`/issues/${n.id}`)}
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
      >
        <Background gap={16} color="#e2e8f0" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export function GraphLegend() {
  const items: Pick<DependencyEdge, "kind" | "source" | "recorded">[] = [
    { kind: "blocked_by", source: "github", recorded: true },
    { kind: "blocked_by", source: "deps-check", recorded: false },
    { kind: "blocked_by", source: "plan", recorded: false },
    { kind: "overlaps", source: "heuristic", recorded: false },
  ];
  return (
    <div className="flex flex-wrap gap-4 text-xs text-slate-600">
      {items.map((it) => {
        const s = edgeStyle(it);
        return (
          <span key={s.label} className="flex items-center gap-1.5">
            <svg width="28" height="8">
              <line x1="0" y1="4" x2="28" y2="4" stroke={s.stroke} strokeWidth="2" strokeDasharray={s.strokeDasharray} />
            </svg>
            {s.label}
          </span>
        );
      })}
      <span>Arrows point from the blocker to the issue waiting on it. Dashed box = no plan yet.</span>
    </div>
  );
}

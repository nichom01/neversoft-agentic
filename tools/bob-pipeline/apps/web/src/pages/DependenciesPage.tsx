import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api, useDependencies } from "../api";
import { DepGraph, GraphLegend } from "../components/DepGraph";
import { DependencyTable } from "../components/DependencyTable";
import { Button, Card, ErrorBox } from "../components/ui";

/** Cross-issue dependency review: graph, suggested order, conflicts, and links to record. */
export function DependenciesPage() {
  const { data: graph, isLoading, error } = useDependencies();
  const qc = useQueryClient();
  const [showOverlaps, setShowOverlaps] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      qc.setQueryData(["dependencies"], await api.get("/api/dependencies?refresh=1"));
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading) return <p className="text-muted">Building dependency graph…</p>;
  if (error || !graph) return <ErrorBox error={error ?? "No data"} />;

  const unrecorded = graph.edges.filter((e) => e.kind === "blocked_by" && !e.recorded);
  const title = (n: number) => graph.nodes.find((x) => x.number === n)?.title ?? "";
  const inCycle = new Set(graph.cycles.flat());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Dependencies across issues</h1>
        <span className="text-sm text-muted">
          {graph.nodes.length} issues · {graph.edges.filter((e) => e.kind === "blocked_by").length} blocking links ·{" "}
          {graph.edges.filter((e) => e.kind === "overlaps").length} overlaps
        </span>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-brand-700" checked={showOverlaps} onChange={(e) => setShowOverlaps(e.target.checked)} />
          Show overlaps
        </label>
        <Button onClick={refresh} disabled={refreshing}>
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {graph.cycles.length > 0 && (
        <div className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <b>Circular dependencies:</b>{" "}
          {graph.cycles.map((c) => c.map((n) => `#${n}`).join(" ↔ ")).join("; ")}. These issues can't all go first; one link needs removing or
          the work needs splitting.
        </div>
      )}
      {graph.conflicts.length > 0 && (
        <div className="rounded-control border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <b>Conflicting plans</b>
          <ul className="mt-1 list-disc pl-5">
            {graph.conflicts.map((c, i) => (
              <li key={i}>
                {c.issues.map((n) => `#${n}`).join(", ")}: {c.description} <span className="text-amber-800">(reported by #{c.reportedBy})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Card className="p-4">
        <DepGraph graph={graph} showOverlaps={showOverlaps} height={560} />
        <div className="mt-3">
          <GraphLegend />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-4">
          <h2 className="mb-1 font-semibold">Suggested order</h2>
          <p className="mb-3 text-xs text-muted">Blockers first, from all blocking links (recorded or suggested).</p>
          <ol className="space-y-1 text-sm">
            {graph.suggestedOrder.map((n, i) => (
              <li key={n} className="flex gap-2">
                <span className="w-5 text-right text-muted">{i + 1}.</span>
                <Link to={`/issues/${n}`} className={`hover:underline ${inCycle.has(n) ? "text-red-700" : "text-brand-700"}`}>
                  #{n} {title(n)}
                </Link>
              </li>
            ))}
          </ol>
        </Card>
        <Card className="p-4 lg:col-span-2">
          <h2 className="mb-1 font-semibold">Review</h2>
          <p className="mb-3 text-xs text-muted">
            {unrecorded.length
              ? `${unrecorded.length} suggested blocking link(s) aren't on GitHub yet. Recording one stops the blocked issue's implement stage until the blocker is closed.`
              : "Every blocking link is recorded on GitHub."}
          </p>
          <DependencyTable graph={graph} edges={graph.edges.filter((e) => showOverlaps || e.kind !== "overlaps")} />
        </Card>
      </div>
    </div>
  );
}

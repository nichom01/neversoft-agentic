import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import type { DependencyEdge, DependencyGraph } from "@bob-pipeline/shared";
import { api } from "../api";
import { Button } from "./ui";
import { edgeStyle } from "./DepGraph";

const sourceLabel = { github: "GitHub", "deps-check": "Dependency check", plan: "Plan", heuristic: "Same files/components" };

/**
 * Review table for dependencies. Suggested "blocked by" links can be recorded
 * on GitHub with one click; for overlaps the reviewer picks which goes first.
 */
export function DependencyTable({ graph, edges, readOnly }: { graph: DependencyGraph; edges: DependencyEdge[]; readOnly?: boolean }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const title = (n: number) => graph.nodes.find((x) => x.number === n)?.title ?? "";

  const record = async (waiting: number, blocker: number) => {
    const key = `${waiting}-${blocker}`;
    setBusy(key);
    setErr(null);
    try {
      await api.post(`/api/issues/${waiting}/dependencies`, { blockedBy: blocker });
      await qc.invalidateQueries({ queryKey: ["dependencies"] });
      await qc.invalidateQueries({ queryKey: ["issue"] });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!edges.length) return <p className="text-sm text-muted">No dependencies found.</p>;

  const order = { high: 0, medium: 1, low: 2 };
  const sorted = [...edges].sort((a, b) => Number(a.kind === "overlaps") - Number(b.kind === "overlaps") || order[a.confidence] - order[b.confidence]);

  return (
    <div className="space-y-2">
      {err && <p className="text-sm text-red-700">{err}</p>}
      {!graph.githubDependenciesAvailable && (
        <p className="text-xs text-amber-700">GitHub issue dependencies aren't available on this server, so links can't be recorded there.</p>
      )}
      <div className="overflow-auto rounded-control border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-left text-xs text-muted">
            <tr className="font-medium">
              <th className="px-3 py-2">Relationship</th>
              <th className="px-3 py-2">Confidence</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Why</th>
              {!readOnly && <th className="px-3 py-2"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sorted.map((e, i) => (
              <tr key={i} className="align-top">
                <td className="px-3 py-2">
                  <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: edgeStyle(e).stroke }} />
                  <IssueLink n={e.from} title={title(e.from)} />
                  <span className="mx-1 text-muted">{e.kind === "overlaps" ? "overlaps" : "is blocked by"}</span>
                  <IssueLink n={e.to} title={title(e.to)} />
                </td>
                <td className="px-3 py-2 text-xs">{e.confidence}</td>
                <td className="px-3 py-2 text-xs">{sourceLabel[e.source]}</td>
                <td className="px-3 py-2 text-xs text-muted">
                  {e.reason}
                  {e.shared.length > 0 && <div className="mt-1 font-mono text-[11px] text-muted">{e.shared.slice(0, 6).join(", ")}</div>}
                </td>
                {!readOnly && (
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {e.kind === "blocked_by" ? (
                      e.recorded ? (
                        <span className="text-xs text-emerald-700">✓ on GitHub</span>
                      ) : (
                        <Button disabled={!!busy || !graph.githubDependenciesAvailable} onClick={() => record(e.from, e.to)}>
                          Record on GitHub
                        </Button>
                      )
                    ) : (
                      <div className="flex flex-col items-end gap-1">
                        <Button disabled={!!busy || !graph.githubDependenciesAvailable} onClick={() => record(e.to, e.from)}>
                          #{e.from} first
                        </Button>
                        <Button disabled={!!busy || !graph.githubDependenciesAvailable} onClick={() => record(e.from, e.to)}>
                          #{e.to} first
                        </Button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IssueLink({ n, title }: { n: number; title: string }) {
  return (
    <Link to={`/issues/${n}`} className="font-medium text-brand-700 hover:underline" title={title}>
      #{n}
    </Link>
  );
}

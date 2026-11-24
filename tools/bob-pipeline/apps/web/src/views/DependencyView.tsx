import { Link } from "react-router-dom";
import { useDependencies } from "../api";
import { DepGraph, GraphLegend } from "../components/DepGraph";
import { DependencyTable } from "../components/DependencyTable";
import { PlanView, type StageViewProps } from "./base";

/** The dependency-check stage: this issue's neighbourhood in the cross-issue graph. */
export function DependencyView(props: StageViewProps) {
  const n = props.issue.number;
  const { data: graph, isLoading, error } = useDependencies();
  const edges = graph?.edges.filter((e) => e.from === n || e.to === n) ?? [];
  const order = graph?.suggestedOrder.filter((x) => edges.some((e) => e.from === x || e.to === x) || x === n) ?? [];

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Related issues</h3>
          <Link to="/dependencies" className="text-xs text-brand-700 hover:underline">
            All issues →
          </Link>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted">Building graph…</p>
        ) : error || !graph ? (
          <p className="text-sm text-red-700">{(error as Error)?.message ?? "No data"}</p>
        ) : edges.length ? (
          <>
            <DepGraph graph={graph} focus={n} height={320} />
            <div className="mt-2">
              <GraphLegend />
            </div>
            {order.length > 1 && (
              <p className="mt-3 text-sm">
                <span className="text-muted">Suggested order: </span>
                {order.map((x, i) => (
                  <span key={x}>
                    {i > 0 && " → "}
                    <span className={x === n ? "font-semibold" : ""}>#{x}</span>
                  </span>
                ))}
              </p>
            )}
            <div className="mt-4">
              <DependencyTable graph={graph} edges={edges} />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">No dependencies with other open issues.</p>
        )}
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold">Dependency check output</h3>
        <PlanView {...props} />
      </section>
    </div>
  );
}

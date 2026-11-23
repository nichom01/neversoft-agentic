import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import type { IssueStatus, IssueSummary } from "@bob-pipeline/shared";
import { api, useIssues, usePipeline } from "../api";
import { Button, Card, ErrorBox, StatusBadge, duration, timeAgo } from "../components/ui";

const ATTENTION: IssueStatus[] = ["review", "failed"];

export function Dashboard() {
  const { data: info } = usePipeline();
  const { data: issues = [], isLoading, error } = useIssues();
  const [filter, setFilter] = useState<"all" | IssueStatus>("all");
  const [showIdle, setShowIdle] = useState(false);

  const stages = info?.pipeline.stages ?? [];
  const inPipeline = issues.filter((i) => !["not-started", "parked"].includes(i.state.status));
  const visible = filter === "all" ? inPipeline : inPipeline.filter((i) => i.state.status === filter);
  const idle = issues.filter((i) => i.state.status === "not-started");
  const parked = issues.filter((i) => i.state.status === "parked");

  const counts = useMemo(() => {
    const c: Partial<Record<IssueStatus, number>> = {};
    for (const i of inPipeline) c[i.state.status] = (c[i.state.status] ?? 0) + 1;
    return c;
  }, [inPipeline]);

  if (isLoading) return <p className="text-slate-500">Loading issues…</p>;

  return (
    <div className="space-y-6">
      <ErrorBox error={error} />

      <div className="flex flex-wrap gap-2">
        {(["all", "running", "review", "ready", "revise", "failed", "done"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full border px-3 py-1 text-sm ${filter === s ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 bg-white"} ${
              s !== "all" && ATTENTION.includes(s) && counts[s] ? "font-semibold" : ""
            }`}
          >
            {s === "all" ? `All (${inPipeline.length})` : `${label(s)} (${counts[s] ?? 0})`}
          </button>
        ))}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${stages.length + 1}, minmax(190px, 1fr))`, overflowX: "auto" }}>
        {stages.map((s, idx) => (
          <Column key={s.id} title={s.name} subtitle={s.gate === "auto" ? "auto" : "review gate"} index={idx + 1}>
            {visible
              .filter((i) => i.state.stage === s.id && i.state.status !== "done")
              .map((i) => (
                <IssueCard key={i.number} issue={i} />
              ))}
          </Column>
        ))}
        <Column title="Done" index={stages.length + 1}>
          {visible
            .filter((i) => i.state.status === "done")
            .map((i) => (
              <IssueCard key={i.number} issue={i} />
            ))}
        </Column>
      </div>

      <Card>
        <button className="flex w-full items-center justify-between px-4 py-3 text-left" onClick={() => setShowIdle(!showIdle)}>
          <span className="font-semibold">Not in the pipeline ({idle.length})</span>
          <span className="text-sm text-slate-500">{showIdle ? "Hide" : "Show"}</span>
        </button>
        {showIdle && (
          <div className="divide-y divide-slate-100 border-t border-slate-100">
            {idle.map((i) => (
              <IdleRow key={i.number} issue={i} />
            ))}
            {!idle.length && <p className="px-4 py-3 text-sm text-slate-500">Every open issue is in the pipeline.</p>}
          </div>
        )}
      </Card>

      {parked.length > 0 && (
        <p className="text-sm text-slate-500">
          Parked:{" "}
          {parked.map((i) => (
            <Link key={i.number} className="mr-2 underline" to={`/issues/${i.number}`}>
              #{i.number}
            </Link>
          ))}
        </p>
      )}
    </div>
  );
}

function label(s: IssueStatus) {
  return { running: "Processing", review: "Needs review", ready: "Ready", revise: "Revising", failed: "Failed", done: "Done" }[s as string] ?? s;
}

function Column({ title, subtitle, index, children }: { title: string; subtitle?: string; index: number; children: React.ReactNode }) {
  const empty = !(Array.isArray(children) ? children.length : children);
  return (
    <div className="flex min-h-48 flex-col rounded-lg bg-slate-100 p-3">
      <div className="mb-3 flex items-baseline gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-300 text-xs font-bold">{index}</span>
        <h3 className="font-semibold">{title}</h3>
        {subtitle && <span className="text-xs text-slate-500">{subtitle}</span>}
      </div>
      <div className="flex flex-col gap-2">{empty ? <p className="text-xs text-slate-400">Nothing here</p> : children}</div>
    </div>
  );
}

function IssueCard({ issue }: { issue: IssueSummary }) {
  const r = issue.lastRun;
  return (
    <Link to={`/issues/${issue.number}`}>
      <Card className="p-3 transition hover:border-slate-400">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-xs font-mono text-slate-500">#{issue.number}</span>
          <StatusBadge status={issue.state.status} />
        </div>
        <div className="text-sm font-medium leading-snug">{issue.title}</div>
        <div className="mt-2 text-xs text-slate-500">
          {issue.state.status === "running" && r?.status === "running" ? (
            <>Running {duration(r.startedAt, null)} on this machine</>
          ) : issue.state.status === "running" ? (
            <>Running on another machine</>
          ) : r ? (
            <>
              Last run {r.status} {timeAgo(r.finishedAt ?? r.queuedAt)}
              {r.cost ? ` · ${r.cost.toFixed(2)} coins` : ""}
            </>
          ) : (
            <>Updated {timeAgo(issue.updatedAt)}</>
          )}
        </div>
      </Card>
    </Link>
  );
}

function IdleRow({ issue }: { issue: IssueSummary }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const start = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/api/issues/${issue.number}/start`, { runNow: true });
      await qc.invalidateQueries({ queryKey: ["issues"] });
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <span className="font-mono text-xs text-slate-500">#{issue.number}</span>
      <Link to={`/issues/${issue.number}`} className="flex-1 text-sm hover:underline">
        {issue.title}
      </Link>
      {err ? <span className="text-xs text-red-600">{(err as Error).message}</span> : null}
      <Button variant="primary" onClick={start} disabled={busy}>
        Start pipeline
      </Button>
    </div>
  );
}

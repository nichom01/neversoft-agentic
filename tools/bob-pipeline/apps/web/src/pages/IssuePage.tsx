import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { IssueDetail, Pipeline, RunInfo } from "@bob-pipeline/shared";
import { api, useIssue, usePipeline } from "../api";
import { Button, Card, ErrorBox, StatusBadge, duration, timeAgo } from "../components/ui";
import { LogView } from "../components/LogView";
import { StageView } from "../views";

export function IssuePage() {
  const n = Number(useParams().n);
  const { data: info } = usePipeline();
  const { data: issue, isLoading, error } = useIssue(n);
  const [tab, setTab] = useState<string | null>(null);

  useEffect(() => {
    if (issue && tab === null) setTab(issue.state.stage ?? info?.pipeline.stages[0]?.id ?? null);
  }, [issue, info, tab]);

  if (isLoading || !info) return <p className="text-muted">Loading…</p>;
  if (error || !issue) return <ErrorBox error={error ?? "Not found"} />;

  const p = info.pipeline;
  const stage = p.stages.find((s) => s.id === tab) ?? p.stages[0];
  const outputs = issue.outputs.find((o) => o.stage === stage.id)?.files ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-muted hover:underline">
          ← Dashboard
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            <span className="text-muted">#{issue.number}</span> {issue.title}
          </h1>
          <StatusBadge status={issue.state.status} />
        </div>
        <div className="mt-1 flex flex-wrap gap-4 text-sm text-muted">
          <a href={issue.url} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">
            Issue on GitHub ↗
          </a>
          {issue.branchExists && <span className="font-mono">{issue.branch}</span>}
          {issue.prUrl && (
            <a href={issue.prUrl} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">
              Draft PR ↗
            </a>
          )}
        </div>
        {issue.blockedBy.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Blocked by:</span>
            {issue.blockedBy.map((b) => (
              <Link
                key={b.number}
                to={`/issues/${b.number}`}
                className={`rounded-full px-2 py-0.5 text-xs ${b.state === "open" ? "bg-red-100 text-red-800" : "bg-subtle text-muted line-through"}`}
                title={b.title}
              >
                #{b.number} {b.title.length > 40 ? b.title.slice(0, 40) + "…" : b.title}
              </Link>
            ))}
          </div>
        )}
      </div>

      <Stepper p={p} issue={issue} selected={stage.id} onSelect={setTab} />

      <ActionPanel issue={issue} p={p} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">{stage.name}</h2>
            <span className="text-xs text-muted">
              mode <span className="font-mono">{stage.mode}</span> · {stage.gate === "human" ? "review gate" : "auto"}
            </span>
          </div>
          {stage.description && <p className="mb-4 text-sm text-muted">{stage.description}</p>}
          <StageView issue={issue} stage={stage} files={outputs} />
        </Card>

        <div className="space-y-6">
          <Runs runs={issue.runs} p={p} />
          <Card className="p-4">
            <h3 className="mb-2 font-semibold">Issue</h3>
            <article className="prose prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{issue.body || "_No description._"}</ReactMarkdown>
            </article>
          </Card>
          <Card className="p-4">
            <h3 className="mb-2 font-semibold">Discussion ({issue.comments.length})</h3>
            <div className="max-h-[32rem] space-y-3 overflow-auto">
              {issue.comments.map((c) => (
                <div key={c.id} className="border-l-2 border-line pl-3">
                  <div className="text-xs text-muted">
                    {c.author} · {timeAgo(c.createdAt)}
                  </div>
                  <div className="prose prose-sm max-w-none prose-headings:text-sm prose-headings:my-1">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{c.body.replace(/<!--[\s\S]*?-->/g, "").slice(0, 3000)}</ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stepper({ p, issue, selected, onSelect }: { p: Pipeline; issue: IssueDetail; selected: string; onSelect: (id: string) => void }) {
  const s = issue.state;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {p.stages.map((st, i) => {
        const done = s.completed.includes(st.id) || s.status === "done";
        const current = s.stage === st.id && s.status !== "done";
        const cls = done
          ? "border-brand-200 bg-brand-50 text-brand-800"
          : current
            ? "border-brand-700 bg-brand-700 text-white"
            : "border-line bg-surface text-muted";
        return (
          <div key={st.id} className="flex items-center gap-2">
            {i > 0 && <span className="text-line-strong">→</span>}
            <button
              onClick={() => onSelect(st.id)}
              className={`rounded-control border px-3 py-1.5 text-sm transition-colors ${cls} ${selected === st.id ? "ring-2 ring-brand-500 ring-offset-1" : ""}`}
            >
              {done ? "✓ " : current ? "● " : ""}
              {st.name}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ActionPanel({ issue, p }: { issue: IssueDetail; p: Pipeline }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [comment, setComment] = useState("");
  const [runHere, setRunHere] = useState(true);
  const [messages, setMessages] = useState<string[]>([]);
  const s = issue.state;
  const stage = p.stages.find((x) => x.id === s.stage);
  const nextStage = stage ? p.stages[p.stages.indexOf(stage) + 1] : undefined;

  const act = async (path: string, body: object = {}) => {
    setBusy(true);
    setErr(null);
    setMessages([]);
    try {
      const res = await api.post<{ messages?: string[] }>(`/api/issues/${issue.number}/${path}`, body);
      setMessages(res.messages ?? []);
      setComment("");
      await qc.invalidateQueries({ queryKey: ["issue", issue.number] });
      await qc.invalidateQueries({ queryKey: ["issues"] });
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  let content: React.ReactNode = null;
  if (s.status === "review" && stage) {
    content = (
      <div className="space-y-3">
        <div>
          <h3 className="font-semibold">Review: {stage.name}</h3>
          <p className="text-sm text-muted">
            Approving moves the issue to {nextStage ? <b>{nextStage.name}</b> : "done"}. Requesting changes reruns this stage with your comment as feedback.
          </p>
        </div>
        <textarea
          className="w-full rounded-control border border-line-strong bg-surface p-2 text-sm"
          rows={4}
          placeholder="Comment (required to request changes, optional note when approving)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" disabled={busy} onClick={() => act("approve", { stage: stage.id, note: comment, runNow: runHere })}>
            ✓ Approve {stage.name}
          </Button>
          <Button disabled={busy || !comment.trim()} onClick={() => act("request-changes", { stage: stage.id, comment, runNow: runHere })}>
            ↻ Request changes
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => act("park", { parked: true })}>
            Park
          </Button>
          <label className="ml-auto flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" className="accent-brand-700" checked={runHere} onChange={(e) => setRunHere(e.target.checked)} />
            Run the next step on this machine now
          </label>
        </div>
      </div>
    );
  } else if (s.status === "failed") {
    const last = issue.runs[0];
    content = (
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h3 className="font-semibold text-red-700">{stage?.name ?? "Stage"} failed</h3>
          {last?.error && <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-xs text-red-700">{last.error}</pre>}
        </div>
        <Button variant="primary" disabled={busy} onClick={() => act("retry", { resume: false })}>
          Retry from scratch
        </Button>
        {last?.taskId && (
          <Button disabled={busy} onClick={() => act("retry", { resume: true })}>
            Resume Bob task
          </Button>
        )}
      </div>
    );
  } else if (s.status === "running") {
    content = (
      <div className="flex items-center gap-3">
        <p className="flex-1 text-sm">
          <b>{stage?.name}</b> is processing{issue.activeHere ? " on this machine" : " on another machine"}.
        </p>
        {!issue.activeHere && (
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => confirm("Only do this if the other machine has crashed. Remove the lock?") && act("unlock")}
          >
            Clear stale lock
          </Button>
        )}
      </div>
    );
  } else if (s.status === "ready" || s.status === "revise") {
    content = (
      <div className="flex items-center gap-3">
        <p className="flex-1 text-sm">
          {s.status === "revise" ? "Waiting to revise" : "Waiting to run"} <b>{stage?.name}</b>
          {issue.activeHere ? " (queued here)" : ". The auto-poller will pick it up, or run it now."}
          {stage?.wait_for_blockers && issue.blockedBy.some((b) => b.state === "open") && (
            <span className="block text-red-700">
              Waiting for {issue.blockedBy.filter((b) => b.state === "open").map((b) => `#${b.number}`).join(", ")} to be closed first.
            </span>
          )}
        </p>
        <Button variant="primary" disabled={busy || issue.activeHere} onClick={() => act("run")}>
          Run now on this machine
        </Button>
      </div>
    );
  } else if (s.status === "not-started") {
    content = (
      <div className="flex items-center gap-3">
        <p className="flex-1 text-sm">This issue isn't in the pipeline yet.</p>
        <Button variant="primary" disabled={busy} onClick={() => act("start", { runNow: true })}>
          Start pipeline
        </Button>
      </div>
    );
  } else if (s.status === "parked") {
    content = (
      <div className="flex items-center gap-3">
        <p className="flex-1 text-sm">Parked. The pipeline ignores this issue until it's unparked.</p>
        <Button disabled={busy} onClick={() => act("park", { parked: false })}>
          Unpark
        </Button>
      </div>
    );
  } else if (s.status === "done") {
    content = <p className="text-sm">🎉 All stages complete.</p>;
  }

  return (
    <Card className={`p-4 ${s.status === "review" ? "border-brand-300" : s.status === "failed" ? "border-red-300" : ""}`}>
      {content}
      {err ? (
        <div className="mt-3">
          <ErrorBox error={err} />
        </div>
      ) : null}
      {messages.length > 0 && (
        <ul className="mt-3 list-disc rounded-control bg-canvas py-2 pl-8 pr-3 text-xs text-ink">
          {messages.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Runs({ runs, p }: { runs: RunInfo[]; p: Pipeline }) {
  const active = runs.find((r) => r.status === "running" || r.status === "queued");
  const [open, setOpen] = useState<string | null>(active?.id ?? null);
  useEffect(() => {
    if (active) setOpen(active.id);
  }, [active?.id]);
  const name = (id: string) => p.stages.find((s) => s.id === id)?.name ?? id;
  return (
    <Card className="p-4">
      <h3 className="mb-2 font-semibold">Runs on this machine</h3>
      {!runs.length && <p className="text-sm text-muted">None yet.</p>}
      <div className="space-y-2">
        {runs.map((r) => (
          <div key={r.id}>
            <button className="flex w-full items-center gap-2 text-left text-sm" onClick={() => setOpen(open === r.id ? null : r.id)}>
              <span className={`h-2 w-2 rounded-full ${dot(r.status)}`} />
              <span className="flex-1">
                {name(r.stage)} <span className="text-muted">#{r.attempt}</span>
              </span>
              <span className="text-xs text-muted">
                {r.status} · {duration(r.startedAt, r.finishedAt)}
                {r.cost ? ` · ${r.cost.toFixed(2)}` : ""}
              </span>
            </button>
            {open === r.id && (
              <div className="mt-2">
                <LogView runId={r.id} live={r.status === "running"} />
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function dot(s: RunInfo["status"]) {
  return { queued: "bg-sky-400", running: "bg-amber-400 animate-pulse", succeeded: "bg-emerald-500", failed: "bg-red-500", cancelled: "bg-gray-400" }[s];
}

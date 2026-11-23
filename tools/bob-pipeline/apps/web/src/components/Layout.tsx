import { Link, NavLink, Outlet } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api, usePipeline, usePoller, useServerEvents } from "../api";
import { Button, timeAgo } from "./ui";
import { useState } from "react";

export function Layout() {
  useServerEvents();
  const { data: info } = usePipeline();
  const { data: poller } = usePoller();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      qc.setQueryData(["poller"], await api.post("/api/poller", { enabled: !poller?.enabled }));
    } finally {
      setBusy(false);
    }
  };
  const pollNow = async () => {
    setBusy(true);
    try {
      await api.post("/api/poller/poll-now");
      await qc.invalidateQueries({ queryKey: ["issues"] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-surface shadow-card">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="text-lg font-semibold tracking-tight text-ink">
            🤖 Bob pipeline
          </Link>
          <nav className="flex gap-1 text-sm">
            {[
              ["/", "Board"],
              ["/dependencies", "Dependencies"],
            ].map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                end
                className={({ isActive }) =>
                  `rounded-control px-3 py-1.5 font-medium ${isActive ? "bg-brand-50 text-brand-700" : "text-muted hover:bg-subtle hover:text-ink"}`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          {info && (
            <span className="text-sm text-muted">
              {info.repo.owner}/{info.repo.name} · v{info.pipeline.version} · {info.user}
            </span>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            {poller && (
              <>
                <span className="text-muted">
                  {poller.running}/{poller.concurrency} running · {poller.queueSize} queued
                  {poller.lastPollAt && ` · polled ${timeAgo(poller.lastPollAt)}`}
                </span>
                {poller.lastError && <span className="text-red-700" title={poller.lastError}>poll error</span>}
                <label className="flex cursor-pointer items-center gap-2" title="Only one person needs auto-poll on">
                  <input type="checkbox" className="accent-brand-700" checked={poller.enabled} onChange={toggle} disabled={busy} />
                  Auto-poll every {poller.intervalSeconds}s
                </label>
                <Button onClick={pollNow} disabled={busy}>
                  Poll now
                </Button>
              </>
            )}
          </div>
        </div>
        {info?.warnings.length ? (
          <div className="border-t border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-900 sm:px-6">
            pipeline.yaml: {info.warnings.join(" · ")}
          </div>
        ) : null}
      </header>
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}

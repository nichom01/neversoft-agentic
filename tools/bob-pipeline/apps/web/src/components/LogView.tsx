import { useEffect, useRef, useState } from "react";
import { useRunLogs } from "../api";

const kindCls = {
  bob: "text-code-ink",
  step: "text-sky-300",
  info: "text-brand-300",
  error: "text-red-300",
};

export function LogView({ runId, live }: { runId: string; live: boolean }) {
  const { data: lines = [], isLoading } = useRunLogs(runId);
  const ref = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);

  useEffect(() => {
    if (follow && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines.length, follow]);

  return (
    <div className="overflow-hidden rounded-control border border-code-bar">
      <div className="flex items-center justify-between bg-code-bar px-3 py-1 text-xs text-code-ink">
        <span>
          Run {runId} {live && <span className="ml-1 text-amber-300">● live</span>}
        </span>
        <label className="flex items-center gap-1">
          <input type="checkbox" className="accent-brand-500" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> follow
        </label>
      </div>
      <div ref={ref} className="max-h-96 overflow-auto bg-code p-3 font-mono text-xs leading-relaxed">
        {isLoading && <div className="text-code-muted">Loading…</div>}
        {lines.map((l, i) => (
          <div key={i} className={`whitespace-pre-wrap ${kindCls[l.kind]}`}>
            <span className="mr-2 text-code-muted">{l.ts.slice(11, 19)}</span>
            {l.text}
          </div>
        ))}
        {!isLoading && !lines.length && <div className="text-code-muted">No output yet.</div>}
      </div>
    </div>
  );
}

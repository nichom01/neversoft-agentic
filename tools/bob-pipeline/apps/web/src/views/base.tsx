import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { diffLines } from "diff";
import type { IssueDetail, Stage, StageOutputFile } from "@bob-pipeline/shared";

export interface StageViewProps {
  issue: IssueDetail;
  stage: Stage;
  files: StageOutputFile[];
}
import { useDiff } from "../api";

export function PlanView({ files }: StageViewProps) {
  const present = files.filter((f) => f.exists);
  if (!present.length) return <p className="text-sm text-muted">No outputs yet for this stage.</p>;
  return (
    <div className="space-y-6">
      {present.map((f) => (
        <OutputFile key={f.file} f={f} />
      ))}
    </div>
  );
}

function OutputFile({ f }: { f: StageOutputFile }) {
  const [showChanges, setShowChanges] = useState(false);
  const isJson = f.file.endsWith(".json");
  return (
    <section>
      <div className="mb-2 flex items-center gap-3">
        <h4 className="font-mono text-xs font-semibold text-muted">{f.file}</h4>
        {f.schemaErrors && (
          <span className={`text-xs ${f.schemaErrors.length ? "text-red-700" : "text-emerald-700"}`}>
            {f.schemaErrors.length ? `✗ ${f.schemaErrors.length} schema error(s)` : "✓ valid"}
          </span>
        )}
        {f.previous !== null && (
          <label className="ml-auto flex items-center gap-1 text-xs text-muted">
            <input type="checkbox" checked={showChanges} onChange={(e) => setShowChanges(e.target.checked)} />
            Show changes since previous version
          </label>
        )}
      </div>
      {f.schemaErrors?.length ? (
        <ul className="mb-2 list-disc pl-5 text-xs text-red-700">
          {f.schemaErrors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
      {showChanges && f.previous !== null ? (
        <RevisionDiff before={f.previous} after={f.content ?? ""} />
      ) : isJson ? (
        <pre className="overflow-auto rounded-control bg-code p-3 text-xs text-code-ink">{pretty(f.content ?? "")}</pre>
      ) : (
        <article className="prose prose-sm prose-gray max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{f.content ?? ""}</ReactMarkdown>
        </article>
      )}
    </section>
  );
}

function RevisionDiff({ before, after }: { before: string; after: string }) {
  const parts = diffLines(before, after);
  return (
    <pre className="overflow-auto rounded-control border border-line bg-surface p-3 text-xs leading-relaxed">
      {parts.map((p, i) => (
        <span key={i} className={p.added ? "block bg-emerald-50 text-emerald-800" : p.removed ? "block bg-red-50 text-red-800 line-through" : "block text-muted"}>
          {p.value}
        </span>
      ))}
    </pre>
  );
}

export function RawView({ files }: StageViewProps) {
  return (
    <div className="space-y-4">
      {files.filter((f) => f.exists).map((f) => (
        <div key={f.file}>
          <h4 className="mb-1 font-mono text-xs font-semibold text-muted">{f.file}</h4>
          <pre className="overflow-auto rounded-control bg-code p-3 text-xs text-code-ink">{f.content}</pre>
        </div>
      ))}
    </div>
  );
}

export function DiffStageView(props: StageViewProps) {
  const { data, isLoading, error } = useDiff(props.issue.number, props.issue.branchExists);
  return (
    <div className="space-y-4">
      {props.files.some((f) => f.exists) && <PlanView {...props} />}
      {!props.issue.branchExists ? (
        <p className="text-sm text-muted">No branch yet.</p>
      ) : isLoading ? (
        <p className="text-sm text-muted">Loading diff…</p>
      ) : error ? (
        <p className="text-sm text-red-700">{(error as Error).message}</p>
      ) : (
        <UnifiedDiff text={data ?? ""} />
      )}
    </div>
  );
}

export function UnifiedDiff({ text }: { text: string }) {
  if (!text.trim()) return <p className="text-sm text-muted">No changes against the base branch.</p>;
  const lines = text.split("\n");
  return (
    <pre className="max-h-[70vh] overflow-auto rounded-control border border-line bg-surface text-xs leading-5">
      {lines.map((l, i) => {
        const cls = l.startsWith("diff --git")
          ? "bg-subtle font-semibold text-ink mt-2"
          : l.startsWith("@@")
            ? "text-sky-700 bg-sky-50"
            : l.startsWith("+") && !l.startsWith("+++")
              ? "bg-emerald-50 text-emerald-800"
              : l.startsWith("-") && !l.startsWith("---")
                ? "bg-red-50 text-red-800"
                : "text-muted";
        return (
          <div key={i} className={`px-3 ${cls}`}>
            {l || " "}
          </div>
        );
      })}
    </pre>
  );
}

function pretty(text: string) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

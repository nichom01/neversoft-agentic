import type { ReactNode, ButtonHTMLAttributes } from "react";
import type { IssueStatus } from "@bob-pipeline/shared";

export function Button({
  variant = "default",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "primary" | "danger" | "ghost" }) {
  const styles = {
    default: "border border-line-strong bg-surface text-ink hover:bg-subtle",
    primary: "border border-brand-700 bg-brand-700 text-white hover:bg-brand-800 hover:border-brand-800",
    danger: "border border-red-300 bg-surface text-red-700 hover:bg-red-50",
    ghost: "text-muted shadow-none hover:bg-subtle hover:text-ink",
  }[variant];
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-control px-3 py-1.5 text-sm font-medium shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}

const statusStyle: Record<IssueStatus, { label: string; cls: string }> = {
  "not-started": { label: "Not started", cls: "bg-gray-100 text-gray-700" },
  ready: { label: "Ready", cls: "bg-sky-100 text-sky-800" },
  running: { label: "Processing", cls: "bg-amber-100 text-amber-800 animate-pulse" },
  review: { label: "Needs review", cls: "bg-indigo-100 text-indigo-800" },
  revise: { label: "Revising", cls: "bg-orange-100 text-orange-800" },
  failed: { label: "Failed", cls: "bg-red-100 text-red-800" },
  done: { label: "Done", cls: "bg-violet-100 text-violet-800" },
  parked: { label: "Parked", cls: "bg-gray-200 text-gray-700" },
};

export function StatusBadge({ status }: { status: IssueStatus }) {
  const s = statusStyle[status];
  return <span className={`inline-block rounded-control px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card border border-line bg-surface shadow-card ${className}`}>{children}</div>;
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div className="rounded-control border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 whitespace-pre-wrap">
      {error instanceof Error ? error.message : String(error)}
    </div>
  );
}

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return "";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function duration(from: string | null, to: string | null) {
  if (!from) return "";
  const s = Math.round(((to ? new Date(to).getTime() : Date.now()) - new Date(from).getTime()) / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

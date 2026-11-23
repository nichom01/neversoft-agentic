import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  DependencyGraph,
  IssueDetail,
  IssueSummary,
  LogLine,
  Pipeline,
  PollerStatus,
  ServerEvent,
} from "@bob-pipeline/shared";

export interface PipelineInfo {
  pipeline: Pipeline;
  labels: { name: string; color: string; description: string }[];
  repo: { owner: string; name: string; path: string; base: string };
  user: string;
  machine: string;
  warnings: string[];
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      msg = JSON.parse(text).error ?? text;
    } catch {
      /* plain text */
    }
    throw new Error(msg || res.statusText);
  }
  const type = res.headers.get("content-type") ?? "";
  return (type.includes("json") ? JSON.parse(text) : text) as T;
}

export const api = {
  get: <T,>(url: string) => request<T>("GET", url),
  post: <T,>(url: string, body: unknown = {}) => request<T>("POST", url, body),
};

export const usePipeline = () => useQuery({ queryKey: ["pipeline"], queryFn: () => api.get<PipelineInfo>("/api/pipeline"), staleTime: Infinity });
export const useIssues = () => useQuery({ queryKey: ["issues"], queryFn: () => api.get<IssueSummary[]>("/api/issues"), refetchInterval: 30_000 });
export const useIssue = (n: number) => useQuery({ queryKey: ["issue", n], queryFn: () => api.get<IssueDetail>(`/api/issues/${n}`), refetchInterval: 30_000 });
export const usePoller = () => useQuery({ queryKey: ["poller"], queryFn: () => api.get<PollerStatus>("/api/poller") });
export const useRunLogs = (runId: string | null) =>
  useQuery({ queryKey: ["logs", runId], queryFn: () => api.get<LogLine[]>(`/api/runs/${runId}/logs`), enabled: !!runId });
export const useDependencies = () =>
  useQuery({ queryKey: ["dependencies"], queryFn: () => api.get<DependencyGraph>("/api/dependencies"), refetchInterval: 60_000 });
export const useDiff = (n: number, enabled: boolean) =>
  useQuery({ queryKey: ["diff", n], queryFn: () => api.get<string>(`/api/issues/${n}/diff`), enabled });

/** Subscribe to server events and keep the query cache fresh. */
export function useServerEvents() {
  const qc = useQueryClient();
  useEffect(() => {
    const es = new EventSource("/api/events");
    let debounce: number | undefined;
    const refreshIssues = () => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        void qc.invalidateQueries({ queryKey: ["issues"] });
        void qc.invalidateQueries({ queryKey: ["issue"] });
        void qc.invalidateQueries({ queryKey: ["dependencies"] });
      }, 400);
    };
    es.onmessage = (m) => {
      const e = JSON.parse(m.data) as ServerEvent;
      if (e.type === "log") {
        qc.setQueryData<LogLine[]>(["logs", e.runId], (old) => (old ? [...old, e.line] : old));
      } else if (e.type === "poller") {
        qc.setQueryData(["poller"], e.status);
      } else {
        refreshIssues();
      }
    };
    return () => es.close();
  }, [qc]);
}

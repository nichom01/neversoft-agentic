import { Octokit } from "@octokit/rest";
import { run } from "./exec.js";
import type { LoadedConfig } from "./config.js";
import type { IssueComment } from "@bob-pipeline/shared";

/** Hidden markers the pipeline puts in comments it writes. */
export const MARK = {
  output: (stage: string, runId: string) => `<!-- bob-pipeline:output stage=${stage} run=${runId} -->`,
  claim: (stage: string, runId: string, machine: string) =>
    `<!-- bob-pipeline:claim stage=${stage} run=${runId} machine=${machine} -->`,
  feedback: (stage: string) => `<!-- bob-pipeline:feedback stage=${stage} -->`,
  status: `<!-- bob-pipeline:status -->`,
  any: /<!-- bob-pipeline:(output|claim|status)\b/,
  claimRe: /<!-- bob-pipeline:claim stage=(\S+) run=(\S+) machine=(\S+) -->/,
  outputRe: /<!-- bob-pipeline:output stage=(\S+) run=(\S+) -->/,
};

export interface Issue {
  number: number;
  id: number;
  title: string;
  body: string;
  url: string;
  author: string;
  labels: string[];
  updatedAt: string;
  isPullRequest: boolean;
}

export class GitHub {
  readonly octokit: Octokit;
  constructor(
    readonly owner: string,
    readonly repo: string,
    token: string,
    baseUrl?: string,
  ) {
    this.octokit = new Octokit({ auth: token, baseUrl, userAgent: "bob-pipeline" });
  }

  static async create(cfg: LoadedConfig): Promise<GitHub> {
    const remoteUrl = await run("git", ["-C", cfg.repoPath, "remote", "get-url", cfg.pipeline.repo.remote]);
    const parsed = parseRemote(remoteUrl);
    const owner = cfg.pipeline.repo.owner ?? parsed?.owner;
    const name = cfg.pipeline.repo.name ?? parsed?.name;
    if (!owner || !name) throw new Error(`Cannot work out owner/repo from remote "${remoteUrl}". Set repo.owner and repo.name in pipeline.yaml.`);
    const host = parsed?.host ?? "github.com";
    const baseUrl = host === "github.com" ? undefined : `https://${host}/api/v3`;
    let token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
    if (!token) {
      try {
        token = await run("gh", host === "github.com" ? ["auth", "token"] : ["auth", "token", "--hostname", host]);
      } catch {
        throw new Error("No GitHub token. Run `gh auth login` or set GITHUB_TOKEN.");
      }
    }
    return new GitHub(owner, name, token, baseUrl);
  }

  get repoRef() {
    return { owner: this.owner, repo: this.repo };
  }

  async whoami(): Promise<string> {
    const { data } = await this.octokit.users.getAuthenticated();
    return data.login;
  }

  async listOpenIssues(): Promise<Issue[]> {
    const items = await this.octokit.paginate(this.octokit.issues.listForRepo, {
      ...this.repoRef,
      state: "open",
      per_page: 100,
    });
    return items.map(toIssue).filter((i) => !i.isPullRequest);
  }

  async getIssue(n: number): Promise<Issue> {
    const { data } = await this.octokit.issues.get({ ...this.repoRef, issue_number: n });
    return toIssue(data);
  }

  async listComments(n: number): Promise<IssueComment[]> {
    const items = await this.octokit.paginate(this.octokit.issues.listComments, {
      ...this.repoRef,
      issue_number: n,
      per_page: 100,
    });
    return items.map((c) => ({
      id: c.id,
      author: c.user?.login ?? "unknown",
      body: c.body ?? "",
      createdAt: c.created_at,
    }));
  }

  async comment(n: number, body: string): Promise<number> {
    const { data } = await this.octokit.issues.createComment({ ...this.repoRef, issue_number: n, body: truncateBody(body) });
    return data.id;
  }

  async deleteComment(id: number) {
    try {
      await this.octokit.issues.deleteComment({ ...this.repoRef, comment_id: id });
    } catch (e) {
      if (!isStatus(e, 404)) throw e;
    }
  }

  async addLabels(n: number, labels: string[]) {
    if (!labels.length) return;
    await this.octokit.issues.addLabels({ ...this.repoRef, issue_number: n, labels });
  }

  async removeLabels(n: number, labels: string[], current?: string[]) {
    for (const name of labels) {
      if (current && !current.includes(name)) continue;
      try {
        await this.octokit.issues.removeLabel({ ...this.repoRef, issue_number: n, name });
      } catch (e) {
        if (!isStatus(e, 404)) throw e;
      }
    }
  }

  /** Remove then add, reading current labels first to avoid needless calls. */
  async swapLabels(n: number, remove: string[], add: string[]) {
    const current = (await this.getIssue(n)).labels;
    await this.removeLabels(n, remove.filter((l) => !add.includes(l)), current);
    await this.addLabels(n, add.filter((l) => !current.includes(l)));
  }

  async ensureLabels(labels: { name: string; color: string; description: string }[]) {
    const existing = await this.octokit.paginate(this.octokit.issues.listLabelsForRepo, { ...this.repoRef, per_page: 100 });
    const names = new Set(existing.map((l) => l.name));
    const created: string[] = [];
    for (const l of labels) {
      if (names.has(l.name)) continue;
      await this.octokit.issues.createLabel({ ...this.repoRef, ...l });
      created.push(l.name);
    }
    return created;
  }

  async findOpenPr(branch: string): Promise<{ number: number; url: string } | null> {
    const { data } = await this.octokit.pulls.list({ ...this.repoRef, state: "open", head: `${this.owner}:${branch}`, per_page: 1 });
    return data[0] ? { number: data[0].number, url: data[0].html_url } : null;
  }

  async createDraftPr(branch: string, base: string, title: string, body: string) {
    const { data } = await this.octokit.pulls.create({ ...this.repoRef, head: branch, base, title, body: truncateBody(body), draft: true });
    return { number: data.number, url: data.html_url };
  }

  async updatePrBody(pr: number, body: string) {
    await this.octokit.pulls.update({ ...this.repoRef, pull_number: pr, body: truncateBody(body) });
  }

  /**
   * Issues this one is blocked by. Returns null if the API isn't available
   * (e.g. an older GitHub Enterprise Server).
   */
  async listBlockedBy(n: number): Promise<{ number: number; title: string; state: "open" | "closed" }[] | null> {
    try {
      const { data } = await this.octokit.request("GET /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by", {
        ...this.repoRef,
        issue_number: n,
        per_page: 100,
      });
      return (data as { number: number; title: string; state: string }[]).map((i) => ({
        number: i.number,
        title: i.title,
        state: i.state === "closed" ? "closed" : "open",
      }));
    } catch (e) {
      if (isStatus(e, 404) || isStatus(e, 410) || isStatus(e, 403)) return null;
      throw e;
    }
  }

  /** GitHub issue dependencies ("blocked by"). Needs the blocking issue's id, not number. */
  async addBlockedBy(n: number, blockingIssueNumber: number) {
    const blocking = await this.getIssue(blockingIssueNumber);
    await this.octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by", {
      ...this.repoRef,
      issue_number: n,
      issue_id: blocking.id,
    });
  }
}

function toIssue(d: {
  number: number;
  id: number;
  title: string;
  body?: string | null;
  html_url: string;
  user?: { login: string } | null;
  labels: (string | { name?: string })[];
  updated_at: string;
  pull_request?: unknown;
}): Issue {
  return {
    number: d.number,
    id: d.id,
    title: d.title,
    body: d.body ?? "",
    url: d.html_url,
    author: d.user?.login ?? "unknown",
    labels: d.labels.map((l) => (typeof l === "string" ? l : l.name ?? "")).filter(Boolean),
    updatedAt: d.updated_at,
    isPullRequest: !!d.pull_request,
  };
}

export function parseRemote(url: string): { host: string; owner: string; name: string } | null {
  const m =
    url.match(/^git@([^:]+):([^/]+)\/(.+?)(?:\.git)?\/?$/) ??
    url.match(/^(?:https?|ssh|git):\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/([^/]+)\/(.+?)(?:\.git)?\/?$/);
  return m ? { host: m[1], owner: m[2], name: m[3] } : null;
}

function isStatus(e: unknown, status: number) {
  return typeof e === "object" && e !== null && "status" in e && (e as { status: number }).status === status;
}

function truncateBody(body: string, max = 65000) {
  return body.length > max ? body.slice(0, max) + "\n\n…(truncated; see the file on the branch)" : body;
}

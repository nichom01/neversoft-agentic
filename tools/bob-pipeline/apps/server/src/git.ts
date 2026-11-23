import fs from "node:fs";
import path from "node:path";
import { exec, run } from "./exec.js";
import type { LoadedConfig } from "./config.js";
import { fill } from "@bob-pipeline/shared";

/** Directory inside each worktree for pipeline inputs; never committed. */
export const SCRATCH_DIR = ".bob-pipeline";

export class Git {
  private lastFetch = 0;
  constructor(private cfg: LoadedConfig) {}

  get remote() {
    return this.cfg.pipeline.repo.remote;
  }
  get base() {
    return this.cfg.pipeline.repo.base_branch;
  }

  branchFor(issue: number) {
    return fill(this.cfg.pipeline.branch, { issue });
  }
  outputDirFor(issue: number) {
    return fill(this.cfg.pipeline.output_dir, { issue });
  }
  worktreeFor(issue: number) {
    return path.join(this.cfg.worktreesRoot, `issue-${issue}`);
  }

  private git(args: string[], cwd = this.cfg.repoPath) {
    return run("git", args, { cwd });
  }

  /** Fetch in the developer's clone, at most every `minIntervalMs`. Read-only for their working copy. */
  async fetch(minIntervalMs = 0) {
    if (Date.now() - this.lastFetch < minIntervalMs) return;
    await this.git(["fetch", "--prune", this.remote]);
    this.lastFetch = Date.now();
  }

  async remoteBranchExists(branch: string): Promise<boolean> {
    const r = await exec("git", ["rev-parse", "--verify", "--quiet", `refs/remotes/${this.remote}/${branch}`], { cwd: this.cfg.repoPath });
    return r.code === 0;
  }

  /**
   * Make sure the issue has a clean worktree on its branch, synced to the
   * remote. The worktree belongs to the pipeline: local changes are discarded.
   */
  async ensureWorktree(issue: number): Promise<string> {
    const branch = this.branchFor(issue);
    const wt = this.worktreeFor(issue);
    await this.fetch();
    await this.git(["worktree", "prune"]);
    const remoteRef = `${this.remote}/${branch}`;
    const startPoint = (await this.remoteBranchExists(branch)) ? remoteRef : `${this.remote}/${this.base}`;

    const list = parseWorktrees(await this.git(["worktree", "list", "--porcelain"]));
    const registered = list.some((w) => w.path === wt);
    // The branch may be checked out somewhere else: an old pipeline worktree
    // (e.g. worktrees_dir changed) is removed; anything else is the developer's.
    const holder = list.find((w) => w.branch === `refs/heads/${branch}` && w.path !== wt);
    if (holder) {
      if (/[\\/]issue-\d+$/.test(holder.path) && holder.path !== this.cfg.repoPath) {
        await this.git(["worktree", "remove", "--force", holder.path]);
      } else {
        throw new Error(`Branch ${branch} is checked out in ${holder.path}. Switch that checkout to another branch first.`);
      }
    }

    if (!registered) {
      fs.mkdirSync(path.dirname(wt), { recursive: true });
      if (fs.existsSync(wt)) fs.rmSync(wt, { recursive: true, force: true });
      await this.git(["worktree", "add", "--force", "-B", branch, wt, startPoint]);
    } else {
      await this.git(["checkout", "-B", branch, startPoint], wt);
      await this.git(["reset", "--hard", startPoint], wt);
      await this.git(["clean", "-fd", "-e", SCRATCH_DIR], wt);
    }
    await this.excludeScratch();
    return wt;
  }

  /** Keep the scratch dir out of commits without touching the repo's .gitignore. */
  private async excludeScratch() {
    const common = await this.git(["rev-parse", "--git-common-dir"]);
    const file = path.resolve(this.cfg.repoPath, common, "info", "exclude");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    if (!current.split("\n").includes(`/${SCRATCH_DIR}/`)) {
      fs.appendFileSync(file, `${current.endsWith("\n") || !current ? "" : "\n"}/${SCRATCH_DIR}/\n`);
    }
  }

  /** Stage, commit and push. Returns false if there was nothing to commit. */
  async commitAndPush(wt: string, paths: string[] | "all", message: string): Promise<boolean> {
    if (paths === "all") await this.git(["add", "-A"], wt);
    else {
      const existing = paths.filter((p) => fs.existsSync(path.join(wt, p)));
      if (existing.length) await this.git(["add", "-A", "--", ...existing], wt);
    }
    const staged = await exec("git", ["diff", "--cached", "--quiet"], { cwd: wt });
    if (staged.code === 0) return false;
    await this.git(["-c", "user.useConfigOnly=false", "commit", "-m", message], wt);
    await this.git(["push", "-u", this.remote, `HEAD:${this.branchFor(this.issueFromWorktree(wt))}`], wt);
    return true;
  }

  private issueFromWorktree(wt: string): number {
    const m = path.basename(wt).match(/issue-(\d+)$/);
    if (!m) throw new Error(`Not a pipeline worktree: ${wt}`);
    return Number(m[1]);
  }

  async diffAgainstBase(wt: string): Promise<string> {
    const base = `${this.remote}/${this.base}`;
    const stat = await this.git(["diff", "--stat", `${base}...HEAD`], wt);
    const r = await exec("git", ["diff", `${base}...HEAD`], { cwd: wt, maxCapture: 2 * 1024 * 1024 });
    return `${stat}\n\n${r.stdout}`;
  }

  /** Read a file from the remote branch via the developer's clone (no checkout). */
  async show(branch: string, file: string, rev?: string): Promise<string | null> {
    const ref = rev ?? `${this.remote}/${branch}`;
    const r = await exec("git", ["show", `${ref}:${file}`], { cwd: this.cfg.repoPath });
    return r.code === 0 ? r.stdout : null;
  }

  /** The content of `file` one commit before the latest change to it, for diffs. */
  async previousVersion(branch: string, file: string): Promise<string | null> {
    const r = await exec("git", ["log", "--format=%H", "-n", "2", `${this.remote}/${branch}`, "--", file], { cwd: this.cfg.repoPath });
    const shas = r.stdout.trim().split("\n").filter(Boolean);
    if (shas.length < 2) return null;
    return this.show(branch, file, shas[1]);
  }

  async branchDiff(branch: string): Promise<string> {
    if (!(await this.remoteBranchExists(branch))) return "";
    const r = await exec("git", ["diff", `${this.remote}/${this.base}...${this.remote}/${branch}`], {
      cwd: this.cfg.repoPath,
      maxCapture: 2 * 1024 * 1024,
    });
    return r.stdout;
  }
}

function parseWorktrees(porcelain: string): { path: string; branch: string | null }[] {
  return porcelain
    .split("\n\n")
    .map((block) => {
      const lines = block.split("\n");
      const p = lines.find((l) => l.startsWith("worktree "))?.slice(9);
      const b = lines.find((l) => l.startsWith("branch "))?.slice(7) ?? null;
      return p ? { path: p, branch: b } : null;
    })
    .filter((x): x is { path: string; branch: string | null } => x !== null);
}

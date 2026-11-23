import { spawn } from "node:child_process";

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface ExecOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: string;
  timeoutMs?: number;
  shell?: boolean;
  /** Called for each complete line of stdout / stderr as it arrives. */
  onLine?: (line: string, stream: "stdout" | "stderr") => void;
  /** Cap on captured output, to keep memory bounded. */
  maxCapture?: number;
}

/** Run a process, capturing output and optionally streaming it line by line. */
export function exec(cmd: string, args: string[], opts: ExecOptions = {}): Promise<ExecResult> {
  const max = opts.maxCapture ?? 4 * 1024 * 1024;
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: opts.env ?? process.env,
      shell: opts.shell ?? false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const partial = { stdout: "", stderr: "" };
    let timedOut = false;
    let timer: NodeJS.Timeout | undefined;
    if (opts.timeoutMs) {
      timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 5000).unref();
      }, opts.timeoutMs);
    }

    const handle = (stream: "stdout" | "stderr") => (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      if (stream === "stdout") {
        if (stdout.length < max) stdout += text;
      } else if (stderr.length < max) stderr += text;
      if (opts.onLine) {
        const buf = partial[stream] + text;
        const lines = buf.split(/\r?\n/);
        partial[stream] = lines.pop() ?? "";
        for (const l of lines) opts.onLine(l, stream);
      }
    };
    child.stdout.on("data", handle("stdout"));
    child.stderr.on("data", handle("stderr"));
    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (opts.onLine) {
        if (partial.stdout) opts.onLine(partial.stdout, "stdout");
        if (partial.stderr) opts.onLine(partial.stderr, "stderr");
      }
      resolve({ code: code ?? -1, stdout, stderr, timedOut });
    });
    if (opts.input !== undefined) child.stdin.end(opts.input);
    else child.stdin.end();
  });
}

/** Run and throw on non-zero exit. Returns trimmed stdout. */
export async function run(cmd: string, args: string[], opts: ExecOptions = {}): Promise<string> {
  const r = await exec(cmd, args, opts);
  if (r.code !== 0) {
    const msg = (r.stderr || r.stdout).trim().split("\n").slice(-20).join("\n");
    throw new Error(`${cmd} ${args.join(" ")} failed (exit ${r.code}): ${msg}`);
  }
  return r.stdout.trim();
}

export function tail(text: string, lines = 80): string {
  return text.trimEnd().split("\n").slice(-lines).join("\n");
}

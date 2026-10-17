import { spawnSync } from "node:child_process";
import { spawn } from "node:child_process";

/** Run a command to completion, capturing exit code and output. */
export function run(command, args = [], options = {}) {
  const res = spawnSync(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...(options.env || {}) },
    encoding: "utf8",
    timeout: options.timeoutMs || 120_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    code: res.status,
    signal: res.signal ?? null,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
    ok: res.status === 0,
    command: `${command} ${args.join(" ")}`,
  };
}

/**
 * Run a command to completion WITHOUT blocking the event loop.
 * Required when an in-process server (e.g. the mock model provider) must keep
 * serving requests while the child runs.
 */
export function runAsync(command, args = [], options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...(options.env || {}) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timer = null;
    if (options.timeoutMs) {
      timer = setTimeout(() => {
        try { child.kill("SIGKILL"); } catch {}
      }, options.timeoutMs);
    }
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (error) => {
      if (timer) clearTimeout(timer);
      resolve({ code: -1, signal: null, stdout, stderr: stderr + String(error), ok: false, command: `${command} ${args.join(" ")}` });
    });
    child.on("close", (code, signal) => {
      if (timer) clearTimeout(timer);
      resolve({ code, signal: signal ?? null, stdout, stderr, ok: code === 0, command: `${command} ${args.join(" ")}` });
    });
  });
}

/** Run a command in the background; returns a handle with kill(). */
export function spawnBackground(command, args = [], options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...(options.env || {}) },
    stdio: options.stdio || "ignore",
  });
  return child;
}

export function runNode(scriptPath, args = [], options = {}) {
  return run(process.execPath, [scriptPath, ...args], options);
}

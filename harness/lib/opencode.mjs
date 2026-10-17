// Control the real OpenCode V2 server in an isolated, per-config environment.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, openSync, readSync, closeSync, statSync } from "node:fs";
import { join } from "node:path";
import { LAB } from "./env.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Strip // and /* *​/ comments from a small JSONC document (string-aware). */
export function stripJsonComments(input) {
  let out = "";
  let inString = false;
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];
    if (inLine) {
      if (ch === "\n") {
        inLine = false;
        out += ch;
      }
      continue;
    }
    if (inBlock) {
      if (ch === "*" && next === "/") {
        inBlock = false;
        i++;
      }
      continue;
    }
    if (inString) {
      out += ch;
      if (ch === "\\") {
        out += next;
        i++;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === "/" && next === "/") {
      inLine = true;
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlock = true;
      i++;
      continue;
    }
    out += ch;
  }
  return out;
}

/** Render a config template for a given config name and reports directory. */
export function renderConfig(configName, reportsDir = LAB.reports) {
  const templatePath = join(LAB.configs, configName, "opencode.jsonc");
  const raw = readFileSync(templatePath, "utf8");
  const substituted = raw.replaceAll("__REPORTS__", reportsDir);
  const parsed = JSON.parse(stripJsonComments(substituted));
  return { templatePath, config: parsed };
}

function readPortFromLog(logPath) {
  try {
    const text = readFileSync(logPath, "utf8");
    const m = text.match(/server password (\S+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * Start an isolated OpenCode server for a configuration.
 *
 * Creates a throwaway HOME/XDG/project tree under `${LAB.work}/runs/<config>`
 * so that sessions, databases and plugin state stay separate from every other
 * configuration and from the host.
 */
export async function startServer(configName, options = {}) {
  const base = options.runDir || join(LAB.work, "runs", configName);
  const dirs = {
    home: join(base, "home"),
    xdg: join(base, "xdg"),
    project: join(base, "project"),
  };
  rmSync(base, { recursive: true, force: true });
  for (const d of [dirs.home, join(dirs.xdg, "config"), join(dirs.xdg, "data"), join(dirs.xdg, "cache"), dirs.project, join(dirs.project, ".opencode")]) {
    mkdirSync(d, { recursive: true });
  }

  const reportsDir = options.reportsDir || LAB.reports;
  // `options.config` allows suites (matrix, failure isolation, ...) to supply an
  // inline configuration without shipping it as a baked template.
  const config = options.config ?? renderConfig(configName, reportsDir).config;
  writeFileSync(join(dirs.project, "opencode.json"), JSON.stringify(config, null, 2));
  writeFileSync(join(dirs.project, "AGENTS.md"), "# Lab project\n\nDisposable OpenCode project for the plugin lab.\n");

  const env = {
    HOME: dirs.home,
    XDG_CONFIG_HOME: join(dirs.xdg, "config"),
    XDG_DATA_HOME: join(dirs.xdg, "data"),
    XDG_CACHE_HOME: join(dirs.xdg, "cache"),
    OPENCODE_DISABLE_AUTOUPDATE: "1",
    CI: "1",
    PATH: process.env.PATH,
    ...(options.env || {}),
  };

  const logPath = join(base, "server.log");
  const logFd = openSync(logPath, "w");
  const preferred = options.port || 47000 + Math.floor(Math.random() * 800);
  let child = null;
  let port = preferred;

  for (let attempt = 0; attempt < 6; attempt++) {
    port = preferred + attempt;
    child = spawn("opencode", ["serve", "--hostname", "127.0.0.1", "--port", String(port), "--print-logs"], {
      cwd: dirs.project,
      env,
      stdio: ["ignore", logFd, logFd],
    });
    let password = null;
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) break;
      password = readPortFromLog(logPath);
      if (password) break;
      await sleep(250);
    }
    if (password) {
      const handle = makeHandle({ configName, child, port, password, dirs, logPath, env });
      const ready = await handle.waitForPlugins(options.readyTimeoutMs || 45_000);
      if (ready.ok) return handle;
      // If the port was the problem, retry; otherwise return the (failed) handle.
      const text = handle.readLog();
      if (/Is port .* in use/i.test(text)) {
        try { child.kill("SIGKILL"); } catch {}
        continue;
      }
      return handle;
    }
    const text = existsSync(logPath) ? readFileSync(logPath, "utf8") : "";
    try { child.kill("SIGKILL"); } catch {}
    if (!/Is port .* in use/i.test(text)) break;
  }

  closeSync(logFd);
  throw new Error(`could not start OpenCode server for config ${configName} (last port ${port})`);
}

function makeHandle({ configName, child, port, password, dirs, logPath, env }) {
  const base = `http://127.0.0.1:${port}`;
  const auth = "Basic " + Buffer.from(`opencode:${password}`).toString("base64");

  async function api(method, path, body) {
    const headers = { Authorization: auth };
    if (body !== undefined) headers["content-type"] = "application/json";
    const res = await fetch(base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    return { status: res.status, ok: res.ok, json, text };
  }

  function readLog() {
    try {
      return readFileSync(logPath, "utf8");
    } catch {
      return "";
    }
  }

  async function waitForPlugins(timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    let last = null;
    while (Date.now() < deadline) {
      try {
        const res = await api("GET", "/api/plugin");
        if (res.ok && res.json && Array.isArray(res.json.data) && res.json.data.length > 0) {
          return { ok: true, plugins: res.json.data };
        }
        last = res;
      } catch (error) {
        last = { error: String(error) };
      }
      await sleep(400);
    }
    return { ok: false, last };
  }

  async function stop() {
    if (child.exitCode !== null) return { alreadyExited: true, code: child.exitCode };
    child.kill("SIGTERM");
    const deadline = Date.now() + 12_000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) break;
      await sleep(150);
    }
    if (child.exitCode === null) {
      child.kill("SIGKILL");
      await sleep(300);
    }
    return { code: child.exitCode, signal: child.signalCode ?? null };
  }

  return { configName, port, password, dirs, logPath, env, api, readLog, waitForPlugins, stop, proc: child, baseUrl: base, pkg: { children: null } };
}

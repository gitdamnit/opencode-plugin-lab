// Shared paths, plugin registry and per-config expectations for the harness.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const LAB = {
  root: process.env.LAB_RUNTIME_ROOT || "/lab",
  reports: process.env.LAB_REPORTS_DIR || "/lab/reports",
  work: process.env.LAB_WORK_DIR || "/lab/work",
  plugins: process.env.LAB_PLUGINS_DIR || "/opt/lab/plugins",
  configs: process.env.LAB_CONFIGS_DIR || "/opt/lab/configs",
  fixtures: process.env.LAB_FIXTURES_DIR || "/opt/lab/fixtures",
  harness: process.env.LAB_HARNESS_DIR || "/opt/lab/harness",
  docs: "/opt/lab/docs",
};

/** Staged plugin identity + the runtime expectations for each plugin. */
export const PLUGINS = {
  "checkpoint-orchestrator": {
    id: "gitdamnit.checkpoint-orchestrator",
    tools: [
      "checkpoint_save",
      "checkpoint_load",
      "checkpoint_status",
      "checkpoint_clear",
      "checkpoint_list",
      "checkpoint_load_snapshot",
      "checkpoint_restore_snapshot",
      "checkpoint_migrate",
    ],
    entry: "checkpoint-orchestrator.js",
  },
  "git-that-shit": {
    id: "gitdamnit.git-that-shit",
    tools: [
      "gts_status",
      "gts_list",
      "gts_diff",
      "gts_restore",
      "gts_snapshot",
      "gts_prune",
      "gts_config",
      "gts_doctor",
    ],
    entry: "index.js",
  },
  "stranger-danger": {
    id: "gitdamnit.stranger-danger",
    tools: ["sd_status", "sd_audit", "sd_allowlist_add", "sd_allowlist_show", "sd_scan"],
    entry: "plugin/index.js",
  },
};

export const ALL_PLUGIN_NAMES = Object.keys(PLUGINS);

/** The five required configurations. */
export const CONFIGS = {
  baseline: { name: "baseline", plugins: [], expect: [] },
  "checkpoint-orchestrator": { name: "checkpoint-orchestrator", plugins: ["checkpoint-orchestrator"], expect: ["checkpoint-orchestrator"] },
  "git-that-shit": { name: "git-that-shit", plugins: ["git-that-shit"], expect: ["git-that-shit"] },
  "stranger-danger": { name: "stranger-danger", plugins: ["stranger-danger"], expect: ["stranger-danger"] },
  all: { name: "all", plugins: ALL_PLUGIN_NAMES, expect: ALL_PLUGIN_NAMES },
};

export function configList() {
  return Object.keys(CONFIGS);
}

/** Read the provenance manifest baked next to a staged plugin. */
export function pluginSourceInfo(name) {
  const pkgDir = join(LAB.plugins, name);
  const info = { name, packageDir: pkgDir, version: null, commit: null, branch: null, dirty: null, sourcePath: null, built: existsSync(pkgDir) };
  try {
    const up = JSON.parse(readFileSync(join(pkgDir, "upstream-package.json"), "utf8"));
    info.version = up.version ?? null;
    info.packageName = up.name ?? null;
  } catch {}
  try {
    const src = JSON.parse(readFileSync(join(pkgDir, "LAB_SOURCE.json"), "utf8"));
    info.commit = src.commit ?? null;
    info.branch = src.branch ?? null;
    info.dirty = src.dirty ?? null;
    info.sourcePath = src.sourcePath ?? null;
  } catch {}
  return info;
}

export function ensureDirSync(fs, dir) {
  fs.mkdirSync(dir, { recursive: true });
}

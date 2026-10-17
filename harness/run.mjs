#!/usr/bin/env node
// OpenCode Plugin Lab — test orchestrator (generic, manifest-driven).
//
// Usage:
//   node run.mjs [--config <name|all>] [--tier <smoke|functional|model|integration|security|validate|all>]
//                [--all] [--online] [--run-id <id>] [--list]
//
//   --all      run every configuration declared by the manifest
//   --list     print the manifest's configurations/plugins and exit
//   --online   additionally run the optional online model-request suite
//   --run-id   stable identifier for this run (default: UTC timestamp)
//
// Per-configuration tiers exercise runtime loading, lifecycle and the offline
// model path. Configuration-independent ("global") suites — package inspection,
// load-order permutations, failure isolation, process cleanup, install-from-
// artifact and configuration validation — run once per invocation, together with
// any extension suites the manifest declares.
import { existsSync, mkdirSync, readdirSync, copyFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIGS, DEFAULT_CONFIG, GLOBAL_SUITES, LAB, PLUGIN_SUITES, manifestSummary } from "./lib/env.mjs";
import { buildReport, collectEnvironment, renderMarkdown } from "./lib/report.mjs";

const GENERIC_GLOBAL = {
  "package-inspection": "./tests/package-inspection.mjs",
  "load-order": "./tests/load-order.mjs",
  "failure-isolation": "./tests/failure-isolation.mjs",
  "process-cleanup": "./tests/process-cleanup.mjs",
  "install-artifact": "./tests/install-artifact.mjs",
  "config-validation": "./tests/config-validation.mjs",
};

const TIER_PRESETS = {
  smoke: { per: ["runtime"], global: ["package-inspection"] },
  runtime: { per: ["runtime"], global: [] },
  functional: { per: ["runtime"], global: ["package-inspection"] },
  model: { per: ["model"], global: [] },
  integration: { per: ["runtime"], global: ["load-order", "package-inspection"] },
  security: { per: [], global: ["config-validation"] },
  validate: {
    per: ["runtime", "model"],
    global: ["package-inspection", "load-order", "failure-isolation", "process-cleanup", "install-artifact", "config-validation"],
  },
  all: {
    per: ["runtime", "model"],
    global: ["package-inspection", "load-order", "failure-isolation", "process-cleanup", "install-artifact", "config-validation"],
  },
};

function parseArgs(argv) {
  const out = { config: null, tier: "all", all: false, online: false, list: false, runId: null, suite: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--config") out.config = argv[++i];
    else if (a === "--tier") out.tier = argv[++i];
    else if (a === "--all") out.all = true;
    else if (a === "--online") out.online = true;
    else if (a === "--list") out.list = true;
    else if (a === "--run-id") out.runId = argv[++i];
    else if (a === "--suite") out.suite = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

async function loadRun(rel, base = import.meta.url) {
  const mod = await import(new URL(rel, base).href);
  return mod.run || mod.run_;
}

async function runConfig(configName, preset, options) {
  const suites = [];
  if (preset.per.includes("runtime")) {
    const runLoad = await loadRun("./tests/runtime-load.mjs");
    suites.push(await runLoad({ config: configName, tier: options.tier }));
  }
  if (preset.per.includes("model")) {
    const runModel = await loadRun("./tests/model-path.mjs");
    suites.push(await runModel({ config: configName, tier: options.tier }));
  }
  if (options.online) {
    const runOnline = await loadRun("./tests/online.mjs");
    suites.push(await runOnline({ config: configName, tier: "online" }));
  }
  return suites;
}

async function runGlobal(names, options) {
  const suites = [];
  for (const name of names) {
    console.log(`\n================ suite: ${name} (global) ================`);
    const runFn = await loadRun(GENERIC_GLOBAL[name]);
    suites.push(await runFn({ tier: options.tier }));
  }
  return suites;
}

async function runExtensions(list, label, options) {
  const suites = [];
  for (const entry of list) {
    console.log(`\n================ suite: ${entry.name} (${label}) ================`);
    const runFn = await loadRun(entry.module, "file:///");
    suites.push(await runFn({ tier: options.tier, plugin: entry.plugin, name: entry.name }));
  }
  return suites;
}

function archiveRun(runDir) {
  try {
    for (const f of readdirSync(LAB.reports)) {
      if (!f.endsWith(".json") && !f.endsWith(".jsonl") && !f.endsWith(".md")) continue;
      if (f === "test-report.json" || f === "test-report.md") continue;
      const src = join(LAB.reports, f);
      copyFileSync(src, join(runDir, f));
    }
  } catch {}
}

async function main() {
  const args = parseArgs(process.argv);
  const summary = manifestSummary();
  if (args.help) {
    console.log("Usage: node run.mjs [--config <name|all>] [--tier <smoke|functional|model|integration|security|validate|all>] [--all] [--online] [--suite <name>] [--list] [--run-id ID]");
    return;
  }
  if (args.list) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  mkdirSync(LAB.reports, { recursive: true });
  const runId = args.runId || new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = join(LAB.reports, "runs", runId);
  mkdirSync(runDir, { recursive: true });
  process.env.LAB_RUN_ID = runId;

  console.log("================ manifest ================");
  console.log(`name:    ${summary.name}`);
  console.log(`path:    ${summary.path}`);
  console.log(`digest:  ${summary.digest.slice(0, 16)}…`);
  console.log(`plugins: ${summary.plugins.join(", ") || "(none)"}`);
  console.log(`configs: ${summary.configs.join(", ")}`);
  console.log(`run id:  ${runId}`);

  const configs = args.all ? Object.keys(CONFIGS) : [args.config || DEFAULT_CONFIG];
  for (const c of configs) {
    if (!CONFIGS[c]) {
      console.error(`unknown configuration "${c}" (known: ${Object.keys(CONFIGS).join(", ")})`);
      process.exit(2);
    }
    const p = join(LAB.reports, `runtime-${c}.json`);
    if (existsSync(p)) rmSync(p, { force: true });
  }

  const preset = TIER_PRESETS[args.tier] || TIER_PRESETS.all;
  const startedAt = new Date().toISOString();
  const allSuites = [];

  if (args.suite) {
    if (!GENERIC_GLOBAL[args.suite]) {
      console.error(`unknown suite "${args.suite}" (known: ${Object.keys(GENERIC_GLOBAL).join(", ")})`);
      process.exit(2);
    }
    allSuites.push(...(await runGlobal([args.suite], args)));
  } else {
    for (const configName of configs) {
      console.log(`\n================ config: ${configName} (tier: ${args.tier}) ================`);
      allSuites.push(...(await runConfig(configName, preset, args)));
    }
    allSuites.push(...(await runGlobal(preset.global, args)));
    if (args.tier === "validate" || args.tier === "all") {
      allSuites.push(...(await runExtensions(GLOBAL_SUITES, "manifest suite", args)));
      allSuites.push(...(await runExtensions(PLUGIN_SUITES, "plugin suite", args)));
    }
  }

  const finishedAt = new Date().toISOString();
  const environment = collectEnvironment(args, { runId, summary });
  const report = buildReport({ environment, suites: allSuites, startedAt, finishedAt });
  const json = JSON.stringify(report, null, 2);
  const md = renderMarkdown(report);
  writeFileSync(join(runDir, "test-report.json"), json);
  writeFileSync(join(runDir, "test-report.md"), md);
  // Convenience latest-pointer at the reports root (never a substitute for the archive).
  writeFileSync(join(LAB.reports, "test-report.json"), json);
  writeFileSync(join(LAB.reports, "test-report.md"), md);
  archiveRun(runDir);

  const c = report.summary.counts;
  console.log(`\n================ summary ================`);
  console.log(`pass=${c.pass || 0} fail=${c.fail || 0} skipped=${c.skipped || 0} total=${report.summary.total}`);
  console.log(`run:    ${runDir}`);
  console.log(`report: ${join(runDir, "test-report.json")}`);
  console.log(`report: ${join(runDir, "test-report.md")}`);

  process.exitCode = (c.fail || 0) > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 2;
});

#!/usr/bin/env node
// OpenCode Plugin Lab — test orchestrator.
//
// Usage:
//   node run.mjs --config <baseline|checkpoint-orchestrator|git-that-shit|stranger-danger|all>
//                --tier   <smoke|functional|model|integration|security|validate|all>
//                [--all] [--online]
//
//   --all     run every configuration in sequence
//   --online  additionally run the optional online model-request suite
//
// Per-configuration tiers exercise runtime loading, functional behavior, the
// offline model path and combined compatibility. "Global" suites (compatibility
// matrix, security, concurrency, failure isolation) are configuration-independent
// and run once.
import { existsSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CONFIGS, LAB } from "./lib/env.mjs";
import { buildReport, collectEnvironment, renderMarkdown } from "./lib/report.mjs";

function parseArgs(argv) {
  const out = { config: "all", tier: "all", all: false, online: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--config") out.config = argv[++i];
    else if (a === "--tier") out.tier = argv[++i];
    else if (a === "--all") out.all = true;
    else if (a === "--online") out.online = true;
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

const GLOBAL_ALL = ["matrix", "security", "concurrency", "failure-isolation", "checkpoint-triggers"];

const TIER_PRESETS = {
  smoke: { per: ["runtime"], global: [] },
  runtime: { per: ["runtime"], global: [] },
  functional: { per: ["runtime", "functional"], global: [] },
  model: { per: ["model"], global: [] },
  integration: { per: ["runtime", "combined"], global: [] },
  security: { per: [], global: ["security"] },
  validate: { per: ["runtime", "functional", "model", "combined"], global: GLOBAL_ALL },
  all: { per: ["runtime", "functional", "model", "combined"], global: GLOBAL_ALL },
};

const GLOBAL_SUITES = {
  matrix: "./tests/matrix.mjs",
  security: "./tests/security.mjs",
  concurrency: "./tests/concurrency.mjs",
  "failure-isolation": "./tests/failure-isolation.mjs",
  "checkpoint-triggers": "./tests/checkpoint-triggers.mjs",
};

const FUNCTIONAL_BY_CONFIG = {
  "checkpoint-orchestrator": "./tests/functional-checkpoint.mjs",
  "git-that-shit": "./tests/functional-git-that-shit.mjs",
  "stranger-danger": "./tests/functional-stranger-danger.mjs",
};

async function loadRun(rel) {
  const mod = await import(new URL(rel, import.meta.url).href);
  return mod.run || mod.run_;
}

async function runConfig(configName, preset, options) {
  const suites = [];
  if (preset.per.includes("runtime")) {
    const runLoad = await loadRun("./tests/runtime-load.mjs");
    suites.push(await runLoad({ config: configName, tier: options.tier }));
  }
  if (preset.per.includes("functional")) {
    const targets = configName === "all" ? Object.keys(FUNCTIONAL_BY_CONFIG) : FUNCTIONAL_BY_CONFIG[configName] ? [configName] : [];
    for (const target of targets) {
      const runFn = await loadRun(FUNCTIONAL_BY_CONFIG[target]);
      suites.push(await runFn({ tier: options.tier }));
    }
  }
  if (preset.per.includes("model")) {
    const runModel = await loadRun("./tests/model-path.mjs");
    suites.push(await runModel({ config: configName, tier: options.tier }));
  }
  if (preset.per.includes("combined") && configName === "all") {
    const runCombined = await loadRun("./tests/combined.mjs");
    suites.push(await runCombined({ tier: options.tier }));
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
    const runFn = await loadRun(GLOBAL_SUITES[name]);
    suites.push(await runFn({ tier: options.tier }));
  }
  return suites;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log("Usage: node run.mjs --config <name|all> --tier <smoke|functional|model|integration|security|validate|all> [--all] [--online]");
    return;
  }

  mkdirSync(LAB.reports, { recursive: true });
  const configs = args.all ? Object.keys(CONFIGS) : [args.config];
  for (const c of configs) {
    const p = join(LAB.reports, `runtime-${c}.json`);
    if (existsSync(p)) rmSync(p, { force: true });
  }

  const preset = TIER_PRESETS[args.tier] || TIER_PRESETS.all;
  const startedAt = new Date().toISOString();
  const allSuites = [];

  for (const configName of configs) {
    console.log(`\n================ config: ${configName} (tier: ${args.tier}) ================`);
    allSuites.push(...(await runConfig(configName, preset, args)));
  }
  allSuites.push(...(await runGlobal(preset.global, args)));

  const finishedAt = new Date().toISOString();
  const environment = collectEnvironment(args);
  const report = buildReport({ environment, suites: allSuites, startedAt, finishedAt });
  const jsonPath = join(LAB.reports, "test-report.json");
  const mdPath = join(LAB.reports, "test-report.md");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  writeFileSync(mdPath, renderMarkdown(report));
  const stamp = finishedAt.replace(/[:.]/g, "-");
  try {
    writeFileSync(join(LAB.reports, `test-report-${stamp}.json`), JSON.stringify(report, null, 2));
  } catch {}

  const c = report.summary.counts;
  console.log(`\n================ summary ================`);
  console.log(`pass=${c.pass || 0} fail=${c.fail || 0} skipped=${c.skipped || 0} total=${report.summary.total}`);
  console.log(`report: ${jsonPath}`);
  console.log(`report: ${mdPath}`);

  process.exitCode = (c.fail || 0) > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 2;
});

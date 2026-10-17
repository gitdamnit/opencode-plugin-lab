#!/usr/bin/env node
// Host-side manifest CLI.
//
// One implementation of manifest loading/validation, shared by the staging,
// discovery, build and validation scripts so they never diverge.
//
// Commands:
//   validate [--manifest PATH] [--json]   Validate the manifest (exit 1 on error)
//   plan     [--manifest PATH]            Emit the resolved build plan as JSON
//   discover [--manifest PATH] [--json]   Show each plugin's source/branch/SHA/version
//   configs  [--manifest PATH] [--json]   Show the configurations and their plugins
//
// No third-party dependencies. Safe to run on a bare host.
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPlan, loadManifest, ManifestError } from "../harness/lib/manifest.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");

function parseArgs(argv) {
  const out = { command: argv[2] || "validate", manifest: null, json: false };
  for (let i = 3; i < argv.length; i++) {
    if (argv[i] === "--manifest") out.manifest = argv[++i];
    else if (argv[i] === "--json") out.json = true;
  }
  return out;
}

function manifestPath(arg) {
  if (arg) return resolve(arg);
  if (process.env.LAB_MANIFEST) return resolve(process.env.LAB_MANIFEST);
  return resolve(REPO_ROOT, "lab.config.json");
}

function gitInfo(dir) {
  return {};
}

function pkgVersion(dir) {
  return null;
}

function loadOrDie(path) {
  try {
    return loadManifest(path, { strict: true });
  } catch (error) {
    if (error instanceof ManifestError) {
      console.error(`[lab-manifest] ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}

function cmdValidate(args) {
  const path = manifestPath(args.manifest);
  const { manifest, manifestDir, errors, warnings } = loadManifest(path, { strict: false });
  const result = { manifest: path, valid: errors.length === 0, errors, warnings };
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`manifest: ${path}`);
    for (const w of warnings) console.log(`  warning: ${w}`);
    for (const e of errors) console.log(`  error:   ${e}`);
    console.log(result.valid ? "OK: manifest is valid" : "INVALID: manifest has errors");
  }
  process.exit(result.valid ? 0 : 1);
}

function cmdPlan(args) {
  const path = manifestPath(args.manifest);
  const { manifest, manifestDir } = loadOrDie(path);
  const plan = {
    manifestPath: path,
    manifestDir,
    opencode: manifest.opencode || {},
    plugins: buildPlan(manifest, manifestDir),
  };
  console.log(JSON.stringify(plan, null, 2));
}

function cmdDiscover(args) {
  const path = manifestPath(args.manifest);
  const { manifest, manifestDir } = loadOrDie(path);
  const rows = buildPlan(manifest, manifestDir).map((p) => ({
    name: p.name,
    version: p.provenance.version,
    commit: p.provenance.commit ? p.provenance.commit.slice(0, 10) : null,
    branch: p.provenance.branch,
    dirty: p.provenance.dirty,
    sourceType: p.source.type,
    source: p.source.path || p.source.ref,
    exists: p.source.path ? existsSync(p.source.path) : true,
  }));
  if (args.json) console.log(JSON.stringify({ manifest: path, plugins: rows }, null, 2));
  else {
    console.log(`manifest: ${path}\n`);
    console.log(["PLUGIN", "VERSION", "COMMIT", "DIRTY", "TYPE", "SOURCE"].join("\t"));
    for (const r of rows) {
      console.log([r.name, r.version ?? "?", r.commit ?? "-", r.dirty === null ? "-" : r.dirty ? "yes" : "no", r.sourceType, `${r.source}${r.exists ? "" : "  [MISSING]"}`].join("\t"));
    }
  }
}

function cmdConfigs(args) {
  const path = manifestPath(args.manifest);
  const { manifest } = loadOrDie(path);
  const configs = (manifest.configs || []).map((c) => ({ name: c.name, plugins: c.plugins || [], template: c.template || null, description: c.description || null }));
  if (args.json) console.log(JSON.stringify({ manifest: path, defaultConfig: manifest.defaultConfig ?? configs[0]?.name, configs }, null, 2));
  else {
    console.log(`manifest: ${path}`);
    console.log(`default:  ${manifest.defaultConfig ?? configs[0]?.name}`);
    for (const c of configs) console.log(`  ${c.name.padEnd(24)} ${c.plugins.length ? c.plugins.join(", ") : "(no plugins)"}`);
  }
}

function cmdVersions(args) {
  const path = manifestPath(args.manifest);
  const { manifest } = loadOrDie(path);
  const oc = manifest.opencode || {};
  const version = process.env.OPENCODE_VERSION || oc.version || "2.0.21";
  const sdk = process.env.PLUGIN_SDK_VERSION || oc.sdkVersion || version;
  // Emit shell assignment lines for `eval` in the build scripts.
  console.log(`OPENCODE_VERSION=${version}`);
  console.log(`PLUGIN_SDK_VERSION=${sdk}`);
}

const args = parseArgs(process.argv);
switch (args.command) {
  case "validate": cmdValidate(args); break;
  case "plan": cmdPlan(args); break;
  case "discover": cmdDiscover(args); break;
  case "configs": cmdConfigs(args); break;
  case "versions": cmdVersions(args); break;
  case "help":
  case "--help":
  case "-h":
    console.log("usage: lab-manifest.mjs <validate|plan|discover|configs> [--manifest PATH] [--json]");
    break;
  default:
    console.error(`unknown command: ${args.command}`);
    process.exit(2);
}

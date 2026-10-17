#!/usr/bin/env node
// Build the staged plugins into self-contained lab packages.
//
// Driven entirely by the build plan produced by scripts/stage.sh
// (staging/_build/plan.json). For each plugin it:
//
//   * installs dependencies (npm ci when a lockfile is present, else npm install),
//     with lifecycle scripts disabled unless the manifest opts in,
//   * runs the manifest's build command (or the package's own `build` script),
//   * assembles /out/plugins/<name>/ as a self-contained package OpenCode can
//     load from an absolute directory.
//
// Two shapes are supported:
//   compiled : index.ts shim -> ./dist/<entry>, with dist/ copied from the build
//   rootEntry: the staged package is used as-is (no build, entry at the root)
//
// A plugin that fails to build fails the image build loudly rather than shipping
// a stale artifact.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const STAGED = "/src/staged";
const OUT = "/out/plugins";
const SDK = process.env.PLUGIN_SDK_VERSION || "2.0.21";
const PLAN = join(STAGED, "_build", "plan.json");
const INSPECTOR_SRC = "/src/inspector";

function log(msg) {
  console.log(`\n──────── ${msg} ────────`);
}

function fatal(msg) {
  console.error(`FATAL: ${msg}`);
  process.exit(1);
}

function sh(cmd, args, cwd) {
  console.log(`  $ ${cmd} ${args.join(" ")}${cwd ? `  (in ${cwd})` : ""}`);
  return execFileSync(cmd, args, { cwd, stdio: "inherit" });
}

function readJson(path, fallback = null) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

if (!existsSync(PLAN)) fatal(`missing build plan ${PLAN} (run scripts/stage.sh first)`);
const plan = JSON.parse(readFileSync(PLAN, "utf8"));

mkdirSync(OUT, { recursive: true });

function installArgs(stagedSrc, scripts) {
  const hasLock = existsSync(join(stagedSrc, "package-lock.json")) || existsSync(join(stagedSrc, "npm-shrinkwrap.json"));
  const base = hasLock ? ["ci"] : ["install"];
  const args = [...base, "--no-audit", "--no-fund"];
  if (!scripts) args.push("--ignore-scripts");
  return args;
}

function writeLabPackage(pkgDir, name, { main, upstreamPkg }) {
  const labPkg = {
    name: `@opencode-lab/${name}`,
    version: "0.0.0-lab",
    private: true,
    type: "module",
    main,
    license: upstreamPkg?.license ?? "UNLICENSED",
    dependencies: { "@opencode/plugin": SDK },
  };
  writeFileSync(join(pkgDir, "package.json"), JSON.stringify(labPkg, null, 2) + "\n");
  if (upstreamPkg) writeFileSync(join(pkgDir, "upstream-package.json"), JSON.stringify(upstreamPkg, null, 2) + "\n");
}

function installSdk(pkgDir) {
  sh("npm", ["install", "--no-audit", "--no-fund", "--ignore-scripts"], pkgDir);
}

function buildPlugin(entry) {
  const { name } = entry;
  const stagedSrc = join(STAGED, name);
  const build = entry.build || {};
  const rootEntry = build.rootEntry === true;
  const dist = build.dist || "dist";
  const entryFile = build.entry || "index.js";
  const scripts = (entry.install || {}).scripts === true;

  log(`plugin: ${name} (${rootEntry ? "prebuilt root entry" : "compiled"})`);
  if (!existsSync(stagedSrc)) fatal(`missing staged source for ${name} at ${stagedSrc}`);

  const upstreamPkg = readJson(join(stagedSrc, "package.json"), null);
  const declaredBuild = upstreamPkg?.scripts?.build;

  if (!rootEntry) {
    // 1. dependencies
    const installCmd = build.install;
    if (installCmd) sh("bash", ["-lc", installCmd], stagedSrc);
    else sh("npm", installArgs(stagedSrc, scripts), stagedSrc);

    // 2. build
    if (build.command) sh("bash", ["-lc", build.command], stagedSrc);
    else if (declaredBuild) sh("npm", ["run", "build"], stagedSrc);
    else fatal(`${name} has no build.command and its package.json has no "build" script; set build.rootEntry=true if it is prebuilt`);

    // 3. verify + assemble
    const produced = join(stagedSrc, dist, entryFile);
    if (!existsSync(produced)) fatal(`expected build output ${produced} was not produced`);

    const pkgDir = join(OUT, name);
    rmSync(pkgDir, { recursive: true, force: true });
    mkdirSync(pkgDir, { recursive: true });
    cpSync(join(stagedSrc, dist), join(pkgDir, "dist"), { recursive: true });
    writeFileSync(join(pkgDir, "index.ts"), `export { default } from "./dist/${entryFile}"\n`);
    writeLabPackage(pkgDir, name, { main: "index.ts", upstreamPkg });
    if (existsSync(join(stagedSrc, "LAB_SOURCE.json"))) cpSync(join(stagedSrc, "LAB_SOURCE.json"), join(pkgDir, "LAB_SOURCE.json"));
  } else {
    const pkgDir = join(OUT, name);
    rmSync(pkgDir, { recursive: true, force: true });
    mkdirSync(pkgDir, { recursive: true });
    // Copy the staged package as-is, minus VCS/installed deps metadata.
    cpSync(stagedSrc, pkgDir, {
      recursive: true,
      filter: (src) => {
        const rel = src.slice(stagedSrc.length);
        return !rel.startsWith("/.git") && !rel.startsWith("/node_modules");
      },
    });
    if (!existsSync(join(pkgDir, entryFile))) fatal(`${name}: root entry ${entryFile} not found in staged package`);
    // Overwrite with a lab-owned package.json (keeps upstream copy for provenance).
    writeLabPackage(pkgDir, name, { main: entryFile, upstreamPkg });
  }

  installSdk(join(OUT, name));
  console.log(`OK: ${join(OUT, name)}`);
}

for (const entry of plan.plugins) buildPlugin(entry);

// ---------------------------------------------------------------------------
// Lab inspector plugin — loaded last in every config to record, at runtime,
// which plugins are active and which tools were actually registered.
// ---------------------------------------------------------------------------
log("building lab inspector");
const IPKG = join(OUT, "lab-inspector");
rmSync(IPKG, { recursive: true, force: true });
mkdirSync(IPKG, { recursive: true });
cpSync(join(INSPECTOR_SRC, "index.ts"), join(IPKG, "index.ts"));
writeLabPackage(IPKG, "lab-inspector", { main: "index.ts", upstreamPkg: { name: "@opencode-lab/inspector", version: "0.0.0-lab", license: "MIT" } });
installSdk(IPKG);
console.log(`OK: ${IPKG}`);

log("built packages");
console.log(execFileSync("ls", ["-1", OUT], { encoding: "utf8" }).trim());

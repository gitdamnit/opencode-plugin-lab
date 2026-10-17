#!/usr/bin/env node
// Stage the manifest's plugin sources into ./staging for the Docker build.
//
// Safety:
//   * reads plugin sources read-only (never writes to them)
//   * excludes VCS data, installed deps, build output, images, logs and .env*
//   * aborts if a credential-like file slips through
//   * records provenance (source path, type, branch, commit, dirty) per plugin
//
// Produces staging/<name>/ and staging/_build/plan.json, which
// docker/build-plugins.mjs consumes inside the image.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPlan, loadManifest } from "../harness/lib/manifest.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STAGING = join(REPO_ROOT, "staging");

function parseArgs(argv) {
  const out = { manifest: process.env.LAB_MANIFEST || join(REPO_ROOT, "lab.config.json") };
  for (let i = 2; i < argv.length; i++) if (argv[i] === "--manifest") out.manifest = argv[++i];
  return out;
}

const EXCLUDES = {
  directory: new Set(["node_modules", ".git", ".github", "dist", "dist-test", "coverage", ".nyc_output", ".DS_Store", ".opencode"]),
  package: new Set(["node_modules", ".git", ".github", ".DS_Store"]),
};
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|ico|pdf|zip|tgz|tar|gz)$/i;

function isExcluded(relParts, type) {
  const set = EXCLUDES[type] || EXCLUDES.directory;
  for (const part of relParts) {
    if (set.has(part)) return true;
    if (part === ".env" || part.startsWith(".env.")) return true;
    if (/\.log$/i.test(part)) return true;
  }
  const last = relParts[relParts.length - 1] || "";
  if (IMAGE_EXT.test(last)) return true;
  return false;
}

function copyTree(src, dest, type) {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, {
    recursive: true,
    filter: (from) => {
      const rel = from.slice(src.length).replace(/^[/\\]/, "");
      if (!rel) return true;
      return !isExcluded(rel.split(/[/\\]/), type);
    },
  });
}

function extractTarball(tarball, dest) {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  execFileSync("tar", ["-xzf", tarball, "-C", dest, "--strip-components=1"], { stdio: "inherit" });
}

function credentialScan(dir) {
  const bad = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === ".git") continue;
        walk(full);
      } else if (/^(\.env|\.env\..*|auth\.json|credentials.*|.*\.pem|id_rsa.*)$/.test(e.name)) {
        bad.push(full);
      }
    }
  };
  walk(dir);
  return bad;
}

function stanza(entry) {
  const { name, source } = entry;
  const dest = join(STAGING, name);
  let packageVersion = null;

  if (source.type === "directory" || source.type === "package") {
    if (!existsSync(source.path)) throw new Error(`${name}: source path does not exist: ${source.path}`);
    copyTree(source.path, dest, source.type);
    try {
      packageVersion = JSON.parse(readFileSync(join(dest, "package.json"), "utf8")).version ?? null;
    } catch {}
  } else if (source.type === "tarball") {
    if (!existsSync(source.path)) throw new Error(`${name}: tarball does not exist: ${source.path}`);
    extractTarball(source.path, dest);
    try {
      packageVersion = JSON.parse(readFileSync(join(dest, "package.json"), "utf8")).version ?? null;
    } catch {}
  } else if (source.type === "npm") {
    if (!source.allowRemote) throw new Error(`${name}: npm source "${source.ref}" requires source.allowRemote=true (refusing to fetch silently)`);
    const tmp = join(STAGING, "_build");
    mkdirSync(tmp, { recursive: true });
    execFileSync("npm", ["pack", source.ref, "--pack-destination", tmp], { stdio: "inherit" });
    const tarball = readdirSync(tmp).filter((f) => f.endsWith(".tgz")).sort().pop();
    if (!tarball) throw new Error(`${name}: npm pack produced no tarball for ${source.ref}`);
    extractTarball(join(tmp, tarball), dest);
  } else {
    throw new Error(`${name}: unsupported source type "${source.type}"`);
  }

  const bad = credentialScan(dest);
  if (bad.length) throw new Error(`${name}: refusing to stage credential-like files:\n  ${bad.join("\n  ")}`);

  if (packageVersion === null) {
    try {
      packageVersion = JSON.parse(readFileSync(join(dest, "package.json"), "utf8")).version ?? null;
    } catch {}
  }

  const provenance = {
    name,
    packageVersion,
    sourceType: source.type,
    sourcePath: source.type === "npm" ? source.ref : source.path,
    branch: entry.provenance.branch,
    commit: entry.provenance.commit,
    dirty: entry.provenance.dirty,
    stagedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  };
  writeFileSync(join(dest, "LAB_SOURCE.json"), JSON.stringify(provenance, null, 2) + "\n");
  console.log(`staged ${name} <- ${provenance.sourcePath} [${provenance.sourceType}]${provenance.branch ? ` (${provenance.branch}@${String(provenance.commit).slice(0, 8)}${provenance.dirty ? " DIRTY" : ""})` : ""}`);
}

function main() {
  const args = parseArgs(process.argv);
  const { manifest, manifestDir } = loadManifest(resolve(args.manifest), { strict: true });
  const plan = buildPlan(manifest, manifestDir);
  mkdirSync(STAGING, { recursive: true });
  // Clear only plugin dirs, keep .gitkeep and _build handling.
  for (const e of readdirSync(STAGING, { withFileTypes: true })) {
    if (e.isDirectory() && e.name !== ".git") rmSync(join(STAGING, e.name), { recursive: true, force: true });
  }
  for (const entry of plan) stanza(entry);
  mkdirSync(join(STAGING, "_build"), { recursive: true });
  writeFileSync(join(STAGING, "_build", "plan.json"), JSON.stringify({ manifestPath: resolve(args.manifest), plugins: plan }, null, 2) + "\n");
  console.log(`staging complete: ${plan.length} plugin(s) -> ${STAGING}`);
}

main();

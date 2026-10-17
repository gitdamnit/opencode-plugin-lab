// Lab manifest: load, validate and resolve the declarative description of what
// this lab run stages, builds and tests.
//
// A manifest is data, not code: it names plugins, where their sources live, what
// capabilities they are expected to have, and which runtime configurations to
// exercise. Everything downstream (staging, building, config generation, the
// generic suites) is derived from it, so no plugin is a hard dependency of the
// lab itself.
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { createHash } from "node:crypto";

/** Strip // and /* *​/ comments from a JSONC document (string-aware). */
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

export function parseJsonc(text, label = "manifest") {
  const stripped = stripJsonComments(text);
  try {
    return JSON.parse(stripped);
  } catch (error) {
    throw new ManifestError(`could not parse ${label} as JSON: ${error.message}`);
  }
}

export class ManifestError extends Error {}

/**
 * Expand ${VAR}, ${VAR:-default} and a leading ~ in a path-like string.
 * Unknown variables are left as the empty string only when a default is given;
 * otherwise they are reported by validation (see unresolvedVariables).
 */
export function expandVars(value, env = process.env) {
  if (typeof value !== "string") return value;
  let out = value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g, (_, name, def) => {
    if (env[name] !== undefined && env[name] !== "") return env[name];
    if (def !== undefined) return def;
    return "";
  });
  // Expand $HOME / ~ that may appear directly or inside a default value.
  out = out.replace(/\$HOME(?=\/|$)/g, homedir());
  if (out.startsWith("~")) out = join(homedir(), out.slice(1));
  return out;
}

export function unresolvedVariables(value) {
  const found = [];
  const s = String(value);
  const re = /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g;
  let m;
  while ((m = re.exec(s))) {
    const [, name, def] = m;
    if ((process.env[name] === undefined || process.env[name] === "") && def === undefined) found.push(name);
  }
  return found;
}

/** Resolve a manifest-relative (or absolute) path. */
export function resolveManifestPath(value, manifestDir) {
  const expanded = expandVars(value);
  return isAbsolute(expanded) ? expanded : resolve(manifestDir, expanded);
}

/** Default manifest location inside the image / repo. */
export function defaultManifestPath(root) {
  return process.env.LAB_MANIFEST || join(root, "lab.config.json");
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Structural validation with actionable errors. Deliberately dependency-free so
 * it runs on a bare host and inside the container. Returns { valid, errors,
 * warnings } rather than throwing, so callers can decide what is fatal.
 */
export function validateManifest(manifest, { manifestDir = ".", knownFiles = true } = {}) {
  const errors = [];
  const warnings = [];
  const E = (msg) => errors.push(msg);
  const W = (msg) => warnings.push(msg);

  if (!isPlainObject(manifest)) {
    E("manifest must be a JSON object");
    return { valid: false, errors, warnings };
  }
  if (manifest.version !== 1) E(`manifest.version must be 1 (got ${JSON.stringify(manifest.version)})`);
  if (!Array.isArray(manifest.plugins) || manifest.plugins.length === 0) E("manifest.plugins must be a non-empty array");
  if (!Array.isArray(manifest.configs) || manifest.configs.length === 0) E("manifest.configs must be a non-empty array");
  if (errors.length) return { valid: false, errors, warnings };

  const names = new Set();
  for (const [i, p] of manifest.plugins.entries()) {
    const at = `plugins[${i}]`;
    if (!isPlainObject(p)) { E(`${at} must be an object`); continue; }
    if (!p.name || typeof p.name !== "string") E(`${at}.name is required`);
    else if (!/^[a-z0-9][a-z0-9._-]*$/.test(p.name)) E(`${at}.name "${p.name}" must match ^[a-z0-9][a-z0-9._-]*$`);
    else if (names.has(p.name)) E(`${at}.name "${p.name}" is declared more than once`);
    else names.add(p.name);

    if (!isPlainObject(p.source) || !p.source.type) {
      E(`${at}.source.type is required (directory|tarball|package|npm)`);
    } else {
      const t = p.source.type;
      if (!["directory", "tarball", "package", "npm"].includes(t)) E(`${at}.source.type "${t}" is not one of directory|tarball|package|npm`);
      if (t === "npm") {
        if (!p.source.ref) E(`${at}.source.ref is required for type npm`);
      } else if (!p.source.path) {
        E(`${at}.source.path is required for type ${t}`);
      } else {
        const vars = unresolvedVariables(p.source.path);
        if (vars.length) E(`${at}.source.path references unset variable(s): ${vars.map((v) => "${" + v + "}").join(", ")} (set them or provide a :-default)`);
        const resolved = resolveManifestPath(p.source.path, manifestDir);
        if (knownFiles && !existsSync(resolved)) {
          // A missing source is a hard error for staging but not for a manifest
          // that is only being linted; record it as a warning the caller can raise.
          W(`${at}.source.path does not exist: ${resolved}`);
        }
      }
      if (p.source.type === "npm" && p.source.allowRemote !== true) {
        W(`${at} is an npm source with allowRemote=false; it will not be fetched (this is the safe default).`);
      }
    }

    const caps = p.capabilities || {};
    if (isPlainObject(caps) && caps.network === true) {
      W(`${at} declares capabilities.network=true; it will only be exercised in the gated online tier.`);
    }
    if (Array.isArray(p.expectTools) && p.expectTools.length && isPlainObject(caps) && caps.tools === false) {
      E(`${at}: expectTools is set but capabilities.tools is false (contradiction)`);
    }
    for (const [j, t] of (p.tests || []).entries()) {
      if (typeof t !== "string") { E(`${at}.tests[${j}] must be a string path`); continue; }
      const resolved = resolveManifestPath(t, manifestDir);
      if (knownFiles && !existsSync(resolved)) E(`${at}.tests[${j}] not found: ${resolved}`);
    }
  }

  const configNames = new Set();
  for (const [i, c] of manifest.configs.entries()) {
    const at = `configs[${i}]`;
    if (!isPlainObject(c)) { E(`${at} must be an object`); continue; }
    if (!c.name || typeof c.name !== "string") E(`${at}.name is required`);
    else if (configNames.has(c.name)) E(`${at}.name "${c.name}" is declared more than once`);
    else configNames.add(c.name);
    const list = c.plugins || [];
    if (!Array.isArray(list)) E(`${at}.plugins must be an array`);
    else {
      for (const n of list) {
        if (!names.has(n)) E(`${at}.plugins references unknown plugin "${n}"`);
      }
      const dupes = list.filter((n, k) => list.indexOf(n) !== k);
      if (dupes.length) W(`${at}.plugins lists ${JSON.stringify([...new Set(dupes)])} more than once (this is a deliberate duplicate-entry test only if intended).`);
    }
    if (c.template) {
      const resolved = resolveManifestPath(c.template, manifestDir);
      if (knownFiles && !existsSync(resolved)) E(`${at}.template not found: ${resolved}`);
    }
    for (const key of Object.keys(c.options || {})) {
      if (!names.has(key)) E(`${at}.options references unknown plugin "${key}"`);
    }
  }

  if (manifest.defaultConfig && !configNames.has(manifest.defaultConfig)) {
    E(`manifest.defaultConfig "${manifest.defaultConfig}" is not one of the declared configs`);
  }

  for (const [i, s] of (manifest.globalSuites || []).entries()) {
    const at = `globalSuites[${i}]`;
    if (!isPlainObject(s)) { E(`${at} must be an object`); continue; }
    if (!s.name) E(`${at}.name is required`);
    if (!s.module) E(`${at}.module is required`);
    else {
      const resolved = resolveManifestPath(s.module, manifestDir);
      if (knownFiles && !existsSync(resolved)) E(`${at}.module not found: ${resolved}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/** Load and validate a manifest file. Throws ManifestError on fatal problems. */
export function loadManifest(path, { strict = true } = {}) {
  if (!existsSync(path)) throw new ManifestError(`manifest not found at ${path} (pass --manifest or set LAB_MANIFEST)`);
  const raw = readFileSync(path, "utf8");
  const parsed = parseJsonc(raw, path);
  const manifestDir = dirname(resolve(path));
  const { valid, errors, warnings } = validateManifest(parsed, { manifestDir });
  if (!valid && strict) {
    throw new ManifestError(`invalid manifest ${path}:\n  - ${errors.join("\n  - ")}`);
  }
  return { manifest: parsed, manifestPath: resolve(path), manifestDir, errors, warnings, raw };
}

/** Stable sha256 of the manifest bytes, for report provenance. */
export function manifestDigest(raw) {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Resolve the plugin descriptors the runtime/harness uses in-container.
 * `packageDir` is where the built package lives inside the image.
 */
export function resolvePlugins(manifest, { manifestDir, pluginsRoot = "/opt/lab/plugins" }) {
  const out = {};
  for (const p of manifest.plugins) {
    out[p.name] = {
      name: p.name,
      id: p.id ?? null,
      package: p.package ?? null,
      packageDir: join(pluginsRoot, p.name),
      source: p.source,
      build: p.build ?? {},
      options: p.options ?? {},
      capabilities: { tools: false, hooks: false, storage: false, redaction: false, network: false, ...(p.capabilities || {}) },
      tools: p.expectTools ?? [],
      install: p.install ?? {},
      setupMarker: p.setupMarker ?? null,
      cleanupMarker: p.cleanupMarker ?? null,
      expectedWrites: p.expectedWrites ?? [],
      tests: (p.tests || []).map((t) => resolveManifestPath(t, manifestDir)),
      notes: p.notes ?? null,
    };
  }
  return out;
}

/** Resolve optional configuration-independent extension suites. */
export function resolveGlobalSuites(manifest, manifestDir = ".") {
  return (manifest.globalSuites || []).map((s) => ({
    name: s.name,
    module: resolveManifestPath(s.module, manifestDir),
    tier: s.tier ?? "validate",
  }));
}

/** Git provenance for a source directory (never writes to the repo). */
export function gitProvenance(dir) {
  const info = { branch: null, commit: null, dirty: null };
  if (!dir || !existsSync(dir)) return info;
  try {
    info.branch = execFileSync("git", ["-C", dir, "rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).trim();
    info.commit = execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    info.dirty = execFileSync("git", ["-C", dir, "status", "--porcelain"], { encoding: "utf8" }).trim().length > 0;
  } catch {
    /* not a git worktree */
  }
  return info;
}

/** The `version` field of a package.json in `dir`, or null. */
export function packageVersion(dir) {
  try {
    const p = join(dir, "package.json");
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, "utf8")).version ?? null;
  } catch {
    return null;
  }
}

/** Resolve a plugin source into an absolute description, regardless of type. */
export function resolveSourceTarget(plugin, manifestDir) {
  const s = plugin.source || {};
  if (s.type === "npm") return { type: "npm", ref: s.ref, allowRemote: !!s.allowRemote, path: null };
  const path = resolveManifestPath(s.path, manifestDir);
  return { type: s.type, path, allowRemote: !!s.allowRemote, commit: s.commit ?? null };
}

/** Build the concrete plan staging/building consumes. */
export function buildPlan(manifest, manifestDir) {
  return manifest.plugins.map((p) => {
    const source = resolveSourceTarget(p, manifestDir);
    const isTree = source.type === "directory" || source.type === "package";
    const git = isTree ? gitProvenance(source.path) : { branch: null, commit: null, dirty: null };
    if (isTree && !git.commit && source.commit) git.commit = source.commit;
    return {
      name: p.name,
      package: p.package ?? null,
      id: p.id ?? null,
      source,
      build: p.build ?? {},
      install: p.install ?? {},
      capabilities: p.capabilities ?? {},
      expectTools: p.expectTools ?? [],
      tests: (p.tests || []).map((t) => resolveManifestPath(t, manifestDir)),
      provenance: { version: source.path ? packageVersion(source.path) : null, branch: git.branch, commit: git.commit, dirty: git.dirty },
    };
  });
}
export function resolveConfigs(manifest, manifestDir = ".") {
  const out = {};
  for (const c of manifest.configs) {
    out[c.name] = {
      name: c.name,
      description: c.description ?? null,
      plugins: c.plugins ?? [],
      expect: c.plugins ?? [],
      options: c.options ?? {},
      settings: c.settings ?? {},
      template: c.template ? resolveManifestPath(c.template, manifestDir) : null,
    };
  }
  return out;
}

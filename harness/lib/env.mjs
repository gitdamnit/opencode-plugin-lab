// Shared paths, and the active plugin registry + configurations, derived
// entirely from the lab manifest (lab.config.json by default). No plugin is
// hardcoded here: everything comes from the manifest that was baked into the
// image (or pointed to by LAB_MANIFEST on a host run).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { defaultManifestPath, loadManifest, manifestDigest, resolveConfigs, resolveGlobalSuites, resolvePlugins } from "./manifest.mjs";

export const LAB = {
  root: process.env.LAB_RUNTIME_ROOT || "/lab",
  reports: process.env.LAB_REPORTS_DIR || "/lab/reports",
  work: process.env.LAB_WORK_DIR || "/lab/work",
  plugins: process.env.LAB_PLUGINS_DIR || "/opt/lab/plugins",
  configs: process.env.LAB_CONFIGS_DIR || "/opt/lab/configs",
  fixtures: process.env.LAB_FIXTURES_DIR || "/opt/lab/fixtures",
  harness: process.env.LAB_HARNESS_DIR || "/opt/lab/harness",
  profiles: process.env.LAB_PROFILES_DIR || "/opt/lab/profiles",
  docs: "/opt/lab/docs",
  manifestPath: defaultManifestPath("/opt/lab"),
};

const loaded = loadManifest(LAB.manifestPath, { strict: true });
if (loaded.warnings && loaded.warnings.length) {
  for (const w of loaded.warnings) console.warn(`[lab:manifest] ${w}`);
}

export const MANIFEST = loaded.manifest;
export const MANIFEST_PATH = loaded.manifestPath;
export const MANIFEST_DIR = loaded.manifestDir;
export const MANIFEST_DIGEST = manifestDigest(loaded.raw);

/** Staged plugin identity + the runtime expectations for each plugin. */
export const PLUGINS = resolvePlugins(MANIFEST, { manifestDir: loaded.manifestDir, pluginsRoot: LAB.plugins });

export const ALL_PLUGIN_NAMES = Object.keys(PLUGINS);

/** The runtime configurations declared by the manifest. */
export const CONFIGS = resolveConfigs(MANIFEST, loaded.manifestDir);

/** Optional configuration-independent extension suites declared by the manifest. */
export const GLOBAL_SUITES = resolveGlobalSuites(MANIFEST, loaded.manifestDir);

function defaultConfigName() {
  if (MANIFEST.defaultConfig && CONFIGS[MANIFEST.defaultConfig]) return MANIFEST.defaultConfig;
  return Object.keys(CONFIGS)[0];
}

export const DEFAULT_CONFIG = defaultConfigName();

/** Plugins loaded by at least one configuration (i.e. worth building). */
export function referencedPluginNames() {
  const set = new Set();
  for (const c of Object.values(CONFIGS)) for (const n of c.plugins) set.add(n);
  return [...set];
}

export function configList() {
  return Object.keys(CONFIGS);
}

/** Configurations that load a given plugin. */
export function configsForPlugin(name) {
  return Object.values(CONFIGS).filter((c) => c.plugins.includes(name)).map((c) => c.name);
}

/** Plugin-specific extension suites declared in the manifest (run once each). */
export const PLUGIN_SUITES = Object.values(PLUGINS)
  .filter((p) => p.tests && p.tests.length)
  .flatMap((p) => p.tests.map((mod) => ({ name: `plugin:${p.name}`, plugin: p.name, module: mod })));

/** Human-readable summary of the active manifest, for logs and reports. */
export function manifestSummary() {
  return {
    name: MANIFEST.name || "lab",
    path: MANIFEST_PATH,
    digest: MANIFEST_DIGEST,
    version: MANIFEST.version,
    opencode: MANIFEST.opencode || {},
    plugins: ALL_PLUGIN_NAMES,
    configs: configList(),
    defaultConfig: DEFAULT_CONFIG,
  };
}

/** Read the provenance manifest baked next to a staged plugin. */
export function pluginSourceInfo(name) {
  const pkgDir = join(LAB.plugins, name);
  const info = { name, packageDir: pkgDir, version: null, commit: null, branch: null, dirty: null, sourcePath: null, built: existsSync(pkgDir) };
  try {
    const up = JSON.parse(readFileSync(join(pkgDir, "upstream-package.json"), "utf8"));
    info.version = up.version ?? null;
    info.packageName = up.name ?? null;
    info.license = up.license ?? null;
  } catch {}
  try {
    const src = JSON.parse(readFileSync(join(pkgDir, "LAB_SOURCE.json"), "utf8"));
    info.commit = src.commit ?? null;
    info.branch = src.branch ?? null;
    info.dirty = src.dirty ?? null;
    info.sourcePath = src.sourcePath ?? null;
    info.sourceType = src.sourceType ?? null;
  } catch {}
  try {
    const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
    info.labPackageName = pkg.name ?? null;
  } catch {}
  // Directory name of the manifest, for report provenance.
  try {
    info.manifestDir = dirname(MANIFEST_PATH);
  } catch {}
  return info;
}

export function ensureDirSync(fs, dir) {
  fs.mkdirSync(dir, { recursive: true });
}

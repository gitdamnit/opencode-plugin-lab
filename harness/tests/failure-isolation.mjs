// Generic failure isolation.
//
// Builds deliberately broken plugin packages at run time (a setup that throws,
// and an entry point that cannot resolve its import) and loads them FIRST and
// LAST alongside the manifest's plugins. The real plugins, the inspector and the
// server must remain healthy: failures are isolated per plugin.
import { existsSync, mkdirSync, writeFileSync, symlinkSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Suite, assert, assertEquals } from "../lib/suite.mjs";
import { CONFIGS, LAB, PLUGINS } from "../lib/env.mjs";
import { startServer } from "../lib/opencode.mjs";

const INSPECTOR = "/opt/lab/plugins/lab-inspector";
const SDK = process.env.LAB_SDK_VERSION || "2.0.21";

function realPlugins() {
  let best = null;
  for (const c of Object.values(CONFIGS)) if (!best || c.plugins.length > best.plugins.length) best = c;
  return (best?.plugins || []).map((n) => PLUGINS[n]).filter((p) => p && existsSync(p.packageDir));
}

function makeBrokenDir(kind) {
  const dir = join(LAB.work, "failure", `broken-${kind}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const body =
    kind === "throw"
      ? `import { Plugin } from "@opencode/plugin"\nexport default Plugin.define({ id: "lab.broken.throw", async setup() { throw new Error("intentional lab failure: setup threw") } })\n`
      : `import { Plugin } from "@opencode/plugin"\nimport "./this-module-does-not-exist.js"\nexport default Plugin.define({ id: "lab.broken.import", async setup() {} })\n`;
  writeFileSync(join(dir, "index.ts"), body);
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: `lab-broken-${kind}`, version: "0.0.0", private: true, type: "module", dependencies: { "@opencode/plugin": SDK } }));
  symlinkSync(join(INSPECTOR, "node_modules"), join(dir, "node_modules"), "dir");
  return dir;
}

function configWith(order, out) {
  return {
    $schema: "https://opencode.ai/config.json",
    update: "disable",
    plugins: [...order.map((p) => (typeof p === "string" ? { package: p, options: {} } : { package: p.packageDir, options: p.options })), { package: INSPECTOR, options: { out } }],
  };
}

async function assertIsolated(server, label, outPath, brokenPackages, real) {
  const info = await server.api("GET", "/api/info");
  assertEquals(info.status, 200, `server healthy in ${label}`);

  const res = await server.api("GET", "/api/plugin");
  const data = res.json.data || [];
  const ids = data.map((p) => p.id).filter(Boolean);
  for (const p of real) {
    const found = data.some((rec) => (rec.source && typeof rec.source === "object" && (rec.source.path || "").startsWith(p.packageDir)) || (p.id && rec.id === p.id));
    assert(found, `${p.name} still active in ${label}`);
  }

  for (const b of brokenPackages) {
    const entry = data.find((p) => p.source && (p.source.path || "").startsWith(b));
    assert(entry, `broken plugin ${b} is registered as a failure in ${label}`);
    assertEquals(entry.state && entry.state.status, "failed", `broken plugin ${b} marked failed in ${label}`);
  }

  assert(existsSync(outPath), `inspector (loaded after the broken plugin) wrote output in ${label}`);
  const rec = JSON.parse(readFileSync(outPath, "utf8"));
  const expectedTools = real.flatMap((p) => p.tools);
  const missing = expectedTools.filter((t) => !rec.tools.includes(t));
  assertEquals(missing.length, 0, `all real tools registered in ${label} (missing ${missing})`);

  const log = server.readLog();
  assert(/failed to load plugin/i.test(log), `failure recorded in server log for ${label}`);
  return { label, failed: data.filter((p) => p.state && p.state.status === "failed").length, tools: rec.tools.length, externalPlugins: ids.filter((x) => x && !x.startsWith("opencode.")).length };
}

export async function run({ tier = "validate" } = {}) {
  const suite = new Suite("failure-isolation/broken-plugin", { tier });
  const real = realPlugins();

  const throwDir = makeBrokenDir("throw");
  const importDir = makeBrokenDir("import");
  const realArgs = real.map((p) => p);

  await suite.test("failure-isolation.broken-first", async () => {
    const out = join(LAB.reports, "failure-isolation-first.json");
    const server = await startServer("failure-first", { config: configWith([throwDir, ...realArgs], out) });
    try {
      return await assertIsolated(server, "broken-first", out, [throwDir], real);
    } finally {
      await server.stop();
    }
  });

  await suite.test("failure-isolation.broken-last", async () => {
    const out = join(LAB.reports, "failure-isolation-last.json");
    const server = await startServer("failure-last", { config: configWith([...realArgs, throwDir], out) });
    try {
      return await assertIsolated(server, "broken-last", out, [throwDir], real);
    } finally {
      await server.stop();
    }
  });

  await suite.test("failure-isolation.unresolvable-import-first", async () => {
    const out = join(LAB.reports, "failure-isolation-import.json");
    const server = await startServer("failure-import", { config: configWith([importDir, ...realArgs], out) });
    try {
      return await assertIsolated(server, "unresolvable-import-first", out, [importDir], real);
    } finally {
      await server.stop();
    }
  });

  return suite.summary();
}

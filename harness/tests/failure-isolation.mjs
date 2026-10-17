// Failure isolation: one broken plugin must not take down the others.
//
// Builds deliberately broken plugin packages at run time (a setup that throws,
// and an entry point that cannot resolve) and loads them FIRST and LAST in the
// combined configuration. The three real plugins, the inspector and the server
// must remain healthy, proving failures are isolated per plugin.
import { existsSync, mkdirSync, writeFileSync, symlinkSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Suite, assert, assertEquals, assertIncludes } from "../lib/suite.mjs";
import { LAB, PLUGINS } from "../lib/env.mjs";
import { startServer } from "../lib/opencode.mjs";

const ALL = ["checkpoint-orchestrator", "git-that-shit", "stranger-danger"];
const INSPECTOR = "/opt/lab/plugins/lab-inspector";
const SDK = process.env.LAB_SDK_VERSION || "2.0.21";

function makeBrokenDir(kind) {
  const dir = join(LAB.work, "failure", `broken-${kind}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const body =
    kind === "throw"
      ? `import { Plugin } from "@opencode/plugin"\nexport default Plugin.define({ id: "lab.broken.throw", async setup() { throw new Error("intentional lab failure: setup threw") } })\n`
      : `import { Plugin } from "@opencode/plugin"\nimport "./this-module-does-not-exist.js"\nexport default Plugin.define({ id: "lab.broken.import", async setup() {} })\n`;
  writeFileSync(join(dir, "index.ts"), body);
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: `lab-broken-${kind}`, version: "0.0.0", private: true, type: "module", dependencies: { "@opencode/plugin": SDK } }),
  );
  // Reuse an existing plugin's installed SDK so the broken entry itself resolves.
  symlinkSync(join(LAB.plugins, "lab-inspector", "node_modules"), join(dir, "node_modules"), "dir");
  return dir;
}

function configWith(order, out) {
  return {
    $schema: "https://opencode.ai/config.json",
    update: "disable",
    plugins: [...order.map((p) => ({ package: p, options: {} })), { package: INSPECTOR, options: { out } }],
  };
}

async function assertIsolated(server, label, outPath, brokenPackages) {
  const info = await server.api("GET", "/api/info");
  assertEquals(info.status, 200, `server healthy in ${label}`);

  const res = await server.api("GET", "/api/plugin");
  const data = res.json.data || [];
  const ids = data.map((p) => p.id).filter(Boolean);
  for (const name of ALL) assertIncludes(ids, PLUGINS[name].id, `${name} still active in ${label}`);

  const failed = data.filter((p) => p.state && p.state.status === "failed");
  // The broken plugin(s) must be the only failures.
  for (const b of brokenPackages) {
    const entry = data.find((p) => p.source && (p.source.path || "").startsWith(b));
    assert(entry, `broken plugin ${b} is registered as a failure in ${label}`);
    assertEquals(entry.state && entry.state.status, "failed", `broken plugin ${b} marked failed in ${label}`);
  }

  assert(existsSync(outPath), `inspector (loaded after the broken plugin) wrote output in ${label}`);
  const rec = JSON.parse(readFileSync(outPath, "utf8"));
  const expectedTools = ALL.flatMap((n) => PLUGINS[n].tools);
  const missing = expectedTools.filter((t) => !rec.tools.includes(t));
  assertEquals(missing.length, 0, `all real tools registered in ${label} (missing ${missing})`);

  const log = server.readLog();
  assert(/failed to load plugin/.test(log), `failure recorded in server log for ${label}`);
  return { label, failed: failed.length, tools: rec.tools.length };
}

export async function run_({ tier = "validate" } = {}) {
  const suite = new Suite("failure-isolation/broken-plugin", { tier });
  if (!ALL.every((n) => existsSync(join(LAB.plugins, n)))) {
    suite.skip("failure-isolation", "plugins not built");
    return suite.summary();
  }

  const throwDir = makeBrokenDir("throw");
  const importDir = makeBrokenDir("import");

  await suite.test("failure-isolation.broken-first", async () => {
    const out = join(LAB.reports, "failure-isolation-first.json");
    const order = [throwDir, ...ALL.map((n) => `/opt/lab/plugins/${n}`)];
    const server = await startServer("failure-first", { config: configWith(order, out) });
    try {
      return await assertIsolated(server, "broken-first", out, [throwDir]);
    } finally {
      await server.stop();
    }
  });

  await suite.test("failure-isolation.broken-last", async () => {
    const out = join(LAB.reports, "failure-isolation-last.json");
    const order = [...ALL.map((n) => `/opt/lab/plugins/${n}`), throwDir];
    const server = await startServer("failure-last", { config: configWith(order, out) });
    try {
      return await assertIsolated(server, "broken-last", out, [throwDir]);
    } finally {
      await server.stop();
    }
  });

  await suite.test("failure-isolation.unresolvable-import-first", async () => {
    const out = join(LAB.reports, "failure-isolation-import.json");
    const order = [importDir, ...ALL.map((n) => `/opt/lab/plugins/${n}`)];
    const server = await startServer("failure-import", { config: configWith(order, out) });
    try {
      return await assertIsolated(server, "unresolvable-import-first", out, [importDir]);
    } finally {
      await server.stop();
    }
  });

  return suite.summary();
}

export const run = run_;

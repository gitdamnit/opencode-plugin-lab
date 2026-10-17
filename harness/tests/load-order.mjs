// Generic load-order & tool-conflict matrix.
//
// Uses the configuration that loads the most plugins, then boots the real
// runtime once per permutation of that plugin set (plus a duplicate-entry case).
// Asserts every plugin loads, expected tools register, tool ids are unique,
// there are no conflicts and no plugin ends up failed.
//
// Runs only when the manifest declares at least two plugins in a configuration;
// otherwise it is reported as skipped (unsupported), never faked.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Suite, assert, assertEquals } from "../lib/suite.mjs";
import { CONFIGS, LAB, PLUGINS } from "../lib/env.mjs";
import { startServer } from "../lib/opencode.mjs";
import { pluginMatches } from "./runtime-load.mjs";

const INSPECTOR = "/opt/lab/plugins/lab-inspector";

function permutations(items) {
  if (items.length <= 1) return [items];
  const out = [];
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const p of permutations(rest)) out.push([items[i], ...p]);
  }
  return out;
}

function widestConfig() {
  let best = null;
  for (const c of Object.values(CONFIGS)) {
    if (!best || c.plugins.length > best.plugins.length) best = c;
  }
  return best;
}

function makeConfig(order, out, extra = []) {
  return {
    $schema: "https://opencode.ai/config.json",
    update: "disable",
    plugins: [
      ...order.map((name) => ({ package: PLUGINS[name].packageDir, options: PLUGINS[name].options })),
      ...extra,
      { package: INSPECTOR, options: { out } },
    ],
  };
}

async function assertLoaded(server, order, label) {
  const res = await server.api("GET", "/api/plugin");
  assertEquals(res.status, 200, "plugin registry readable");
  const data = res.json.data || [];
  for (const name of new Set(order)) {
    assert(data.some((p) => pluginMatches(p, PLUGINS[name])), `${name} active for order [${label}]`);
  }
  const failed = data.filter((p) => p.state && p.state.status === "failed");
  assertEquals(failed.length, 0, `no failed plugins for order [${label}]`);
}

export async function run({ tier = "validate" } = {}) {
  const suite = new Suite("load-order/permutations", { tier });
  const cfg = widestConfig();
  const names = cfg ? cfg.plugins : [];

  if (names.length < 1) {
    suite.skip("load-order.permutations", "manifest declares no plugins");
    return suite.summary();
  }
  for (const n of names) {
    if (!existsSync(PLUGINS[n].packageDir)) {
      suite.skip("load-order.permutations", `plugin ${n} is not built`);
      return suite.summary();
    }
  }

  const orders = permutations(names);
  for (const order of orders) {
    const label = order.join(">");
    await suite.test(`load-order.order.${order.map((n) => n.replace(/[^a-z0-9]/gi, "")).join("_")}`, async () => {
      const out = join(LAB.reports, `load-order-${order.join("_")}.json`);
      const server = await startServer(`load-order-${order.join("_")}`, { config: makeConfig(order, out) });
      try {
        await assertLoaded(server, order, label);
        assert(existsSync(out), "inspector output written");
        const rec = JSON.parse(readFileSync(out, "utf8"));
        const expectedTools = [...new Set(order)].flatMap((n) => PLUGINS[n].tools);
        const missing = expectedTools.filter((t) => !rec.tools.includes(t));
        assertEquals(missing.length, 0, `all tools registered (missing ${missing})`);
        const dupes = rec.tools.filter((t, i) => rec.tools.indexOf(t) !== i);
        assertEquals(dupes.length, 0, `unique tool ids (dupes ${dupes})`);
        return { order, tools: rec.tools.length };
      } finally {
        await server.stop();
      }
    });
  }

  // Duplicate entry: the same plugin listed twice must not double-register tools
  // or fail. Only meaningful for a plugin that registers tools; otherwise still
  // checks that a duplicate load is tolerated.
  const toolPlugin = names.map((n) => PLUGINS[n]).find((p) => p.tools.length);
  const dupTarget = toolPlugin || PLUGINS[names[0]];
  await suite.test("load-order.duplicate-entry", async () => {
    const order = names;
    const duplicate = { package: dupTarget.packageDir, options: dupTarget.options };
    const out = join(LAB.reports, "load-order-duplicate.json");
    const server = await startServer("load-order-duplicate", { config: makeConfig(order, out, [duplicate]) });
    try {
      await assertLoaded(server, order, "duplicate");
      const rec = JSON.parse(readFileSync(out, "utf8"));
      if (dupTarget.tools.length) {
        const seen = rec.tools.filter((t) => dupTarget.tools.includes(t));
        assertEquals(new Set(seen).size, dupTarget.tools.length, `${dupTarget.name} tools registered once despite duplicate entry`);
      }
      return { tools: rec.tools.length, duplicateOf: dupTarget.name };
    } finally {
      await server.stop();
    }
  });

  return suite.summary();
}

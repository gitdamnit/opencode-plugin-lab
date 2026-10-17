// Compatibility matrix: plugin load/registration across installation orders.
//
// Boots the real OpenCode V2 runtime once per ordering of the three plugins
// (all 3! permutations), plus a duplicate-entry case, and asserts that every
// plugin loads, every tool registers, there are no tool-id conflicts, and no
// plugin is left in a failed state.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Suite, assert, assertEquals, assertIncludes } from "../lib/suite.mjs";
import { LAB, PLUGINS } from "../lib/env.mjs";
import { startServer } from "../lib/opencode.mjs";

const NAMES = ["checkpoint-orchestrator", "git-that-shit", "stranger-danger"];
const SHORT = { "checkpoint-orchestrator": "cp", "git-that-shit": "gts", "stranger-danger": "sd" };
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

function makeConfig(order, out, extra = []) {
  return {
    $schema: "https://opencode.ai/config.json",
    update: "disable",
    plugins: [
      ...order.map((name) => ({ package: `/opt/lab/plugins/${name}`, options: {} })),
      ...extra,
      { package: INSPECTOR, options: { out } },
    ],
  };
}

async function assertLoaded(server, order, label) {
  const res = await server.api("GET", "/api/plugin");
  assertEquals(res.status, 200, "plugin registry readable");
  const data = res.json.data || [];
  const ids = data.map((p) => p.id).filter(Boolean);
  for (const name of new Set(order)) {
    assertIncludes(ids, PLUGINS[name].id, `${name} active for order [${label}]`);
  }
  const failed = data.filter((p) => p.state && p.state.status === "failed");
  assertEquals(failed.length, 0, `no failed plugins for order [${label}]: ${JSON.stringify(failed.map((f) => f.source))}`);
}

export async function run_({ tier = "validate" } = {}) {
  const suite = new Suite("matrix/load-order", { tier });
  const available = NAMES.every((n) => existsSync(join(LAB.plugins, n)));
  if (!available) {
    suite.skip("matrix.permutations", "one or more plugins are not built");
    return suite.summary();
  }

  for (const order of permutations(NAMES)) {
    const label = order.map((n) => SHORT[n]).join(">");
    await suite.test(`matrix.order.${label}`, async () => {
      const out = join(LAB.reports, `matrix-${label.replace(/>/g, "_")}.json`);
      const server = await startServer(`matrix-${label.replace(/>/g, "_")}`, { config: makeConfig(order, out) });
      try {
        await assertLoaded(server, order, label);
        assert(existsSync(out), `inspector output written for ${label}`);
        const rec = JSON.parse(readFileSync(out, "utf8"));
        const expectedTools = [...new Set(order)].flatMap((n) => PLUGINS[n].tools);
        const missing = expectedTools.filter((t) => !rec.tools.includes(t));
        assertEquals(missing.length, 0, `all tools registered for ${label} (missing ${missing})`);
        const dupes = rec.tools.filter((t, i) => rec.tools.indexOf(t) !== i);
        assertEquals(dupes.length, 0, `unique tool ids for ${label} (dupes ${dupes})`);
        return { order, tools: rec.tools.length };
      } finally {
        await server.stop();
      }
    });
  }

  await suite.test("matrix.duplicate-entry", async () => {
    // The same plugin listed twice must not double-register tools or fail.
    const order = NAMES;
    const duplicate = { package: "/opt/lab/plugins/git-that-shit", options: {} };
    const out = join(LAB.reports, "matrix-duplicate.json");
    const server = await startServer("matrix-duplicate", { config: makeConfig(order, out, [duplicate]) });
    try {
      await assertLoaded(server, order, "duplicate");
      const rec = JSON.parse(readFileSync(out, "utf8"));
      const gtsTools = PLUGINS["git-that-shit"].tools;
      const dupes = rec.tools.filter((t) => gtsTools.includes(t));
      assertEquals(new Set(dupes).size, gtsTools.length, "git-that-shit tools registered once");
      return { tools: rec.tools.length };
    } finally {
      await server.stop();
    }
  });

  return suite.summary();
}

export const run = run_;

// Runtime loading verification against the real OpenCode V2 server.
//
// For one configuration it boots the server in an isolated HOME/XDG/project,
// queries the runtime plugin registry, and checks the lab inspector's record of
// the tools that were actually registered. This exercises the official V2
// plugin configuration + loading mechanism; nothing here is mocked.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Suite, assert, assertEquals, assertIncludes } from "../lib/suite.mjs";
import { CONFIGS, PLUGINS, LAB } from "../lib/env.mjs";
import { startServer } from "../lib/opencode.mjs";

export async function run({ config, tier = "smoke" } = {}) {
  const suite = new Suite(`runtime/${config}`, { tier, config });
  const cfg = CONFIGS[config];
  if (!cfg) {
    suite.skip("runtime.config", `unknown config ${config}`);
    return suite.summary();
  }

  let server = null;
  try {
    server = await startServer(config, { readyTimeoutMs: 60_000 });
  } catch (error) {
    suite.skip("runtime.boot", `could not start server: ${error.message}`);
    return suite.summary();
  }

  await suite.test("runtime.server-boot", async () => {
    const info = await server.api("GET", "/api/info");
    assert(info.ok, "server responds to /api/info");
    assert(info.json && info.json.version, "runtime reports a version");
    return { version: info.json.version, port: server.port, url: server.baseUrl };
  });

  await suite.test("runtime.plugins-active", async () => {
    const res = await server.api("GET", "/api/plugin");
    assert(res.ok, "plugin registry readable");
    const data = res.json.data || [];
    const ids = data.map((p) => p.id).filter(Boolean);
    for (const name of cfg.expect) {
      assertIncludes(ids, PLUGINS[name].id, `plugin ${PLUGINS[name].id} is active (gitdamnit*: ${ids.filter((x) => x.startsWith("gitdamnit"))})`);
    }
    const failed = data.filter((p) => p.state && p.state.status === "failed");
    assertEquals(failed.length, 0, `no failed plugins (${JSON.stringify(failed.map((f) => f.source?.path ?? f.source))})`);
    if (cfg.expect.length === 0) {
      const external = data.filter((p) => p.source && p.source.type !== "builtin");
      assertEquals(external.length, 0, `baseline has no external plugins (${external.map((p) => p.id)})`);
    }
    return { active: ids.filter((x) => x.startsWith("gitdamnit")), builtin: data.length - ids.filter((x) => x.startsWith("gitdamnit")).length };
  });

  if (config !== "baseline") {
    await suite.test("runtime.tools-registered", async () => {
      const inspectorPath = join(LAB.reports, `runtime-${config}.json`);
      assert(existsSync(inspectorPath), `inspector wrote ${inspectorPath}`);
      const rec = JSON.parse(readFileSync(inspectorPath, "utf8"));
      const missing = [];
      for (const name of cfg.expect) {
        for (const tool of PLUGINS[name].tools) {
          if (!rec.tools.includes(tool)) missing.push(tool);
        }
      }
      assertEquals(missing.length, 0, `all expected tools registered (missing: ${missing})`);
      assert(typeof rec.app.version === "string" && rec.app.version.length > 0, "inspector captured the runtime version");
      return { tools: rec.tools.length, active: rec.plugins.filter((p) => p.id && p.id.startsWith("gitdamnit")).map((p) => p.id) };
    });
  }

  await suite.test("runtime.no-load-errors", async () => {
    const log = server.readLog();
    assert(!/failed to load plugin/.test(log), "no 'failed to load plugin' in server log");
    assert(!/Cannot find package '@opencode\/plugin'/.test(log), "plugin SDK resolvable at runtime");
    return { logBytes: log.length };
  });

  await suite.test("runtime.log-snapshot", async () => {
    // Captured so the report always carries recent server output for this
    // configuration, which is what you need when a runtime test fails.
    const log = server.readLog();
    const tail = log.split("\n").filter(Boolean).slice(-40);
    return { logTail: tail };
  });

  await suite.test("runtime.cleanup", async () => {
    const res = await server.stop();
    server = null;
    return res;
  });

  return suite.summary();
}

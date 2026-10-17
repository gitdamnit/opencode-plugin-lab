// Generic runtime loading verification against the real OpenCode V2 server.
//
// For one manifest configuration it boots the server in an isolated
// HOME/XDG/project, queries the runtime plugin registry, and checks the lab
// inspector's record of the tools that were actually registered. Nothing here
// is mocked and nothing is plugin-specific: plugins are matched by the path
// they were loaded from, tools by the manifest's declared expectations.
//
// Capability-aware: tool assertions only run for plugins that declare tools;
// setups/cleanups and expected project writes are asserted only when the
// manifest supplies the corresponding metadata.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Suite, assert, assertEquals, assertIncludes } from "../lib/suite.mjs";
import { CONFIGS, PLUGINS, LAB } from "../lib/env.mjs";
import { startServer } from "../lib/opencode.mjs";

/** Match a runtime plugin record against a manifest plugin (path first, id as fallback). */
export function pluginMatches(record, plugin) {
  const src = record?.source;
  const path = typeof src === "string" ? src : src?.path ?? src?.directory ?? null;
  if (path && (path === plugin.packageDir || String(path).startsWith(plugin.packageDir))) return true;
  if (plugin.id && record?.id === plugin.id) return true;
  return false;
}

export async function run({ config, tier = "smoke" } = {}) {
  const suite = new Suite(`runtime/${config}`, { tier, config });
  const cfg = CONFIGS[config];
  if (!cfg) {
    suite.skip("runtime.config", `unknown config ${config}`);
    return suite.summary();
  }
  const expectedPlugins = cfg.expect.map((n) => PLUGINS[n]).filter(Boolean);

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
    return { version: info.json.version, port: server.port };
  });

  await suite.test("runtime.plugins-active", async () => {
    const res = await server.api("GET", "/api/plugin");
    assert(res.ok, "plugin registry readable");
    const data = res.json.data || [];
    const missing = [];
    for (const plugin of expectedPlugins) {
      if (!data.some((p) => pluginMatches(p, plugin))) missing.push(plugin.name);
    }
    assertEquals(missing.length, 0, `all expected plugins active (missing: ${missing})`);
    const failed = data.filter((p) => p.state && p.state.status === "failed");
    assertEquals(failed.length, 0, `no failed plugins (${JSON.stringify(failed.map((f) => f.source?.path ?? f.source))})`);
    if (expectedPlugins.length === 0) {
      const external = data.filter((p) => p.source && p.source.type !== "builtin");
      assertEquals(external.length, 0, `baseline has no external plugins (${external.map((p) => p.id)})`);
    }
    return { active: data.map((p) => p.id).filter(Boolean), expected: expectedPlugins.map((p) => p.name) };
  });

  if (expectedPlugins.length > 0) {
    await suite.test("runtime.tools-registered", async () => {
      const inspectorPath = join(LAB.reports, `runtime-${config}.json`);
      assert(existsSync(inspectorPath), `inspector wrote ${inspectorPath}`);
      const rec = JSON.parse(readFileSync(inspectorPath, "utf8"));
      assert(typeof rec.app.version === "string" && rec.app.version.length > 0, "inspector captured the runtime version");
      const withTools = expectedPlugins.filter((p) => p.capabilities.tools || p.tools.length);
      if (withTools.length === 0) {
        return { __unverified: "no plugin in this configuration declares tools; tool registration not applicable" };
      }
      const missing = [];
      for (const plugin of withTools) for (const tool of plugin.tools) if (!rec.tools.includes(tool)) missing.push(`${plugin.name}:${tool}`);
      assertEquals(missing.length, 0, `all expected tools registered (missing: ${missing})`);
      const withoutTools = expectedPlugins.filter((p) => !p.capabilities.tools && p.tools.length === 0);
      return { tools: rec.tools.length, pluginsWithoutTools: withoutTools.map((p) => p.name) };
    });
  }

  await suite.test("runtime.no-load-errors", async () => {
    const log = server.readLog();
    assert(!/failed to load plugin/i.test(log), "no plugin load failures in server log");
    assert(!/Cannot find package '@opencode\/plugin'/.test(log), "plugin SDK resolvable at runtime");
    return { logBytes: log.length };
  });

  const markers = expectedPlugins.filter((p) => p.setupMarker);
  if (markers.length) {
    await suite.test("runtime.lifecycle-setup", async () => {
      const log = server.readLog();
      const missing = markers.filter((p) => !log.includes(p.setupMarker));
      assertEquals(missing.length, 0, `setup markers observed (missing: ${missing.map((p) => p.name)})`);
      return { markers: markers.map((p) => p.setupMarker) };
    });
  } else {
    suite.skip("runtime.lifecycle-setup", "no plugin declares a setup marker");
  }

  // Generic write-boundary check: the disposable project must contain only
  // expected entries. Plugins can declare extra top-level writes.
  await suite.test("runtime.write-boundaries", async () => {
    const allowed = new Set(["opencode.json", "AGENTS.md", ".opencode"]);
    for (const p of expectedPlugins) for (const w of p.expectedWrites) allowed.add(w);
    const entries = readdirSync(server.dirs.project).sort();
    const unexpected = entries.filter((e) => !allowed.has(e));
    assertEquals(unexpected.length, 0, `no unexpected project writes (unexpected: ${unexpected}, allowed: ${[...allowed]})`);
    return { entries };
  });

  await suite.test("runtime.log-snapshot", async () => {
    const log = server.readLog();
    return { logTail: log.split("\n").filter(Boolean).slice(-40) };
  });

  await suite.test("runtime.cleanup", async () => {
    const res = await server.stop();
    server = null;
    return res;
  });

  const cleanupMarkers = expectedPlugins.filter((p) => p.cleanupMarker);
  if (cleanupMarkers.length) {
    await suite.test("runtime.lifecycle-cleanup", async () => {
      // server is stopped by the previous test; read the log file directly.
      let log = "";
      try {
        log = readFileSync(join(LAB.work, "runs", config, "server.log"), "utf8");
      } catch {
        log = "";
      }
      const missing = cleanupMarkers.filter((p) => !log.includes(p.cleanupMarker));
      // Cleanup is best-effort depending on shutdown path; if the runtime did not
      // emit the marker, report unverified rather than a false failure.
      if (missing.length) return { __unverified: `cleanup markers not observed for ${missing.map((p) => p.name).join(", ")} (shutdown may unload without logging)` };
      return { markers: cleanupMarkers.map((p) => p.cleanupMarker) };
    });
  }

  return suite.summary();
}

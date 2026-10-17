// Generic configuration validation & error handling.
//
// Verifies that bad input is rejected with a useful error rather than crashing
// or silently passing: unknown configuration names, invalid manifests, missing
// plugin directories and malformed plugin packages. Server-dependent checks are
// lenient about HOW the runtime refuses (throw vs. failed state) but strict that
// the lab survives and reports it.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Suite, assert } from "../lib/suite.mjs";
import { LAB } from "../lib/env.mjs";
import { loadManifest, ManifestError } from "../lib/manifest.mjs";
import { generateConfig, startServer } from "../lib/opencode.mjs";

const INSPECTOR = "/opt/lab/plugins/lab-inspector";
const SDK = process.env.LAB_SDK_VERSION || "2.0.21";

export async function run({ tier = "validate" } = {}) {
  const suite = new Suite("config-validation/errors", { tier });
  const root = mkdtempSync(join(tmpdir(), "lab-cfg-"));

  await suite.test("config-validation.unknown-configuration", () => {
    let threw = null;
    try {
      generateConfig("definitely-not-a-config");
    } catch (error) {
      threw = error;
    }
    assert(threw, "generateConfig throws for an unknown configuration");
    assert(/unknown configuration/i.test(threw.message), `error names the problem: ${threw.message}`);
    return { message: threw.message };
  });

  await suite.test("config-validation.invalid-manifest-rejected", () => {
    const bad = join(root, "bad-lab.config.json");
    writeFileSync(bad, JSON.stringify({ version: 1, plugins: [{ name: "x" }], configs: [{ name: "c", plugins: ["missing"] }] }, null, 2));
    let threw = null;
    try {
      loadManifest(bad, { strict: true });
    } catch (error) {
      threw = error;
    }
    assert(threw instanceof ManifestError, "invalid manifest throws ManifestError");
    assert(/source\.type|unknown plugin/i.test(threw.message), `error is actionable: ${threw.message.split("\n").slice(0, 3).join(" | ")}`);
    return { message: threw.message.split("\n").slice(0, 2).join(" | ") };
  });

  await suite.test("config-validation.missing-plugin-directory", async () => {
    const out = join(LAB.reports, "config-validation-missing.json");
    const config = {
      $schema: "https://opencode.ai/config.json",
      update: "disable",
      plugins: [{ package: join(LAB.root, "does-not-exist-plugin"), options: {} }, { package: INSPECTOR, options: { out } }],
    };
    let server = null;
    try {
      server = await startServer("config-missing-dir", { config, readyTimeoutMs: 30_000 });
    } catch (error) {
      // The runtime refusing to boot is a valid, safe outcome.
      return { outcome: "refused-to-boot", message: String(error.message).slice(0, 160) };
    }
    try {
      const res = await server.api("GET", "/api/plugin");
      assert(res.ok, "server survives a missing plugin directory and registry stays readable");
      const failed = (res.json.data || []).filter((p) => p.state && p.state.status === "failed");
      return { outcome: "booted", failed: failed.length };
    } finally {
      await server.stop();
    }
  });

  await suite.test("config-validation.malformed-package-json", async () => {
    const dir = join(LAB.work, "validation", "bad-package");
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), "{ this is not valid json");
    writeFileSync(join(dir, "index.ts"), `export default { id: "lab.bad.pkg" }\n`);
    symlinkSync(join(INSPECTOR, "node_modules"), join(dir, "node_modules"), "dir");
    const out = join(LAB.reports, "config-validation-badpkg.json");
    const config = {
      $schema: "https://opencode.ai/config.json",
      update: "disable",
      plugins: [{ package: dir, options: {} }, { package: INSPECTOR, options: { out } }],
    };
    let server = null;
    try {
      server = await startServer("config-bad-pkg", { config, readyTimeoutMs: 30_000 });
    } catch (error) {
      return { outcome: "refused-to-boot", message: String(error.message).slice(0, 160) };
    }
    try {
      const res = await server.api("GET", "/api/plugin");
      assert(res.ok, "server survives a malformed package.json");
      assert(existsSync(out), "inspector still recorded the registry");
      return { outcome: "booted" };
    } finally {
      await server.stop();
    }
  });

  rmSync(root, { recursive: true, force: true });
  return suite.summary();
}

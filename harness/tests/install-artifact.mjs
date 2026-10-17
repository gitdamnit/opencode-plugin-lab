// Generic install-from-artifact.
//
// For each plugin it packs the built package with `npm pack` (no install
// scripts), extracts the tarball into a clean directory, and loads THAT
// directory in the real runtime. This proves the packaged artifact — not just
// the in-place build tree — is a valid, loadable OpenCode plugin.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Suite, assert } from "../lib/suite.mjs";
import { PLUGINS, LAB } from "../lib/env.mjs";
import { run as exec } from "../lib/exec.mjs";
import { startServer } from "../lib/opencode.mjs";
import { pluginMatches } from "./runtime-load.mjs";

const INSPECTOR = "/opt/lab/plugins/lab-inspector";

export async function run({ tier = "validate" } = {}) {
  const suite = new Suite("install-artifact/packaged", { tier });
  const root = mkdtempSync(join(tmpdir(), "lab-pack-"));

  for (const [name, plugin] of Object.entries(PLUGINS)) {
    await suite.test(`install.${name}.pack`, () => {
      if (!existsSync(plugin.packageDir)) return { __unverified: `${name} is not built` };
      const dest = join(root, name);
      mkdirSync(dest, { recursive: true });
      const pack = exec("npm", ["pack", "--ignore-scripts", "--pack-destination", dest, plugin.packageDir], { cwd: root });
      if (pack.code !== 0) {
        return { __unverified: `npm pack failed (${pack.stderr.split("\n").slice(-2).join(" ")})` };
      }
      const tarballs = readdirSync(dest).filter((f) => f.endsWith(".tgz"));
      assert(tarballs.length === 1, `exactly one tarball produced (got ${tarballs})`);
      const extract = join(dest, "extracted");
      mkdirSync(extract, { recursive: true });
      const untar = exec("tar", ["-xzf", join(dest, tarballs[0]), "-C", extract]);
      assert(untar.code === 0, `tarball extracted (${untar.stderr.slice(0, 200)})`);
      const pkgRoot = join(extract, "package");
      assert(existsSync(join(pkgRoot, "package.json")), "extracted package has package.json");
      // npm pack omits node_modules; the extracted package needs the SDK to load.
      return { tarball: tarballs[0], pkgRoot };
    });

    await suite.test(`install.${name}.loads-in-runtime`, async () => {
      const pkgRoot = join(root, name, "extracted", "package");
      if (!existsSync(join(pkgRoot, "package.json"))) return { __unverified: `${name} was not packed` };
      // npm pack omits node_modules and the lab runs offline; resolve the SDK
      // from the baked inspector so the extracted artifact can load exactly as a
      // real `npm install` would provide it.
      const sdkModules = join(INSPECTOR, "node_modules");
      if (!existsSync(join(pkgRoot, "node_modules")) && existsSync(sdkModules)) {
        symlinkSync(sdkModules, join(pkgRoot, "node_modules"), "dir");
      }
      assert(existsSync(join(pkgRoot, "node_modules", "@opencode", "plugin")), "packaged artifact resolves the SDK offline");
      const out = join(LAB.reports, `install-artifact-${name}.json`);
      const config = {
        $schema: "https://opencode.ai/config.json",
        update: "disable",
        plugins: [{ package: pkgRoot, options: plugin.options }, { package: INSPECTOR, options: { out } }],
      };
      const server = await startServer(`install-${name}`, { config });
      try {
        const res = await server.api("GET", "/api/plugin");
        const data = res.json.data || [];
        const failed = data.filter((p) => p.state && p.state.status === "failed");
        assert(failed.length === 0, `packaged ${name} does not fail to load (${JSON.stringify(failed.map((f) => f.source?.path))}) — log: ${server.readLog().split("\n").filter((l) => /error|fail/i.test(l)).slice(-3).join(" | ")}`);
        const active = data.some((p) => pluginMatches(p, { packageDir: pkgRoot, id: plugin.id }));
        assert(active, `packaged ${name} is active`);
        return { active: true, plugins: data.length };
      } finally {
        await server.stop();
      }
    });
  }

  rmSync(root, { recursive: true, force: true });
  return suite.summary();
}

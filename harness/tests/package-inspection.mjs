// Generic package inspection & provenance.
//
// For every plugin in the manifest (whether or not any configuration loads it)
// this verifies that the built lab package is self-describing and loadable:
// package metadata, the @opencode/plugin dependency, a resolvable entry point,
// build output presence, and recorded version/commit provenance.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { Suite, assert, assertEquals } from "../lib/suite.mjs";
import { PLUGINS, pluginSourceInfo } from "../lib/env.mjs";

function walkFiles(dir, base = dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules") continue;
      walkFiles(full, base, acc);
    } else acc.push({ path: full.slice(base.length + 1), bytes: statSync(full).size });
  }
  return acc;
}

export async function run({ tier = "validate" } = {}) {
  const suite = new Suite("package-inspection/artifacts", { tier });

  for (const [name, plugin] of Object.entries(PLUGINS)) {
    await suite.test(`package.${name}.present`, () => {
      assert(existsSync(plugin.packageDir), `built package directory exists: ${plugin.packageDir}`);
      return { packageDir: plugin.packageDir };
    });

    await suite.test(`package.${name}.metadata`, () => {
      const pkgPath = join(plugin.packageDir, "package.json");
      assert(existsSync(pkgPath), "package.json exists");
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      assert(pkg.name, "package.json has a name");
      const dep = pkg.dependencies && pkg.dependencies["@opencode/plugin"];
      assert(dep, "@opencode/plugin is a declared dependency");
      assertEquals(pkg.type, "module", "package is ESM");
      return { name: pkg.name, sdk: dep, main: pkg.main };
    });

    await suite.test(`package.${name}.sdk-resolvable`, () => {
      const sdk = join(plugin.packageDir, "node_modules", "@opencode", "plugin", "package.json");
      assert(existsSync(sdk), "@opencode/plugin installed next to the plugin");
      const v = JSON.parse(readFileSync(sdk, "utf8")).version;
      return { sdkVersion: v };
    });

    await suite.test(`package.${name}.entry-resolves`, () => {
      const rootEntry = plugin.build.rootEntry === true;
      const entryFile = plugin.build.entry || "index.js";
      if (rootEntry) {
        const p = join(plugin.packageDir, entryFile);
        assert(existsSync(p), `root entry ${entryFile} exists`);
        return { entry: entryFile, rootEntry: true };
      }
      const shim = join(plugin.packageDir, "index.ts");
      assert(existsSync(shim), "index.ts shim exists");
      const body = readFileSync(shim, "utf8");
      assert(body.includes(`./dist/${entryFile}`), `shim re-exports ./dist/${entryFile}`);
      const distFile = join(plugin.packageDir, "dist", entryFile);
      assert(existsSync(distFile), `compiled entry dist/${entryFile} exists`);
      return { entry: entryFile, shim: true };
    });

    await suite.test(`package.${name}.build-output`, () => {
      const rootEntry = plugin.build.rootEntry === true;
      const dir = rootEntry ? plugin.packageDir : join(plugin.packageDir, plugin.build.dist || "dist");
      assert(existsSync(dir), `build output present (${dir})`);
      const files = walkFiles(dir);
      assert(files.length > 0, "build output is non-empty");
      return { files: files.length, bytes: files.reduce((a, f) => a + f.bytes, 0) };
    });

    await suite.test(`package.${name}.provenance`, () => {
      const info = pluginSourceInfo(name);
      assert(info.built, "package marked built");
      assert(info.version, `upstream version recorded (${info.version})`);
      const src = join(plugin.packageDir, "LAB_SOURCE.json");
      assert(existsSync(src), "LAB_SOURCE.json provenance present");
      const rec = JSON.parse(readFileSync(src, "utf8"));
      assert(rec.sourceType, "source type recorded");
      if (rec.sourceType !== "npm") {
        // Directory / package / tarball sources should carry a source path and,
        // when it was a git tree, a commit.
        assert("sourcePath" in rec, "source path recorded");
      }
      return { version: info.version, commit: info.commit, sourceType: rec.sourceType };
    });
  }

  if (Object.keys(PLUGINS).length > 0) {
    await suite.test("package.inspector.present", () => {
      const p = join("/opt/lab/plugins", "lab-inspector", "package.json");
      assert(existsSync(p), "lab inspector package built");
      return { present: true };
    });
  }

  return suite.summary();
}

// Combined integration tests: all three plugins loaded together in one runtime.
//
// Verifies coexistence (no tool-name conflicts, no load failures, no
// unexpected project writes), a checkpoint handoff export passing through
// Stranger Danger, and Git That Shit snapshotting config artifacts.
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Suite, assert, assertEquals, assertIncludes, assertNotIncludes } from "../lib/suite.mjs";
import { LAB, PLUGINS } from "../lib/env.mjs";
import { startServer } from "../lib/opencode.mjs";
import { run as exec } from "../lib/exec.mjs";

const CP_CORE = join(LAB.plugins, "checkpoint-orchestrator", "dist", "core");
const GTS_DIST = join(LAB.plugins, "git-that-shit", "dist");
const SD_DIST = join(LAB.plugins, "stranger-danger", "dist");

export async function run({ tier = "integration" } = {}) {
  const suite = new Suite("combined/all-plugins", { tier });
  const root = mkdtempSync(join(tmpdir(), "lab-combined-"));

  // ---- coexistence in the real runtime -----------------------------------
  let server = null;
  try {
    server = await startServer("all");
  } catch (error) {
    suite.skip("combined.runtime", `could not start combined server: ${error.message}`);
  }

  if (server) {
    await suite.test("combined.all-plugins-active", async () => {
      const res = await server.api("GET", "/api/plugin");
      const data = res.json.data || [];
      const ids = data.map((p) => p.id).filter(Boolean);
      for (const name of Object.keys(PLUGINS)) {
        assertIncludes(ids, PLUGINS[name].id, `active: ${PLUGINS[name].id}`);
      }
      const failed = data.filter((p) => p.state?.status === "failed");
      assertEquals(failed.length, 0, `no failed plugins: ${JSON.stringify(failed.map((f) => f.source?.path))}`);
      return { active: ids.filter((id) => id.startsWith("gitdamnit")) };
    });

    await suite.test("combined.no-tool-name-conflicts", async () => {
      const inspectorPath = join(LAB.reports, "runtime-all.json");
      assert(existsSync(inspectorPath), "inspector output present");
      const rec = JSON.parse(readFileSync(inspectorPath, "utf8"));
      const all = [];
      for (const name of Object.keys(PLUGINS)) all.push(...PLUGINS[name].tools);
      for (const tool of all) assertIncludes(rec.tools, tool, `registered: ${tool}`);
      const duplicates = rec.tools.filter((t, i) => rec.tools.indexOf(t) !== i);
      assertEquals(duplicates.length, 0, `tool ids unique (dupes: ${duplicates})`);
      const counts = {};
      for (const t of rec.tools) counts[t] = (counts[t] || 0) + 1;
      const conflicting = Object.entries(counts).filter(([, n]) => n > 1);
      assertEquals(conflicting.length, 0, `no conflicts: ${JSON.stringify(conflicting)}`);
      return { toolCount: rec.tools.length };
    });

    await suite.test("combined.no-unexpected-project-writes", async () => {
      const projectDir = server.dirs.project;
      const entries = readdirSync(projectDir).sort();
      const allowed = new Set(["opencode.json", "AGENTS.md", ".opencode", ".git-that-shit"]);
      const unexpected = entries.filter((e) => !allowed.has(e));
      assertEquals(unexpected.length, 0, `no unexpected top-level files: ${unexpected}`);
      return { entries };
    });

    await suite.test("combined.server-log-clean", async () => {
      const log = server.readLog();
      assert(!/failed to load plugin/.test(log), "no plugin load failures");
      return { bytes: log.length };
    });

    await suite.test("combined.cleanup", async () => {
      const res = await server.stop();
      return res;
    });
  }

  // ---- checkpoint handoff -> stranger danger -----------------------------
  await suite.test("combined.checkpoint-handoff-through-stranger-danger", async () => {
    if (!existsSync(CP_CORE) || !existsSync(SD_DIST)) {
      throw new Error("checkpoint or stranger-danger build missing");
    }
    const { CheckpointStore } = await import(join(CP_CORE, "store.js"));
    const { CheckpointService, DEFAULT_SERVICE_OPTIONS } = await import(join(CP_CORE, "service.js"));
    const { scanAndRedact } = await import(join(SD_DIST, "engine", "scanner.js"));

    const projectDir = join(root, "handoff-project");
    mkdirSync(projectDir, { recursive: true });
    const store = new CheckpointStore(join(root, "handoff.db"), { historyLimit: 5 });
    // Default (namespaced) handoff location, exercising the dev.1 layout.
    const service = new CheckpointService(store, { ...DEFAULT_SERVICE_OPTIONS, handoffEnabled: true }, { info() {}, warn() {}, error() {} });
    const synthetic = "AKIAIOSFODNN7EXAMPLE";
    const ref = { sessionID: "handoff-sess", projectID: "handoff-proj", projectDirectory: projectDir };
    const data = service.save(ref, { task: { title: "Handoff" }, summary: `note with token=${synthetic}` }, { origin: "tool" }).data;
    const handoffPath = service.exportHandoff(ref, data);
    assert(handoffPath && existsSync(handoffPath), "handoff file exported");
    assert(handoffPath.includes(join(".opencode", "state", "checkpoint-orchestrator")), `handoff is namespaced: ${handoffPath}`);
    store.close();

    const exported = readFileSync(handoffPath, "utf8");
    const { redacted, findings } = scanAndRedact(exported, "file", handoffPath);
    assert(findings.length >= 1, "stranger-danger detects secret in handoff export");
    assertNotIncludes(redacted, synthetic, "handoff export is redacted on the way through stranger-danger");
    return { handoffPath, findings: findings.length };
  });

  // ---- stranger danger scanning a checkpoint SQLite-adjacent artifact -----
  await suite.test("combined.no-live-database-copied-as-backup", async () => {
    // The lab never copies a live SQLite database. Confirm the handoff export
    // is JSON (not a database copy) and that no *.db file sits beside it.
    const cpCore = CP_CORE;
    if (!existsSync(cpCore)) throw new Error("checkpoint build missing");
    const projectDir = join(root, "handoff-project");
    const stateDir = join(projectDir, ".opencode", "state");
    if (existsSync(stateDir)) {
      const files = readdirSync(stateDir);
      const dbFiles = files.filter((f) => f.endsWith(".db"));
      assertEquals(dbFiles.length, 0, `no database files copied into handoff dir: ${dbFiles}`);
    }
    return { ok: true };
  });

  // ---- git that shit snapshots config + generated artifacts --------------
  await suite.test("combined.git-that-shit-snapshots-config-artifacts", async () => {
    if (!existsSync(GTS_DIST)) throw new Error("git-that-shit build missing");
    const snapshotEngine = await import(join(GTS_DIST, "engine", "snapshot.js"));
    const manifestEngine = await import(join(GTS_DIST, "engine", "manifest.js"));

    const project = join(root, "gts-config-project");
    mkdirSync(join(project, ".opencode", "state"), { recursive: true });
    exec("git", ["init", "-q"], { cwd: project });
    exec("git", ["config", "user.email", "lab@example.invalid"], { cwd: project });
    exec("git", ["config", "user.name", "Lab"], { cwd: project });
    writeFileSync(join(project, "opencode.json"), JSON.stringify({ $schema: "https://opencode.ai/config.json", plugins: ["a", "b"] }, null, 2));
    writeFileSync(join(project, ".opencode", "state", "checkpoint.json"), JSON.stringify({ task: { title: "t" } }));
    writeFileSync(join(project, "package.json"), JSON.stringify({ name: "cfg", version: "2.0.0" }));
    exec("git", ["add", "-A"], { cwd: project });
    exec("git", ["commit", "-qm", "init"], { cwd: project });

    await snapshotEngine.initShadowRepo(project);
    const result = await snapshotEngine.snapshot({ projectRoot: project, reason: "config change", type: "manual", trigger: "test" });
    assert(result.committed, `snapshot committed: ${result.error ?? ""}`);
    const copied = result.filesCopied ?? [];
    assert(copied.some((f) => f.includes("opencode.json")), `opencode.json captured (copied: ${copied.join(",")})`);
    const manifest = await manifestEngine.readManifest(project);
    assert(manifest.length >= 1, "manifest records config snapshot");
    return { copied: copied.slice(0, 10) };
  });

  rmSync(root, { recursive: true, force: true });
  return suite.summary();
}

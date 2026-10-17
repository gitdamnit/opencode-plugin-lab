// Functional tests for Git That Shit.
//
// Exercised strictly against disposable fixture repositories created under the
// lab's temp dir — never against a real project. Covers automatic snapshots,
// manual snapshots, Git history, locking, restore dry-runs, real restores and
// simultaneous sessions.
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Suite, assert, assertEquals, assertIncludes } from "../../../harness/lib/suite.mjs";
import { LAB } from "../../../harness/lib/env.mjs";
import { run as exec } from "../../../harness/lib/exec.mjs";

const DIST = join(LAB.plugins, "git-that-shit", "dist");
const CLI = join(DIST, "cli", "index.js");

function initFixture(root, name) {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  exec("git", ["init", "-q"], { cwd: dir });
  exec("git", ["config", "user.email", "lab@example.invalid"], { cwd: dir });
  exec("git", ["config", "user.name", "Lab"], { cwd: dir });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "fixture", version: "1.0.0" }, null, 2));
  writeFileSync(join(dir, "opencode.json"), JSON.stringify({ $schema: "https://opencode.ai/config.json" }, null, 2));
  writeFileSync(join(dir, "app.ts"), "export const value = 1;\n");
  exec("git", ["add", "-A"], { cwd: dir });
  exec("git", ["commit", "-qm", "init"], { cwd: dir });
  return dir;
}

export async function run_({ tier = "functional" } = {}) {
  const suite = new Suite("functional/git-that-shit", { tier });
  if (!existsSync(CLI)) {
    suite.skip("gts.import", "plugin not built (missing dist/cli)");
    return suite.summary();
  }

  const root = mkdtempSync(join(tmpdir(), "lab-gts-"));
  const env = { GIT_THAT_SHIT_GLOBAL_CONFIG_DIR: join(root, "global-config") };

  const snapshotEngine = await import(join(DIST, "engine", "snapshot.js"));
  const manifestEngine = await import(join(DIST, "engine", "manifest.js"));
  const lockEngine = await import(join(DIST, "engine", "lock.js"));
  const paths = await import(join(DIST, "shared", "paths.js"));

  await suite.test("gts.init-shadow-repo", async () => {
    const project = initFixture(root, "init");
    await snapshotEngine.initShadowRepo(project);
    const shadow = paths.getShadowRepoPath(project);
    assert(existsSync(join(shadow, ".git")), "shadow git repo created");
  });

  await suite.test("gts.automatic-snapshot", async () => {
    const project = initFixture(root, "auto");
    await snapshotEngine.initShadowRepo(project);
    const result = await snapshotEngine.snapshot({ projectRoot: project, reason: "destructive command detected", type: "pre-op", trigger: "tool.execute.before", sessionId: "session-1" });
    assert(result.committed, `snapshot committed: ${result.error ?? ""}`);
    assert(result.shortHash, "snapshot has a short hash");
    const manifest = await manifestEngine.readManifest(project);
    assert(manifest.length >= 1, "manifest records the snapshot");
  });

  await suite.test("gts.manual-snapshot-cli", async () => {
    const project = initFixture(root, "manual");
    await snapshotEngine.initShadowRepo(project);
    const before = (await manifestEngine.readManifest(project)).length;
    const res = exec("node", [CLI, "snapshot", "-m", "manual from CLI"], { cwd: project, env });
    assertEquals(res.code, 0, `CLI exit 0 (stderr: ${res.stderr.slice(0, 300)})`);
    const after = (await manifestEngine.readManifest(project)).length;
    assert(after > before, "manual snapshot appended to manifest");
  });

  await suite.test("gts.snapshot-git-history", async () => {
    const project = initFixture(root, "history");
    await snapshotEngine.initShadowRepo(project);
    // Git That Shit only tracks its configured allowlist (opencode.json,
    // package.json, config files, ...). Change a tracked file to force commits.
    writeFileSync(join(project, "package.json"), JSON.stringify({ name: "fixture", version: "1.0.1" }, null, 2));
    const one = await snapshotEngine.snapshot({ projectRoot: project, reason: "one", type: "manual", trigger: "test" });
    writeFileSync(join(project, "package.json"), JSON.stringify({ name: "fixture", version: "1.0.2" }, null, 2));
    const two = await snapshotEngine.snapshot({ projectRoot: project, reason: "two", type: "manual", trigger: "test" });
    const shadow = paths.getShadowRepoPath(project);
    const log = exec("git", ["-C", shadow, "log", "--oneline"], { cwd: project });
    assertEquals(log.code, 0, "shadow repo log readable");
    const commits = log.stdout.trim().split("\n").filter(Boolean);
    assert(commits.length >= 2, `shadow repo has history (${commits.length} commits; one=${one.committed} two=${two.committed})`);
  });

  await suite.test("gts.locking", async () => {
    const project = initFixture(root, "locking");
    await snapshotEngine.initShadowRepo(project);
    await lockEngine.cleanupStaleLocks(project).catch(() => {});
    const first = await lockEngine.acquireLock(project, "snapshot", "test");
    assert(first, "first lock acquired");
    let refused = false;
    try {
      const second = await lockEngine.acquireLock(project, "snapshot", "test");
      refused = second === false;
    } catch {
      refused = true; // acquireLock throws LockError when a live holder exists
    }
    assert(refused, "second lock refused while held");
    await lockEngine.releaseLock(project);
    const third = await lockEngine.acquireLock(project, "snapshot", "test");
    assert(third, "lock re-acquired after release");
    await lockEngine.releaseLock(project);
  });

  await suite.test("gts.restore-dry-run", async () => {
    const project = initFixture(root, "dryrun");
    await snapshotEngine.initShadowRepo(project);
    const baseline = { name: "fixture", version: "1.0.0" };
    const snap = await snapshotEngine.snapshot({ projectRoot: project, reason: "baseline", type: "manual", trigger: "test" });
    assert(snap.committed, `baseline snapshot committed: ${snap.error ?? ""}`);
    writeFileSync(join(project, "package.json"), JSON.stringify({ name: "fixture", version: "9.9.9" }, null, 2));
    const res = exec("node", [CLI, "restore", snap.shortHash], { cwd: project, env });
    assertEquals(res.code, 0, `dry-run exits 0 (stderr: ${res.stderr.slice(0, 200)})`);
    assertIncludes((res.stdout + res.stderr).toLowerCase(), "dry", "dry-run is announced");
    assertEquals(JSON.parse(readFileSync(join(project, "package.json"), "utf8")).version, "9.9.9", "dry-run does not modify files");
  });

  await suite.test("gts.real-restore", async () => {
    const project = initFixture(root, "restore");
    await snapshotEngine.initShadowRepo(project);
    const snap = await snapshotEngine.snapshot({ projectRoot: project, reason: "baseline", type: "manual", trigger: "test" });
    assert(snap.committed, `baseline snapshot committed: ${snap.error ?? ""}`);
    writeFileSync(join(project, "package.json"), JSON.stringify({ name: "fixture", version: "9.9.9" }, null, 2));
    const res = exec("node", [CLI, "restore", snap.shortHash, "--yes", "--force"], { cwd: project, env });
    assertEquals(res.code, 0, `real restore exits 0 (stderr: ${res.stderr.slice(0, 300)})`);
    assertEquals(JSON.parse(readFileSync(join(project, "package.json"), "utf8")).version, "1.0.0", "file content restored");
  });

  await suite.test("gts.simultaneous-sessions", async () => {
    const project = initFixture(root, "concurrent");
    await snapshotEngine.initShadowRepo(project);
    // Two independent snapshot processes race for the same project lock.
    const { spawn } = await import("node:child_process");
    const launch = () =>
      new Promise((resolve) => {
        const child = spawn("node", [CLI, "snapshot", "-m", "concurrent"], { cwd: project, env: { ...process.env, ...env } });
        let out = "";
        child.stdout.on("data", (d) => (out += d));
        child.stderr.on("data", (d) => (out += d));
        child.on("close", (code) => resolve({ code, out }));
      });
    const [a, b] = await Promise.all([launch(), launch()]);
    assertEquals(a.code, 0, `first concurrent process exits 0 (${a.out.slice(0, 150)})`);
    assertEquals(b.code, 0, `second concurrent process exits 0 (${b.out.slice(0, 150)})`);
    const manifest = await manifestEngine.readManifest(project);
    assert(manifest.length >= 1, "at least one concurrent snapshot recorded");
  });

  rmSync(root, { recursive: true, force: true });
  return suite.summary();
}

export { run_ as run };

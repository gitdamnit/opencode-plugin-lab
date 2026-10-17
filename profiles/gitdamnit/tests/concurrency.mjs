// Concurrency and crash-consistency tests.
//
// Exercises real multi-process contention: many processes writing the same
// SQLite checkpoint database, several processes snapshotting the same project,
// and concurrent redaction/audit work.
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Suite, assert, assertEquals, assertNotIncludes, assertIncludes } from "../../../harness/lib/suite.mjs";
import { LAB } from "../../../harness/lib/env.mjs";
import { run as exec, runAsync } from "../../../harness/lib/exec.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const CP_WORKER = join(HERE, "workers", "checkpoint-writer.mjs");
const GTS_WORKER = join(HERE, "workers", "gts-snapshotter.mjs");
const CP = join(LAB.plugins, "checkpoint-orchestrator", "dist", "core");
const GTS = join(LAB.plugins, "git-that-shit", "dist");
const SD = join(LAB.plugins, "stranger-danger", "dist");

const AWS = "AKIAIOSFODNN7EXAMPLE";

export async function run_({ tier = "validate" } = {}) {
  const suite = new Suite("concurrency/multi-process", { tier });
  const root = mkdtempSync(join(tmpdir(), "lab-conc-"));

  // --------------------------------------------------- Checkpoint: many writers
  if (existsSync(CP)) {
    await suite.test("concurrency.checkpoint-multi-process-distinct-sessions", async () => {
      const dbPath = join(root, "cp", "checkpoints.db");
      mkdirSync(join(root, "cp"), { recursive: true });
      const sessions = ["s1", "s2", "s3", "s4"];
      const results = await Promise.all(
        sessions.map((s) => runAsync(process.execPath, [CP_WORKER, dbPath, s, "15", root])),
      );
      for (const r of results) assertEquals(r.code, 0, `writer exited 0 (stderr: ${r.stderr.slice(0, 200)})`);

      const { CheckpointStore } = await import(join(CP, "store.js"));
      const { CheckpointService, DEFAULT_SERVICE_OPTIONS } = await import(join(CP, "service.js"));
      const store = new CheckpointStore(dbPath, { historyLimit: 100 });
      try {
        assertEquals(store.integrityCheck(), "ok", "database integrity holds after concurrent writers");
        const service = new CheckpointService(store, { ...DEFAULT_SERVICE_OPTIONS, handoffEnabled: false }, { info() {}, warn() {}, error() {} });
        for (const s of sessions) {
          const loaded = service.load({ sessionID: s, projectID: "concurrent-proj", projectDirectory: root });
          assert(loaded, `session ${s} readable`);
          assert(loaded.data.summary.startsWith(`${s}-write-`), `session ${s} data intact`);
        }
      } finally {
        store.close();
      }
    });

    await suite.test("concurrency.checkpoint-multi-process-same-session", async () => {
      const dbPath = join(root, "cp-same", "checkpoints.db");
      mkdirSync(join(root, "cp-same"), { recursive: true });
      const results = await Promise.all(
        [1, 2, 3].map(() => runAsync(process.execPath, [CP_WORKER, dbPath, "shared-session", "10", root])),
      );
      for (const r of results) assertEquals(r.code, 0, `same-session writer exited 0 (stderr: ${r.stderr.slice(0, 200)})`);
      const { CheckpointStore } = await import(join(CP, "store.js"));
      const { CheckpointService, DEFAULT_SERVICE_OPTIONS } = await import(join(CP, "service.js"));
      const store = new CheckpointStore(dbPath, { historyLimit: 100 });
      try {
        assertEquals(store.integrityCheck(), "ok", "database integrity holds after same-session contention");
        const service = new CheckpointService(store, { ...DEFAULT_SERVICE_OPTIONS, handoffEnabled: false }, { info() {}, warn() {}, error() {} });
        const loaded = service.load({ sessionID: "shared-session", projectID: "concurrent-proj", projectDirectory: root });
        assert(loaded, "shared session readable");
      } finally {
        store.close();
      }
    });
  } else {
    suite.skip("concurrency.checkpoint-*", "checkpoint-orchestrator not built");
  }

  // ------------------------------------------------------- Git That Shit: snapshots
  if (existsSync(join(GTS, "engine", "snapshot.js"))) {
    await suite.test("concurrency.gts-multi-process-snapshots", async () => {
      const project = join(root, "gts-conc");
      mkdirSync(project, { recursive: true });
      exec("git", ["init", "-q"], { cwd: project });
      exec("git", ["config", "user.email", "lab@example.invalid"], { cwd: project });
      exec("git", ["config", "user.name", "Lab"], { cwd: project });
      writeFileSync(join(project, "package.json"), JSON.stringify({ name: "concurrent-fixture", version: "1.0.0" }, null, 2));
      exec("git", ["add", "-A"], { cwd: project });
      exec("git", ["commit", "-qm", "init"], { cwd: project });

      const snapshotEngine = await import(join(GTS, "engine", "snapshot.js"));
      const manifestEngine = await import(join(GTS, "engine", "manifest.js"));
      const paths = await import(join(GTS, "shared", "paths.js"));
      await snapshotEngine.initShadowRepo(project);

      const results = await Promise.all(
        [0, 1, 2].map((i) => runAsync(process.execPath, [GTS_WORKER, project, `m${i}`, String(i)])),
      );
      for (const r of results) assertEquals(r.code, 0, `snapshotter exited 0 (stderr: ${r.stderr.slice(0, 300)})`);

      const shadow = paths.getShadowRepoPath(project);
      const fsck = exec("git", ["-C", shadow, "fsck", "--full"], { cwd: project });
      assertEquals(fsck.code, 0, `shadow repository is intact (fsck: ${fsck.stderr.slice(0, 200)})`);
      const manifest = await manifestEngine.readManifest(project);
      assert(manifest.length >= 1, `manifest has entries after concurrent snapshots (${manifest.length})`);
      const hashes = manifest.map((m) => m.hash).filter(Boolean);
      assertEquals(new Set(hashes).size, hashes.length, "no duplicate snapshot hashes");
    });
  } else {
    suite.skip("concurrency.gts-*", "git-that-shit not built");
  }

  // --------------------------------------------------------- Stranger Danger: scans
  if (existsSync(join(SD, "engine", "scanner.js"))) {
    await suite.test("concurrency.sd-parallel-redaction", async () => {
      const { scanAndRedact } = await import(join(SD, "engine", "scanner.js"));
      const inputs = Array.from({ length: 24 }, (_, i) => `payload ${i} token="${AWS}" ${"x".repeat(i * 1000)}\n`);
      const outputs = await Promise.all(inputs.map((content) => Promise.resolve(scanAndRedact(content, "output"))));
      outputs.forEach((out, i) => {
        assertNotIncludes(out.redacted, AWS, `parallel redaction ${i} removed the secret`);
        assertIncludes(out.redacted, "[REDACTED:", `parallel redaction ${i} inserted a token`);
      });
    });

    await suite.test("concurrency.sd-audit-sessions-do-not-mix", async () => {
      const audit = await import(join(SD, "engine", "audit.js"));
      const files = [];
      for (let i = 0; i < 5; i++) {
        const p = join(root, `audit-${i}.jsonl`);
        files.push(p);
        audit.writeAuditBatch(
          [audit.auditEntryFromFinding({ ruleId: "aws-access-key", description: "AWS", match: AWS, redacted: "[REDACTED:aws-access-key:deadbeef]", offset: 0, source: "message" }, { sessionId: `session-${i}` })],
          p,
        );
      }
      for (let i = 0; i < files.length; i++) {
        const log = readFileSync(files[i], "utf8").trim();
        assert(log.length > 0, `audit ${i} written`);
        assertIncludes(log, `session-${i}`, `audit ${i} has its own session`);
        assertNotIncludes(log, AWS, `audit ${i} secret-free`);
        for (let j = 0; j < files.length; j++) {
          if (i !== j) assertNotIncludes(log, `session-${j}`, `audit ${i} excludes session-${j}`);
        }
      }
    });
  } else {
    suite.skip("concurrency.sd-*", "stranger-danger not built");
  }

  rmSync(root, { recursive: true, force: true });
  return suite.summary();
}

export const run = run_;

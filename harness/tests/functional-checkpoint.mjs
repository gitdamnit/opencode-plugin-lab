// Functional tests for Checkpoint Orchestrator.
//
// These exercise the *compiled* engine that ships in the lab package
// (/opt/lab/plugins/checkpoint-orchestrator/dist) — not a mock — covering
// SQLite initialization, checkpoint creation, multiple session IDs, restoration,
// snapshots, concurrent writes, restart recovery, the namespaced handoff
// location, and legacy-migration safeguards.
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Suite, assert, assertEquals, assertIncludes, assertNotIncludes } from "../lib/suite.mjs";
import { LAB } from "../lib/env.mjs";

const CORE = join(LAB.plugins, "checkpoint-orchestrator", "dist", "core");

export async function run({ tier = "functional" } = {}) {
  const suite = new Suite("functional/checkpoint-orchestrator", { tier });
  if (!existsSync(CORE)) {
    suite.skip("checkpoint.import", "plugin not built (missing dist/core)");
    return suite.summary();
  }

  const storeMod = await import(join(CORE, "store.js"));
  const serviceMod = await import(join(CORE, "service.js"));
  const pathsMod = await import(join(CORE, "paths.js"));
  const handoffMod = await import(join(CORE, "handoff.js"));
  const legacyMod = await import(join(CORE, "legacy.js"));
  const { CheckpointStore } = storeMod;
  const { CheckpointService, DEFAULT_SERVICE_OPTIONS } = serviceMod;

  const root = mkdtempSync(join(tmpdir(), "lab-cp-"));
  const tmp = (name) => join(root, name);
  const ref = (sessionID, extra = {}) => ({ sessionID, projectID: "proj-main", projectDirectory: tmp("proj"), ...extra });
  const newStore = (name) => new CheckpointStore(tmp(`${name}/checkpoints.db`), { historyLimit: 10 });
  const silent = { info() {}, warn() {}, error() {} };
  const newService = (store, options = {}) => new CheckpointService(store, { ...DEFAULT_SERVICE_OPTIONS, handoffEnabled: false, ...options }, silent);

  await suite.test("checkpoint.path-resolution", () => {
    const resolved = pathsMod.resolveDatabasePath(undefined, { platform: "linux", env: { XDG_DATA_HOME: "/xdg" }, home: "/home/u" });
    assertEquals(resolved, "/xdg/opencode/checkpoint-orchestrator/checkpoints.db", "xdg default");
    const override = pathsMod.resolveDatabasePath("/custom/db.sqlite", { platform: "linux", env: {}, home: "/home/u" });
    assertEquals(override, "/custom/db.sqlite", "explicit override wins");
    assert(pathsMod.resolveDatabasePath(":memory:", {}) === ":memory:", "memory passthrough");
  });

  await suite.test("checkpoint.sqlite-init", () => {
    const store = newStore("init");
    try {
      assert(existsSync(store.path), "database file created on disk");
      assert(store.journalModeInUse.length > 0, "journal mode reported");
      assertEquals(store.integrityCheck(), "ok", "integrity ok on open");
      assertEquals(store.foreignKeyCheck(), 0, "no FK violations");
      const diag = newService(store).diagnostics();
      assert(diag.schemaVersion >= 1, "schema version tracked");
      assertEquals(diag.sessions, 0, "no sessions yet");
    } finally {
      store.close();
    }
  });

  await suite.test("checkpoint.create-load-status", () => {
    const store = newStore("create");
    try {
      const service = newService(store);
      const r = ref("sess-1");
      const outcome = service.save(r, { task: { title: "T", status: "in_progress" }, completedSteps: ["a"], nextSteps: ["b"] }, { origin: "tool" });
      assert(outcome.data.task.title === "T", "saved title");
      assertEquals(service.load(r).data.completedSteps.length, 1, "completedSteps persisted");
      const status = service.status(r);
      assert(status.exists, "status reports existing checkpoint");
      assertEquals(status.status, "in_progress", "status value");
    } finally {
      store.close();
    }
  });

  await suite.test("checkpoint.multiple-session-ids", () => {
    const store = newStore("sessions");
    try {
      const service = newService(store);
      service.save(ref("sess-A"), { summary: "A", completedSteps: ["A1"] }, { origin: "tool" });
      service.save(ref("sess-B"), { summary: "B", completedSteps: ["B1", "B2"] }, { origin: "tool" });
      assertEquals(service.load(ref("sess-A")).data.summary, "A", "session A isolated");
      assertEquals(service.load(ref("sess-B")).data.summary, "B", "session B isolated");
      assertEquals(service.status(ref("sess-A")).completedSteps, 1, "A step count");
      assertEquals(service.status(ref("sess-B")).completedSteps, 2, "B step count");
      assertEquals(store.listSessionIds().length, 2, "two sessions stored");
    } finally {
      store.close();
    }
  });

  await suite.test("checkpoint.snapshots-restore", () => {
    const store = newStore("snapshots");
    try {
      const service = newService(store);
      const r = ref("sess-snap");
      service.save(r, { summary: "v1", completedSteps: ["one"] }, { origin: "tool", snapshotName: "checkpoint-v1" });
      service.save(r, { summary: "v2", completedSteps: ["one", "two"] }, { origin: "tool" });
      const list = service.listSnapshots(r);
      assert(list.some((s) => s.name === "checkpoint-v1"), "named snapshot present");
      const restored = service.restoreSnapshot(r, "checkpoint-v1");
      assert(restored.restored, `restore succeeded: ${restored.error ?? ""}`);
      assertEquals(service.load(r).data.summary, "v1", "state restored to snapshot");
      assertEquals(service.loadSnapshot(r, "checkpoint-v1").data.summary, "v1", "snapshot data");
    } finally {
      store.close();
    }
  });

  await suite.test("checkpoint.concurrent-writes", () => {
    const dbPath = tmp("concurrent/checkpoints.db");
    const stores = [new CheckpointStore(dbPath, { historyLimit: 10 }), new CheckpointStore(dbPath, { historyLimit: 10 })];
    try {
      const services = stores.map((s) => newService(s));
      const r = ref("sess-concurrent");
      for (let i = 0; i < 40; i++) {
        services[i % 2].save(r, { completedSteps: Array.from({ length: (i % 5) + 1 }, (_, k) => `step-${k}`), summary: `write-${i}` }, { origin: "periodic" });
      }
      assertEquals(stores[0].integrityCheck(), "ok", "database remains consistent after interleaved writes");
      const last = services[0].load(r);
      assert(last && last.data.summary.startsWith("write-"), "last write persisted");
    } finally {
      for (const s of stores) { try { s.close(); } catch {} }
    }
  });

  await suite.test("checkpoint.restart-recovery", () => {
    const dbPath = tmp("restart/checkpoints.db");
    const r = ref("sess-restart");
    const first = new CheckpointStore(dbPath, { historyLimit: 10 });
    newService(first).save(r, { summary: "before-restart", completedSteps: ["x"] }, { origin: "tool" });
    first.close();
    const second = new CheckpointStore(dbPath, { historyLimit: 10 });
    try {
      assertEquals(newService(second).load(r).data.summary, "before-restart", "state survives restart");
    } finally {
      second.close();
    }
  });

  // ------------------------------------------------- namespaced handoff (dev.1)
  await suite.test("checkpoint.handoff-namespaced-and-isolated", () => {
    const projectDir = tmp("handoff-project");
    const sharedState = join(projectDir, ".opencode", "state");
    mkdirSync(sharedState, { recursive: true });
    // A sibling plugin's file in the shared .opencode/state directory.
    const sibling = join(sharedState, "other-plugin.json");
    const siblingBytes = JSON.stringify({ owner: "other-plugin", keep: true });
    writeFileSync(sibling, siblingBytes);

    const store = new CheckpointStore(join(root, "handoff.db"), { historyLimit: 5 });
    try {
      const service = newService(store, { handoffEnabled: true }); // default (namespaced) handoff dir
      const r = { sessionID: "sess-handoff", projectID: "proj", projectDirectory: projectDir };
      const data = service.save(r, { task: { title: "Handoff" }, summary: "export me" }, { origin: "tool" }).data;
      const path = service.exportHandoff(r, data);

      const expected = handoffMod.handoffFilePath(projectDir, r.sessionID);
      assertEquals(path, expected, "handoff path is the namespaced per-session path");
      assert(path.includes(join(".opencode", "state", "checkpoint-orchestrator")), `handoff dir is namespaced: ${path}`);
      assert(path.endsWith(`handoff-${r.sessionID}.md`), "handoff file is per-session");
      assert(existsSync(path), "handoff file written");
      // The plugin must not write to the shared root or touch a sibling's file.
      assert(!existsSync(join(sharedState, "handoff.md")), "no legacy handoff.md written to the shared state root");
      assertEquals(readFileSync(sibling, "utf8"), siblingBytes, "sibling plugin file untouched");
    } finally {
      store.close();
    }
  });

  // ------------------------------------------------- legacy migration (dev.1)
  const legacyCheckpoint = {
    version: 2,
    updatedAt: "2026-05-13T16:48:16.000Z",
    task: { title: "Legacy task", objective: "Legacy objective", status: "in_progress" },
    summary: "Legacy summary",
    currentSteps: undefined,
    currentPlan: ["plan-1"],
    completedSteps: ["done-1"],
    nextSteps: ["next-1"],
    blockers: [],
    filesTouched: ["a.ts"],
    notes: ["note-1"],
  };

  function legacyProject(name, { checkpointRaw, historyRaw } = {}) {
    const projectDir = tmp(`${name}-project`);
    const stateDir = join(projectDir, ".opencode", "state");
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(join(stateDir, "checkpoint.json"), checkpointRaw ?? JSON.stringify(legacyCheckpoint, null, 2));
    if (historyRaw !== undefined) writeFileSync(join(stateDir, "checkpoint-history.json"), historyRaw);
    writeFileSync(join(stateDir, "handoff.md"), "# legacy handoff\n");
    return { projectDir, stateDir };
  }

  const legacyRef = (projectDir) => ({ sessionID: "ses-active", projectID: "proj-legacy", projectDirectory: projectDir });

  await suite.test("checkpoint.legacy-import-disabled-is-a-noop", () => {
    const { projectDir, stateDir } = legacyProject("legacy-off");
    const store = new CheckpointStore(join(root, "legacy-off.db"), { historyLimit: 5 });
    try {
      const result = newService(store).importLegacy(legacyRef(projectDir), false);
      assertEquals(result.imported, false, "not imported when disabled");
      assertEquals(result.reason, "disabled", "reason is disabled");
      assert(!existsSync(join(stateDir, "checkpoint-orchestrator")), "no namespace created when disabled");
    } finally {
      store.close();
    }
  });

  await suite.test("checkpoint.legacy-foreign-payload-left-alone", () => {
    // A same-named file that is not this plugin's data must never be consumed.
    const raw = JSON.stringify({ someOtherTool: true, note: "not ours" });
    const { projectDir, stateDir } = legacyProject("legacy-foreign", { checkpointRaw: raw });
    const store = new CheckpointStore(join(root, "legacy-foreign.db"), { historyLimit: 5 });
    try {
      const result = newService(store).importLegacy(legacyRef(projectDir), true);
      assertEquals(result.imported, false, "foreign payload not imported");
      assertEquals(result.reason, "unrecognized-legacy-state", "reason is unrecognized");
      assertEquals(readFileSync(join(stateDir, "checkpoint.json"), "utf8"), raw, "foreign file byte-identical");
    } finally {
      store.close();
    }
  });

  await suite.test("checkpoint.legacy-import-copies-and-backs-up", () => {
    const { projectDir, stateDir } = legacyProject("legacy-ok", {
      historyRaw: JSON.stringify({ snapshots: [{ name: "named-legacy", savedAt: "2026-05-12T10:00:00.000Z", data: legacyCheckpoint }] }),
    });
    const originalCheckpoint = readFileSync(join(stateDir, "checkpoint.json"), "utf8");
    const store = new CheckpointStore(join(root, "legacy-ok.db"), { historyLimit: 5 });
    try {
      const service = newService(store);
      const result = service.importLegacy(legacyRef(projectDir), true);
      assert(result.imported, `legacy imported (${result.reason})`);
      const legacyRefSession = { sessionID: legacyMod.legacySessionId("proj-legacy"), projectID: "proj-legacy", projectDirectory: projectDir };
      assertEquals(service.load(legacyRefSession).data.task.title, "Legacy task", "imported into the legacy namespace");
      assert(result.backedUp.length >= 1, "legacy files were backed up");
      const backupDir = join(projectDir, legacyMod.LEGACY_BACKUP_DIR);
      assert(existsSync(backupDir), "backup directory is inside the plugin namespace");
      assert(readdirSync(backupDir).length >= 1, "backup contains copies");
      assertEquals(readFileSync(join(stateDir, "checkpoint.json"), "utf8"), originalCheckpoint, "original legacy file untouched");
      // Idempotency across restarts.
      const again = service.importLegacy(legacyRef(projectDir), true);
      assertEquals(again.reason, "already-imported", "second import is a no-op");
    } finally {
      store.close();
    }
  });

  await suite.test("checkpoint.clear", () => {
    const store = newStore("clear");
    try {
      const service = newService(store);
      const r = ref("sess-clear");
      service.save(r, { summary: "to be cleared" }, { origin: "tool", snapshotName: "keepme" });
      const result = service.clear(r);
      assert(result.checkpoints >= 1, "checkpoints cleared");
      assert(!service.load(r), "no checkpoint after clear");
    } finally {
      store.close();
    }
  });

  rmSync(root, { recursive: true, force: true });
  return suite.summary();
}

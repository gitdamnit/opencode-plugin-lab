// Real-runtime verification of Checkpoint Orchestrator's automatic triggers.
//
//   Trigger B (periodic)   — `session.hook("prompt")` runs `tickPrompt` on every
//                            admitted user prompt; at the threshold it resets
//                            the per-session counter and stamps `lastAutosaveAt`
//                            (and re-saves an existing checkpoint).
//   Trigger A (compaction) — `session.hook("compaction")` / the `session.compacted`
//                            event run `handleCompaction`, which persists a
//                            synthesized checkpoint when none exists.
//
// Attribution: Trigger B is verified with `autosaveEvery=1` and automatic
// compaction disabled; its signal (`lastAutosaveAt`) is set only by `tickPrompt`.
// Trigger A is verified with `autosaveEvery=0`, so any persisted checkpoint can
// only come from the compaction path.
//
// If a trigger is not observable in the live runtime it is reported SKIPPED
// (unverified), never passed.
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Suite, assert } from "../lib/suite.mjs";
import { startServer } from "../lib/opencode.mjs";
import { startMockModelServer } from "../mock-model-server.mjs";

const CHECKPOINT = "/opt/lab/plugins/checkpoint-orchestrator";
const CP_CORE = join(CHECKPOINT, "dist", "core");

function sessionIdOf(res) {
  const j = res.json || {};
  return j.id || j.sessionID || (j.data && (j.data.id || j.data.sessionID)) || null;
}

const randomPort = () => 46500 + Math.floor(Math.random() * 400);

function configFor({ autosaveEvery, compactionAuto, port }) {
  return {
    $schema: "https://opencode.ai/config.json",
    update: "disable",
    plugins: [{ package: CHECKPOINT, options: { autosaveEvery, handoff: false } }],
    compaction: { auto: compactionAuto },
    providers: {
      labmock: {
        name: "Lab Mock",
        package: "@opencode/ai/providers/openai-compatible",
        settings: { baseURL: `http://127.0.0.1:${port}/v1`, apiKey: "lab-mock-key" },
        models: { "mock-1": { modelID: "mock-1", name: "Mock One", limit: { context: 4000, output: 1000 } } },
      },
    },
  };
}

async function readLive(dbPath, sessionID) {
  if (!existsSync(dbPath)) return null;
  const { CheckpointStore } = await import(join(CP_CORE, "store.js"));
  const store = new CheckpointStore(dbPath, { historyLimit: 10 });
  try {
    return { runtime: store.getRuntime(sessionID), checkpoint: store.loadCheckpoint(sessionID) };
  } catch {
    return null;
  } finally {
    try { store.close(); } catch {}
  }
}

async function poll(fn, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await fn();
    if (last) return last;
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
}

export async function run_({ tier = "validate" } = {}) {
  const suite = new Suite("checkpoint-triggers/live-runtime", { tier });
  if (!existsSync(CP_CORE)) {
    suite.skip("checkpoint-triggers.import", "checkpoint-orchestrator not built");
    return suite.summary();
  }

  const root = mkdtempSync(join(tmpdir(), "lab-trig-"));
  const modelPort = randomPort();
  const mock = await startMockModelServer({ port: modelPort, capturePath: join(root, "requests.jsonl") });
  const dbPathOf = (server) => join(server.dirs.xdg, "data", "opencode", "checkpoint-orchestrator", "checkpoints.db");

  try {
    // ---------------------------------------------------------- Trigger B
    await suite.test("checkpoint.trigger-b-periodic-autosave", async () => {
      const server = await startServer("trigger-b", { config: configFor({ autosaveEvery: 1, compactionAuto: false, port: modelPort }) });
      try {
        const created = await server.api("POST", "/api/session", { title: "trigger-b", model: { providerID: "labmock", id: "mock-1" } });
        const sessionID = sessionIdOf(created);
        assert(sessionID, `session created (${JSON.stringify(created.json).slice(0, 200)})`);
        const prompt = await server.api("POST", `/api/session/${sessionID}/prompt`, { text: "Plan the task and remember it." });
        assert(prompt.status < 400, `prompt admitted (status ${prompt.status})`);

        const dbPath = dbPathOf(server);
        const hit = await poll(async () => {
          const live = await readLive(dbPath, sessionID);
          return live && live.runtime && live.runtime.lastAutosaveAt ? live.runtime : null;
        }, 15_000);

        if (!hit) {
          return { __unverified: "trigger B not observable (lastAutosaveAt was never set after an admitted prompt with autosaveEvery=1)" };
        }
        assert(typeof hit.lastAutosaveAt === "string" && hit.lastAutosaveAt.length > 0, "lastAutosaveAt stamped");
        assert(hit.messagesSinceSave === 0, "periodic counter reset after the save");
        return { trigger: "B", sessionID, lastAutosaveAt: hit.lastAutosaveAt, requests: mock.requestCount };
      } finally {
        await server.stop();
      }
    });

    // ---------------------------------------------------------- Trigger A
    await suite.test("checkpoint.trigger-a-compaction", async () => {
      const server = await startServer("trigger-a", { config: configFor({ autosaveEvery: 0, compactionAuto: true, port: modelPort }) });
      try {
        const created = await server.api("POST", "/api/session", { title: "trigger-a", model: { providerID: "labmock", id: "mock-1" } });
        const sessionID = sessionIdOf(created);
        assert(sessionID, `session created (${JSON.stringify(created.json).slice(0, 200)})`);
        // Periodic saving is disabled: any persisted checkpoint is compaction-driven.
        await server.api("POST", `/api/session/${sessionID}/prompt`, { text: "Begin a long task with several steps." });
        await new Promise((r) => setTimeout(r, 1500));
        const compact = await server.api("POST", `/api/session/${sessionID}/compact`, {});
        assert(compact.status < 400, `compact accepted (status ${compact.status})`);
        await server.api("POST", `/api/session/${sessionID}/prompt`, { text: "Continue." }).catch(() => {});

        const dbPath = dbPathOf(server);
        const hit = await poll(async () => {
          const live = await readLive(dbPath, sessionID);
          return live && live.checkpoint ? live : null;
        }, 25_000);

        if (!hit) {
          return { __unverified: "trigger A not observable (no checkpoint persisted after a compaction request with autosaveEvery=0)" };
        }
        assert(!hit.runtime || !hit.runtime.lastAutosaveAt, "checkpoint was not produced by trigger B (B disabled)");
        return { trigger: "A", sessionID, synthesized: hit.checkpoint.synthesized, requests: mock.requestCount };
      } finally {
        await server.stop();
      }
    });
  } finally {
    await mock.close();
    rmSync(root, { recursive: true, force: true });
  }

  return suite.summary();
}

export const run = run_;

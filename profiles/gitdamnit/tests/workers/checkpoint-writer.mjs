// Worker: write checkpoints for one session against a shared SQLite database.
// Usage: node checkpoint-writer.mjs <dbPath> <sessionID> <count> <projectDir>
import { CheckpointStore } from "/opt/lab/plugins/checkpoint-orchestrator/dist/core/store.js";
import { CheckpointService, DEFAULT_SERVICE_OPTIONS } from "/opt/lab/plugins/checkpoint-orchestrator/dist/core/service.js";

const [, , dbPath, sessionID, countStr, projectDir] = process.argv;
const count = Number(countStr || 10);

const store = new CheckpointStore(dbPath, { historyLimit: 100 });
const service = new CheckpointService(store, { ...DEFAULT_SERVICE_OPTIONS, handoffEnabled: false }, { info() {}, warn() {}, error() {} });
const ref = { sessionID, projectID: "concurrent-proj", projectDirectory: projectDir || "/tmp" };

for (let i = 0; i < count; i++) {
  service.save(
    ref,
    { summary: `${sessionID}-write-${i}`, completedSteps: Array.from({ length: (i % 4) + 1 }, (_, k) => `step-${k}`) },
    { origin: "periodic" },
  );
}
store.close();
console.log(JSON.stringify({ sessionID, wrote: count }));

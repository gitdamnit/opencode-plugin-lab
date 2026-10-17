// Generic process cleanup.
//
// Boots the runtime for the widest configuration, then shuts it down and asserts
// that the server process really stopped: the port is no longer accepting
// connections and no child process is left running out of the run directory.
import { execFileSync } from "node:child_process";
import { Suite, assert } from "../lib/suite.mjs";
import { CONFIGS, LAB } from "../lib/env.mjs";
import { startServer } from "../lib/opencode.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function widestConfigName() {
  let best = null;
  for (const c of Object.values(CONFIGS)) if (!best || c.plugins.length > best.plugins.length) best = c;
  return best?.name || "baseline";
}

function processesUnder(dir) {
  try {
    const out = execFileSync("ps", ["-eo", "pid=,args="], { encoding: "utf8" });
    return out
      .split("\n")
      .filter((l) => l.includes(dir) && !l.includes("ps -eo"))
      .map((l) => l.trim());
  } catch {
    return [];
  }
}

export async function run({ tier = "validate" } = {}) {
  const suite = new Suite("process-cleanup/graceful-shutdown", { tier });
  const config = widestConfigName();
  const runDir = `${LAB.work}/runs/${config}`;

  let server;
  try {
    server = await startServer(config, { readyTimeoutMs: 60_000 });
  } catch (error) {
    suite.skip("process-cleanup.boot", `could not start server: ${error.message}`);
    return suite.summary();
  }
  const port = server.port;

  await suite.test("process-cleanup.server-alive", async () => {
    const info = await server.api("GET", "/api/info");
    assert(info.ok, "server responds before shutdown");
    return { port };
  });

  const stopResult = await suite.test("process-cleanup.shutdown-exits", async () => {
    const res = await server.stop();
    assert(res.code !== null || res.alreadyExited, `server process exited (${JSON.stringify(res)})`);
    return res;
  });

  await suite.test("process-cleanup.port-released", async () => {
    await sleep(400);
    let refused = false;
    try {
      await fetch(`http://127.0.0.1:${port}/api/info`);
    } catch {
      refused = true;
    }
    assert(refused, `port ${port} no longer accepts connections`);
    return { port, refused };
  });

  await suite.test("process-cleanup.no-orphans", async () => {
    const orphanCandidates = processesUnder(runDir);
    assert(orphanCandidates.length === 0, `no processes left under ${runDir} (found: ${orphanCandidates.join(" | ")})`);
    return { runDir, orphans: 0 };
  });

  void stopResult;
  return suite.summary();
}

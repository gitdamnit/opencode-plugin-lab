// Offline model-request path test.
//
// Runs the REAL `opencode run` agent loop against a local OpenAI-compatible
// mock provider (loopback only — no outbound network), then inspects the exact
// request body OpenCode sent. This exercises the supported request path rather
// than assuming protection from unit tests:
//
//   * baseline / plugins without stranger-danger -> the synthetic secret IS
//     present in the transmitted request (control: the path really transmits).
//   * configurations with stranger-danger -> the secret is absent and a
//     redaction token is present (protection on the real path).
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Suite, assert, assertEquals, assertIncludes, assertNotIncludes } from "../lib/suite.mjs";
import { CONFIGS, LAB } from "../lib/env.mjs";
import { runAsync } from "../lib/exec.mjs";
import { startMockModelServer } from "../mock-model-server.mjs";

const SYNTHETIC_SECRET = "AKIAIOSFODNN7EXAMPLE";
const PROMPT = `Please remember this API key for later: ${SYNTHETIC_SECRET}`;

function randomPort() {
  return 46200 + Math.floor(Math.random() * 500);
}

export async function run_({ config, tier = "model" } = {}) {
  const suite = new Suite(`model-path/${config}`, { tier, config });
  const cfg = CONFIGS[config];
  if (!cfg) {
    suite.skip("model-path.config", `unknown config ${config}`);
    return suite.summary();
  }

  const root = mkdtempSync(join(tmpdir(), `lab-model-${config}-`));
  const port = randomPort();
  const capturePath = join(root, "model-requests.jsonl");
  let mock = null;

  try {
    mock = await startMockModelServer({ port, capturePath });

    const project = join(root, "project");
    mkdirSync(join(project, ".opencode"), { recursive: true });
    const plugins = cfg.plugins.map((name) => ({ package: `/opt/lab/plugins/${name}`, options: {} }));
    const configJson = {
      $schema: "https://opencode.ai/config.json",
      update: "disable",
      plugins,
      providers: {
        labmock: {
          name: "Lab Mock",
          package: "@opencode/ai/providers/openai-compatible",
          settings: { baseURL: `http://127.0.0.1:${port}/v1`, apiKey: "lab-mock-key" },
          models: { "mock-1": { modelID: "mock-1", name: "Mock One", limit: { context: 8000, output: 2000 } } },
        },
      },
    };
    writeFileSync(join(project, "opencode.json"), JSON.stringify(configJson, null, 2));
    writeFileSync(join(project, "AGENTS.md"), "# Lab model-path project\n");

    const env = {
      HOME: join(root, "home"),
      XDG_CONFIG_HOME: join(root, "xdg", "config"),
      XDG_DATA_HOME: join(root, "xdg", "data"),
      XDG_CACHE_HOME: join(root, "xdg", "cache"),
      OPENCODE_DISABLE_AUTOUPDATE: "1",
      CI: "1",
    };
    for (const d of [env.HOME, env.XDG_CONFIG_HOME, env.XDG_DATA_HOME, env.XDG_CACHE_HOME]) mkdirSync(d, { recursive: true });

    // runAsync (not spawnSync): the mock provider runs in this same process and
    // must stay responsive while `opencode run` is executing.
    const result = await runAsync("opencode", ["run", "--standalone", "--auto", "-m", "labmock/mock-1", PROMPT], {
      cwd: project,
      env,
      timeoutMs: 150_000,
    });
    const combined = result.stdout + result.stderr;

    await suite.test("model.run-completes", () => {
      assertEquals(result.code, 0, `opencode run exit 0 (stderr: ${result.stderr.slice(-400)})`);
      assertMatchLoose(combined, "OK", "agent produced a completion");
      return { stdoutTail: result.stdout.slice(-200) };
    });

    await suite.test("model.request-reached-provider", () => {
      assert(mock.requestCount >= 1, `mock provider received ${mock.requestCount} request(s)`);
      return { requestCount: mock.requestCount };
    });

    const captured = existsSync(capturePath) ? readFileSync(capturePath, "utf8") : "";
    const includesStrangerDanger = cfg.plugins.includes("stranger-danger");

    if (includesStrangerDanger) {
      await suite.test("model.secret-redacted-before-transmission", () => {
        assert(captured.length > 0, "request body captured");
        assertNotIncludes(captured, SYNTHETIC_SECRET, "raw synthetic secret absent from model request");
        assertIncludes(captured, "REDACTED", "redaction token present in model request");
        return { bytes: captured.length };
      });
    } else {
      await suite.test("model.control-transmits-secret", () => {
        // Control: without stranger-danger the secret is transmitted, proving
        // the test actually observes the supported request path.
        assert(captured.length > 0, "request body captured");
        assertIncludes(captured, SYNTHETIC_SECRET, "control config transmits the secret (path is real)");
        return { bytes: captured.length };
      });
    }
  } finally {
    if (mock) await mock.close();
    rmSync(root, { recursive: true, force: true });
  }

  return suite.summary();
}

function assertMatchLoose(haystack, needle, message) {
  if (!haystack.includes(needle)) throw new Error(`${message}: expected ${JSON.stringify(needle)}`);
}

// Offline model-request path test (generic).
//
// Runs the REAL `opencode run` agent loop against a local OpenAI-compatible mock
// provider (loopback only — no outbound network), then inspects the exact request
// body OpenCode sent. This exercises the supported request path rather than
// assuming protection from unit tests:
//
//   * configurations whose plugins declare capabilities.redaction -> the synthetic
//     secret must be absent and a redaction token present
//   * every other configuration -> control: the secret IS present in the
//     transmitted request, proving the capture path really observes traffic
//
// The control branch is the honesty mechanism: if the capture path were broken,
// the control would fail.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Suite, assert, assertEquals, assertIncludes, assertNotIncludes } from "../lib/suite.mjs";
import { CONFIGS, PLUGINS } from "../lib/env.mjs";
import { runAsync } from "../lib/exec.mjs";
import { startMockModelServer } from "../mock-model-server.mjs";

const SYNTHETIC_SECRET = "AKIAIOSFODNN7EXAMPLE";
const PROMPT = `Please remember this API key for later: ${SYNTHETIC_SECRET}`;

const randomPort = () => 46200 + Math.floor(Math.random() * 500);

export async function run({ config, tier = "model" } = {}) {
  const suite = new Suite(`model-path/${config}`, { tier, config });
  const cfg = CONFIGS[config];
  if (!cfg) {
    suite.skip("model-path.config", `unknown config ${config}`);
    return suite.summary();
  }
  const loaded = cfg.plugins.map((n) => PLUGINS[n]).filter(Boolean);
  const expectsRedaction = loaded.some((p) => p.capabilities.redaction);

  const root = mkdtempSync(join(tmpdir(), `lab-model-${config}-`));
  const port = randomPort();
  const capturePath = join(root, "model-requests.jsonl");
  let mock = null;

  try {
    mock = await startMockModelServer({ port, capturePath });

    const project = join(root, "project");
    mkdirSync(join(project, ".opencode"), { recursive: true });
    const plugins = cfg.plugins.map((name) => ({ package: PLUGINS[name].packageDir, options: { ...PLUGINS[name].options, ...(cfg.options[name] || {}) } }));
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
      assert(combined.includes("OK"), "agent produced a completion");
      return { stdoutTail: result.stdout.slice(-200) };
    });

    await suite.test("model.request-reached-provider", () => {
      assert(mock.requestCount >= 1, `mock provider received ${mock.requestCount} request(s)`);
      return { requestCount: mock.requestCount };
    });

    const captured = existsSync(capturePath) ? readFileSync(capturePath, "utf8") : "";

    if (expectsRedaction) {
      await suite.test("model.secret-redacted-before-transmission", () => {
        assert(captured.length > 0, "request body captured");
        assertNotIncludes(captured, SYNTHETIC_SECRET, "raw synthetic secret absent from model request");
        assertIncludes(captured, "REDACTED", "redaction token present in model request");
        return { bytes: captured.length };
      });
    } else if (captured.includes("REDACTED") && !captured.includes(SYNTHETIC_SECRET)) {
      // The plugin clearly transforms the request, but did not declare
      // capabilities.redaction. Report it honestly rather than failing a control
      // that assumed no transformation.
      suite.skip(
        "model.redaction",
        "plugin appears to redact the request but did not declare capabilities.redaction; declare it to assert strictly",
      );
    } else {
      await suite.test("model.control-transmits-secret", () => {
        assert(captured.length > 0, "request body captured");
        assertIncludes(captured, SYNTHETIC_SECRET, "control config transmits the secret (path is real)");
        return { bytes: captured.length };
      });
      suite.skip("model.redaction", "no plugin in this configuration declares capabilities.redaction");
    }
  } finally {
    if (mock) await mock.close();
    rmSync(root, { recursive: true, force: true });
  }

  return suite.summary();
}

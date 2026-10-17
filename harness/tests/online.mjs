// Optional online model-request test.
//
// DISABLED BY DEFAULT. Only runs when `--online` is passed AND a dedicated test
// credential is supplied via the environment (LAB_TEST_API_KEY / LAB_TEST_MODEL).
// Credentials are read ONLY from the environment — never from the host OpenCode
// installation (~/.config/opencode, auth.json, ~/.local/share/opencode).
//
// This verifies reachability of the real provider. It deliberately does NOT
// claim to verify outbound redaction: without a capture proxy the lab cannot
// observe the transmitted bytes. The offline `model-path` suite (local mock
// provider) is what verifies redaction on the supported request path.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Suite, assert, assertEquals } from "../lib/suite.mjs";
import { CONFIGS } from "../lib/env.mjs";
import { run } from "../lib/exec.mjs";

const PROVIDER_ENV = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  "google-vertex": "GOOGLE_APPLICATION_CREDENTIALS",
  groq: "GROQ_API_KEY",
  mistral: "MISTRAL_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

export async function run_({ config = "baseline", tier = "online" } = {}) {
  const suite = new Suite(`online-model/${config}`, { tier, config });
  const key = process.env.LAB_TEST_API_KEY;
  const model = process.env.LAB_TEST_MODEL;

  if (!key || !model) {
    suite.skip("online.credential", "disabled: set LAB_TEST_API_KEY and LAB_TEST_MODEL and pass --online");
    suite.skip("online.request-path", "not run (separate from offline functional validation)");
    return suite.summary();
  }

  const provider = process.env.LAB_TEST_PROVIDER || String(model).split("/")[0];
  const envVar = PROVIDER_ENV[provider] || `${provider.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_API_KEY`;
  const cfg = CONFIGS[config] || CONFIGS.baseline;

  const root = mkdtempSync(join(tmpdir(), `lab-online-${config}-`));
  const project = join(root, "project");
  mkdirSync(join(project, ".opencode"), { recursive: true });
  writeFileSync(
    join(project, "opencode.json"),
    JSON.stringify(
      { $schema: "https://opencode.ai/config.json", update: "disable", plugins: cfg.plugins.map((n) => ({ package: `/opt/lab/plugins/${n}`, options: {} })) },
      null,
      2,
    ),
  );
  const env = {
    HOME: join(root, "home"),
    XDG_CONFIG_HOME: join(root, "xdg", "config"),
    XDG_DATA_HOME: join(root, "xdg", "data"),
    XDG_CACHE_HOME: join(root, "xdg", "cache"),
    OPENCODE_DISABLE_AUTOUPDATE: "1",
    CI: "1",
    [envVar]: key,
  };
  for (const d of [env.HOME, env.XDG_CONFIG_HOME, env.XDG_DATA_HOME, env.XDG_CACHE_HOME]) mkdirSync(d, { recursive: true });

  await suite.test("online.model-reachable", () => {
    const res = run("opencode", ["run", "--standalone", "--auto", "-m", model, "Reply with the single word: OK"], {
      cwd: project,
      env,
      timeoutMs: 180_000,
    });
    assertEquals(res.code, 0, `opencode run exit 0 (stderr: ${res.stderr.slice(-400)})`);
    assert(/OK/i.test(res.stdout), "provider returned a completion");
    return { provider, credentialEnvVar: envVar, note: "credential value never logged" };
  });

  suite.skip(
    "online.outbound-redaction",
    "not verified online without a capture proxy; verified offline by the model-path suite against the supported request path",
  );

  rmSync(root, { recursive: true, force: true });
  return suite.summary();
}

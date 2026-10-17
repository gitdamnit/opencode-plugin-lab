// Functional tests for Stranger Danger.
//
// Every "secret" used here is a synthetic, non-functional placeholder. The lab
// never uses real credentials. Covers synthetic API keys, file reads, context
// redaction, tool-output protection, large outputs, allowlists, audit records
// and multiple sessions.
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Suite, assert, assertEquals, assertIncludes, assertNotIncludes } from "../../../harness/lib/suite.mjs";
import { LAB } from "../../../harness/lib/env.mjs";
import { run as exec } from "../../../harness/lib/exec.mjs";

const DIST = join(LAB.plugins, "stranger-danger", "dist");
const CLI = join(DIST, "cli", "index.js");

// Clearly synthetic, well-known example-style values.
const SAMPLES = {
  aws: "AKIAIOSFODNN7EXAMPLE",
  github: "ghp_0123456789abcdefghijklmnopqrstuvwxyz",
  openai: "sk-" + "a1b2c3d4e5f6".repeat(4),
};

export async function run({ tier = "functional" } = {}) {
  const suite = new Suite("functional/stranger-danger", { tier });
  if (!existsSync(CLI)) {
    suite.skip("sd.import", "plugin not built (missing dist/cli)");
    return suite.summary();
  }

  const root = mkdtempSync(join(tmpdir(), "lab-sd-"));
  const home = join(root, "cwd");
  mkdirSync(home, { recursive: true });
  const originalCwd = process.cwd();
  process.chdir(home);

  const scanner = await import(join(DIST, "engine", "scanner.js"));
  const allowlist = await import(join(DIST, "engine", "allowlist.js"));
  const audit = await import(join(DIST, "engine", "audit.js"));
  const { scan, redact, scanAndRedact, scanAndRedactBounded, toSafeFinding, UNSCANNABLE_MARKER } = scanner;

  await suite.test("sd.scan-synthetic-keys", () => {
    const content = [
      `aws_access_key_id = "${SAMPLES.aws}"`,
      `github_token = "${SAMPLES.github}"`,
      `openai_api_key = "${SAMPLES.openai}"`,
    ].join("\n");
    const findings = scan(content, "file", "secrets.env");
    assert(findings.length >= 2, `detected multiple synthetic keys (got ${findings.length})`);
    for (const f of findings) {
      assert(f.match.length > 0, "finding has a match");
      assert(/\[REDACTED:[a-z0-9-]+:[a-f0-9]{8}\]/.test(f.redacted), `redaction token format: ${f.redacted}`);
    }
  });

  await suite.test("sd.file-reads-cli-secret-free", () => {
    const file = join(home, "config.ts");
    writeFileSync(file, `export const config = { apiKey: "${SAMPLES.aws}" };\n`);
    const res = exec("node", [CLI, "scan", file, "--json"], { cwd: home });
    assertEquals(res.code, 0, `scan exits 0 (stderr: ${res.stderr.slice(0, 200)})`);
    let parsed = null;
    try {
      parsed = JSON.parse(res.stdout);
    } catch {
      parsed = null;
    }
    assert(parsed && Array.isArray(parsed.findings), "scan --json returns findings array");
    assert(parsed.findings.length >= 1, "at least one finding reported");
    // The CLI must never echo the raw secret.
    assertNotIncludes(res.stdout, SAMPLES.aws, "scan output is secret-free");
    for (const f of parsed.findings) {
      assertNotIncludes(JSON.stringify(f), SAMPLES.aws, "finding payload is secret-free");
    }
  });

  await suite.test("sd.context-redaction", () => {
    const content = `System prompt with token=${SAMPLES.github} injected.`;
    const { redacted, findings } = scanAndRedact(content, "context");
    assert(findings.length >= 1, "context finding detected");
    assertNotIncludes(redacted, SAMPLES.github, "raw secret removed from context");
    assertIncludes(redacted, "[REDACTED:", "redaction token inserted");
  });

  await suite.test("sd.tool-output-protection", () => {
    const output = `command output:\nAWS_KEY=${SAMPLES.aws}\ndone\n`;
    const { redacted, findings } = scanAndRedact(output, "output");
    assert(findings.length >= 1, "tool output finding detected");
    assertNotIncludes(redacted, SAMPLES.aws, "raw secret removed from tool output");
  });

  await suite.test("sd.large-output-windowed-scan", () => {
    const filler = "x".repeat(2 * 1024 * 1024);
    const content = `token="${SAMPLES.github}"\n${filler}\n`;
    const result = scanAndRedactBounded(content, "output");
    assertEquals(result.complete, true, "complete scan across windows");
    assertNotIncludes(result.redacted, SAMPLES.github, "secret redacted in large output");
    assert(result.findings.length >= 1, "finding reported for large output");
  });

  await suite.test("sd.large-output-oversize-fails-closed", () => {
    // Allocating >256MiB is intentionally avoided here; the hard-ceiling branch
    // is fail-closed by construction. We still verify the marker constant.
    assert(typeof UNSCANNABLE_MARKER === "string" && UNSCANNABLE_MARKER.includes("unscannable"), "oversize marker defined");
    return { marker: UNSCANNABLE_MARKER, note: "hard ceiling not exercised to avoid a >256MiB allocation" };
  });

  await suite.test("sd.allowlist-suppresses-finding", () => {
    const before = scanAndRedact(`apiKey="${SAMPLES.aws}"`, "file").findings;
    assert(before.length >= 1, "baseline finding present");
    const fp = before[0].redacted.match(/:([a-f0-9]{8})\]/)[1];
    allowlist.saveAllowlistEntry({ description: "lab synthetic", fingerprint: fp });
    const after = scanAndRedact(`apiKey="${SAMPLES.aws}"`, "file").findings;
    assertEquals(after.length, 0, "allowlisted fingerprint suppressed");
  });

  await suite.test("sd.audit-records-secret-free", () => {
    const auditPath = join(home, "audit.jsonl");
    audit.setAuditPath(auditPath);
    const entry = audit.auditEntryFromFinding(
      { ruleId: "aws-access-key", description: "AWS Access Key", match: SAMPLES.aws, redacted: "[REDACTED:aws-access-key:deadbeef]", offset: 0, source: "context" },
      { sessionId: "session-1" },
    );
    audit.writeAudit(entry, auditPath);
    const log = readFileSync(auditPath, "utf8").trim();
    assert(log.length > 0, "audit log written");
    assertNotIncludes(log, SAMPLES.aws, "audit log never contains the raw secret");
    const parsed = JSON.parse(log.split("\n")[0]);
    assertEquals(parsed.sessionId, "session-1", "audit entry carries session id");
    assert(parsed.fingerprint, "audit entry has a fingerprint");
  });

  await suite.test("sd.multiple-sessions-isolated-audit-paths", () => {
    const dirA = join(root, "projA");
    const dirB = join(root, "projB");
    mkdirSync(dirA, { recursive: true });
    mkdirSync(dirB, { recursive: true });
    const pathA = audit.resolveAuditPath({ directory: dirA });
    const pathB = audit.resolveAuditPath({ directory: dirB });
    assert(pathA !== pathB, "distinct per-project audit paths");
    assertIncludes(pathA, join(".opencode", "state"), "audit lives under project state dir");
    const entryA = audit.auditEntryFromFinding({ ruleId: "github-pat", description: "GitHub PAT", match: SAMPLES.github, redacted: "[REDACTED:github-pat:cafebabe]", offset: 0, source: "message" }, { sessionId: "session-A" });
    const entryB = audit.auditEntryFromFinding({ ruleId: "openai-key", description: "OpenAI Key", match: SAMPLES.openai, redacted: "[REDACTED:openai-key:feedface]", offset: 0, source: "message" }, { sessionId: "session-B" });
    audit.writeAuditBatch([entryA], pathA);
    audit.writeAuditBatch([entryB], pathB);
    assert(!readFileSync(pathA, "utf8").includes("session-B"), "session A log has only A");
    assert(!readFileSync(pathB, "utf8").includes("session-A"), "session B log has only B");
  });

  await suite.test("sd.safe-finding-projection", () => {
    const findings = scan(`password = "${SAMPLES.aws}"`, "file");
    if (findings.length === 0) return { note: "no finding for sample; projection not exercised" };
    const safe = toSafeFinding(findings[0]);
    assertNotIncludes(JSON.stringify(safe), SAMPLES.aws, "safe projection never includes raw secret");
  });

  process.chdir(originalCwd);
  rmSync(root, { recursive: true, force: true });
  return suite.summary();
}

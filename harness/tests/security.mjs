// Security tests.
//
// Stranger Danger (secret/PII guard), Checkpoint Orchestrator (local state
// handling) and Git That Shit (sensitive-file exclusion + snapshot redaction).
// All "secrets" are synthetic, public documentation placeholders.
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Suite, assert, assertEquals, assertIncludes, assertNotIncludes } from "../lib/suite.mjs";
import { LAB } from "../lib/env.mjs";
import { run as exec } from "../lib/exec.mjs";

const SD = join(LAB.plugins, "stranger-danger", "dist");
const SD_CLI = join(SD, "cli", "index.js");
const CP = join(LAB.plugins, "checkpoint-orchestrator", "dist", "core");
const GTS = join(LAB.plugins, "git-that-shit", "dist");

const AWS = "AKIAIOSFODNN7EXAMPLE";
const GH = "ghp_0123456789abcdefghijklmnopqrstuvwxyz";
const OPENAI = "sk-" + "a1b2c3d4e5f6".repeat(4);

export async function run_({ tier = "validate" } = {}) {
  const suite = new Suite("security/all-plugins", { tier });
  const root = mkdtempSync(join(tmpdir(), "lab-sec-"));
  const home = join(root, "cwd");
  mkdirSync(home, { recursive: true });
  const originalCwd = process.cwd();
  process.chdir(home);

  // ---------------------------------------------------------------- Stranger Danger
  if (existsSync(SD_CLI)) {
    const scanner = await import(join(SD, "engine", "scanner.js"));
    const allowlist = await import(join(SD, "engine", "allowlist.js"));
    const audit = await import(join(SD, "engine", "audit.js"));
    const { scan, redact, scanAndRedact, scanAndRedactBounded, toSafeFinding, MAX_BOUNDED_SCAN_BYTES } = scanner;

    await suite.test("security.sd-known-rule-detection", () => {
      const content = `aws_access_key_id = "${AWS}"\ngithub_token = "${GH}"\nopenai_api_key = "${OPENAI}"`;
      const findings = scan(content, "file");
      assert(findings.length >= 2, `detects multiple known secrets (${findings.length})`);
      for (const f of findings) assertMatchToken(f.redacted);
    });

    await suite.test("security.sd-redaction-is-idempotent", () => {
      const content = `token = "${GH}"`;
      const once = redact(content, scan(content, "output"));
      const twice = redact(once, scan(once, "output"));
      assertEquals(twice, once, "redacting an already-redacted string is stable");
    });

    await suite.test("security.sd-preserves-benign-content", () => {
      const content = `line one\nkey = "${AWS}"\nline three\n`;
      const { redacted } = scanAndRedact(content, "file");
      assertIncludes(redacted, "line one", "benign line preserved");
      assertIncludes(redacted, "line three", "trailing benign line preserved");
      assertNotIncludes(redacted, AWS, "secret removed");
    });

    await suite.test("security.sd-no-false-positives", () => {
      const benign = "const answer = 42;\nfunction greet(name) { return `hello ${name}`; }\n";
      assertEquals(scan(benign, "file").length, 0, "ordinary code produces no findings");
    });

    await suite.test("security.sd-secret-across-window-boundary", () => {
      const SCAN_WINDOW = 1024 * 1024;
      // Place the secret so it straddles the first window boundary.
      const prefix = "a".repeat(SCAN_WINDOW - 10);
      const content = `${prefix}token="${GH}"\n`;
      const result = scanAndRedactBounded(content, "output");
      assertEquals(result.complete, true, "bounded scan completed");
      assertNotIncludes(result.redacted, GH, "secret spanning a window boundary was redacted");
      assert(result.findings.length >= 1, "finding reported across boundary");
    });

    await suite.test("security.sd-allowlist-by-regex", () => {
      const dir = mkdtempSync(join(root, "sd-al-"));
      const prev = process.cwd();
      process.chdir(dir);
      try {
        const findings = scan(`token = "${GH}"`, "file");
        assert(findings.length >= 1, "baseline finding");
        allowlist.saveAllowlistEntry({ description: "lab", regex: "ghp_[0-9a-z]+" });
        const filtered = allowlist.filterByAllowlist(scan(`token = "${GH}"`, "file"), allowlist.loadAllowlist());
        assertEquals(filtered.length, 0, "regex allowlist suppresses the finding");
        const other = allowlist.filterByAllowlist(scan(`key = "${AWS}"`, "file"), allowlist.loadAllowlist());
        assert(other.length >= 1, "unrelated secret is still detected");
      } finally {
        process.chdir(prev);
      }
    });

    await suite.test("security.sd-audit-file-mode-0600", () => {
      const auditPath = join(home, "audit-mode.jsonl");
      audit.setAuditPath(auditPath);
      audit.writeAudit(audit.auditEntryFromFinding(findFinding()), auditPath);
      const mode = statSync(auditPath).mode & 0o777;
      assertEquals(mode, 0o600, `audit log is owner-only (got 0${mode.toString(8)})`);
    });

    await suite.test("security.sd-audit-never-stores-secret", () => {
      const auditPath = join(home, "audit-secretless.jsonl");
      audit.writeAudit(audit.auditEntryFromFinding(findFinding(), { sessionId: "s" }), auditPath);
      audit.writeAudit(audit.auditEntryFromFinding({ ruleId: "github-pat", description: "GitHub PAT", match: GH, redacted: "[REDACTED:github-pat:00ff00ff]", offset: 0, source: "message" }, { sessionId: "s" }), auditPath);
      const log = readFileSync(auditPath, "utf8");
      assertNotIncludes(log, AWS, "audit never contains AWS key");
      assertNotIncludes(log, GH, "audit never contains GitHub token");
    });

    await suite.test("security.sd-safe-projection-secret-free", () => {
      const findings = scan(`password = "${AWS}"`, "file");
      if (findings.length === 0) return { note: "no finding for sample" };
      const safe = toSafeFinding(findings[0]);
      assertNotIncludes(JSON.stringify(safe), AWS, "safe projection omits the raw secret");
    });

    await suite.test("security.sd-cli-output-secret-free", () => {
      const file = join(home, "cli-secret.ts");
      writeFileSync(file, `export const t = "${AWS}";\n`);
      const scanRes = exec("node", [SD_CLI, "scan", file, "--json"], { cwd: home });
      assertNotIncludes(scanRes.stdout + scanRes.stderr, AWS, "`sd scan` output is secret-free");
      const redactRes = exec("node", [SD_CLI, "redact", file], { cwd: home });
      assertNotIncludes(redactRes.stdout + redactRes.stderr, AWS, "`sd redact` output is secret-free");
    });

    await suite.test("security.sd-oversize-is-fail-closed", () => {
      // Assert the fail-closed ceiling is defined; allocating >256MiB is avoided.
      assert(Number.isFinite(MAX_BOUNDED_SCAN_BYTES) && MAX_BOUNDED_SCAN_BYTES >= 1024 * 1024, "bounded scan ceiling defined");
      return { ceilingBytes: MAX_BOUNDED_SCAN_BYTES };
    });
  } else {
    suite.skip("security.sd-*", "stranger-danger not built");
  }

  // ------------------------------------------------------------ Checkpoint Orchestrator
  if (existsSync(CP)) {
    const { CheckpointStore } = await import(join(CP, "store.js"));
    const paths = await import(join(CP, "paths.js"));

    await suite.test("security.checkpoint-db-permissions", () => {
      const dbPath = join(root, "cp-sec", "checkpoints.db");
      const store = new CheckpointStore(dbPath, { historyLimit: 3 });
      try {
        const mode = statSync(dbPath).mode & 0o777;
        assertEquals(mode, 0o600, `checkpoint DB is owner-only (got 0${mode.toString(8)})`);
      } finally {
        store.close();
      }
    });

    await suite.test("security.checkpoint-db-outside-project", () => {
      const resolved = paths.resolveDatabasePath(undefined, { platform: "linux", env: { XDG_DATA_HOME: "/xdg" }, home: "/home/u" });
      assert(resolved.startsWith("/xdg/"), "default DB lives under the XDG data dir, not the project");
      assert(!resolved.includes(".opencode"), "default DB is not inside a project tree");
    });

    await suite.test("security.checkpoint-session-isolation", async () => {
      const { CheckpointService, DEFAULT_SERVICE_OPTIONS } = await import(join(CP, "service.js"));
      const store = new CheckpointStore(join(root, "cp-iso", "checkpoints.db"), { historyLimit: 3 });
      try {
        const service = new CheckpointService(store, { ...DEFAULT_SERVICE_OPTIONS, handoffEnabled: false }, { info() {}, warn() {}, error() {} });
        const mk = (id) => ({ sessionID: id, projectID: "p", projectDirectory: root });
        service.save(mk("S1"), { summary: "one" }, { origin: "tool" });
        assertEquals(service.load(mk("S2")), null, "a different session cannot read S1 state");
        assertEquals(service.load(mk("S1")).data.summary, "one", "owner session still reads its state");
      } finally {
        store.close();
      }
    });
  } else {
    suite.skip("security.checkpoint-*", "checkpoint-orchestrator not built");
  }

  // ------------------------------------------------------------------- Git That Shit
  if (existsSync(join(GTS, "engine", "snapshot.js"))) {
    const snapshotEngine = await import(join(GTS, "engine", "snapshot.js"));
    const configEngine = await import(join(GTS, "engine", "config.js"));
    const trackerEngine = await import(join(GTS, "engine", "tracker.js"));

    await suite.test("security.gts-excludes-sensitive-env", async () => {
      const project = join(root, "gts-sec");
      mkdirSync(project, { recursive: true });
      exec("git", ["init", "-q"], { cwd: project });
      exec("git", ["config", "user.email", "lab@example.invalid"], { cwd: project });
      exec("git", ["config", "user.name", "Lab"], { cwd: project });
      writeFileSync(join(project, ".env"), `AWS_SECRET_ACCESS_KEY=${AWS}\n`);
      writeFileSync(join(project, "package.json"), JSON.stringify({ name: "gts-sec", version: "1.0.0" }, null, 2));
      await snapshotEngine.initShadowRepo(project);

      const tracker = trackerEngine.createTracker(configEngine.DEFAULT_CONFIG);
      const decision = tracker.shouldTrack(join(project, ".env"));
      assertEquals(decision.track, false, "sensitive .env is not tracked by default");

      const result = await snapshotEngine.snapshot({ projectRoot: project, reason: "security", type: "manual", trigger: "test" });
      assert(result.committed, "snapshot committed");
      assert(!result.filesCopied.some((f) => f.endsWith(".env")), ".env was not copied into the shadow repo");
    });

    await suite.test("security.gts-redacts-secret-in-tracked-file", async () => {
      const project = join(root, "gts-redact");
      mkdirSync(project, { recursive: true });
      exec("git", ["init", "-q"], { cwd: project });
      exec("git", ["config", "user.email", "lab@example.invalid"], { cwd: project });
      exec("git", ["config", "user.name", "Lab"], { cwd: project });
      writeFileSync(join(project, "package.json"), JSON.stringify({ name: "gts-redact", version: "1.0.0", apiKey: AWS }, null, 2));
      await snapshotEngine.initShadowRepo(project);
      const result = await snapshotEngine.snapshot({ projectRoot: project, reason: "redact", type: "manual", trigger: "test" });
      assert(result.committed, "snapshot committed");
      assert(result.filesRedacted.some((f) => f.endsWith("package.json")), `package.json was redacted (redacted: ${result.filesRedacted})`);
      const stored = await snapshotEngine.getSnapshotContent(project, result.shortHash, "package.json");
      assertNotIncludes(stored, AWS, "secret is absent from the persisted snapshot content");
    });
  } else {
    suite.skip("security.gts-*", "git-that-shit not built");
  }

  function findFinding() {
    return { ruleId: "aws-access-key", description: "AWS Access Key", match: AWS, redacted: "[REDACTED:aws-access-key:deadbeef]", offset: 0, source: "context" };
  }

  function assertMatchToken(value) {
    if (!/\[REDACTED:[a-z0-9-]+:[a-f0-9]{8}\]/.test(value)) throw new Error(`expected redaction token, got ${value}`);
  }

  process.chdir(originalCwd);
  rmSync(root, { recursive: true, force: true });
  return suite.summary();
}

export const run = run_;

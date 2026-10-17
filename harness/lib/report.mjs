// Assemble machine-readable and human-readable test reports.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { LAB, PLUGINS, pluginSourceInfo } from "./env.mjs";
import { run } from "./exec.mjs";

function opencodeVersion() {
  const res = run("opencode", ["--version"], { timeoutMs: 20_000 });
  return (res.stdout || res.stderr || "").trim().split("\n").pop() || "unknown";
}

function distInventory(name) {
  const pkgDir = join(LAB.plugins, name);
  const dist = join(pkgDir, "dist");
  if (!existsSync(dist)) return { present: false, files: [] };
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push({ path: full.replace(pkgDir + "/", ""), bytes: statSync(full).size });
    }
  };
  walk(dist);
  return { present: true, fileCount: files.length, bytes: files.reduce((a, f) => a + f.bytes, 0), files: files.slice(0, 200) };
}

export function collectEnvironment(argv) {
  const pluginBuilds = {};
  for (const name of Object.keys(PLUGINS)) pluginBuilds[name] = { ...pluginSourceInfo(name), dist: distInventory(name) };
  return {
    generatedAt: new Date().toISOString(),
    opencodeVersion: opencodeVersion(),
    nodeVersion: process.version,
    platform: `${process.platform}/${process.arch}`,
    image: process.env.LAB_IMAGE || "opencode-plugin-lab:local",
    labRoot: LAB.root,
    requested: { config: argv.config, tier: argv.tier, online: !!argv.online, all: !!argv.all },
    plugins: pluginBuilds,
  };
}

function subCounts(rows) {
  const c = { pass: 0, fail: 0, skipped: 0 };
  for (const r of rows) c[r.status] = (c[r.status] || 0) + 1;
  return c;
}

const SECTION_DEFS = {
  runtimePluginLoading: { prefix: "runtime/", title: "Runtime plugin loading" },
  functional: { prefix: "functional/", title: "Functional tests" },
  modelRequestPath: { prefix: "model-path/", title: "Model-request path (offline mock provider)" },
  combinedCompatibility: { prefix: "combined/", title: "Combined compatibility" },
  compatibilityMatrix: { prefix: "matrix/", title: "Plugin compatibility matrix (load orders)" },
  security: { prefix: "security/", title: "Security tests" },
  concurrency: { prefix: "concurrency/", title: "Concurrency & crash consistency" },
  failureIsolation: { prefix: "failure-isolation/", title: "Failure isolation" },
  checkpointTriggers: { prefix: "checkpoint-triggers/", title: "Checkpoint automatic triggers (live runtime)" },
  online: { prefix: "online-model/", title: "Online model-request (optional)" },
};

export function buildReport({ environment, suites, startedAt, finishedAt, notes = [] }) {
  const flat = suites.flatMap((s) => s.results.map((r) => ({ suite: s.suite, ...r })));
  const counts = { pass: 0, fail: 0, skipped: 0 };
  for (const r of flat) counts[r.status] = (counts[r.status] || 0) + 1;
  const failures = flat.filter((r) => r.status === "fail").map((r) => ({ suite: r.suite, id: r.id, error: r.error }));
  const skipped = flat.filter((r) => r.status === "skipped").map((r) => ({ suite: r.suite, id: r.id, reason: r.notes }));

  const sections = {};
  for (const [key, def] of Object.entries(SECTION_DEFS)) {
    const rows = flat.filter((r) => r.suite.startsWith(def.prefix));
    if (rows.length) sections[key] = { title: def.title, counts: subCounts(rows), results: rows };
  }

  return {
    schema: "opencode-plugin-lab/report/v1",
    environment,
    startedAt,
    finishedAt,
    durationMs: startedAt ? new Date(finishedAt).getTime() - new Date(startedAt).getTime() : null,
    summary: { counts, total: flat.length },
    sections,
    // A blocker is anything that prevents a required validation from passing.
    blockers: failures.map((f) => `${f.suite}:${f.id}`),
    failures,
    skipped,
    limitations: remainingUnverified(),
    futureImprovements: futureImprovements(),
    notes,
    suites,
  };
}

export function remainingUnverified() {
  return [
    "Live provider credential paths are not exercised unless `--online` and a dedicated test key are supplied (disabled by default).",
    "Outbound redaction is verified on the supported HTTP model-request path via the offline mock provider; provider-native WebSocket traffic (experimental) is not covered.",
    "The stranger-danger oversize fail-closed branch (>256MiB) is asserted by its constant, not by allocating a >256MiB payload inside the resource-limited container.",
    "Hook registration is observed indirectly (through tool registration and the offline model path); OpenCode exposes no API to enumerate hooks.",
    "Tool-result transformations beyond the prompt/context/output paths depend on the same hooks and are covered by the functional suite rather than distinct live sessions.",
    "Plugin cleanup is verified by graceful server shutdown; explicit registration disposal / plugin unload is not separately asserted.",
    "The compatibility matrix covers the three plugins in every load order plus a duplicate entry, but not arbitrary third-party plugins.",
  ];
}

export function futureImprovements() {
  return [
    "Image size / export time (deferred, not a functional issue): the final image is ~3.61GB with ~73k files, dominated by four identical copies of `@opencode/plugin` (~189MB / ~17.8k files each). Installing the SDK once and symlinking `node_modules/@opencode` into each plugin directory would remove ~570MB and ~53k files, but must be re-verified with a loading test before adoption.",
    "Drop the optional global `bun` (85MB) from the runtime image; it is only needed for Git That Shit's own `bun:test` suite, which the lab harness does not run.",
    "Build when the host is quieter or run the build under `nice -n 19 ionice -c3`; exports take minutes under load because rootless overlayfs writes ~3.6GB / ~73k files on a single volume.",
  ];
}

export function renderMarkdown(report) {
  const e = report.environment;
  const lines = [];
  lines.push("# OpenCode Plugin Lab — Test Report");
  lines.push("");
  lines.push(`- Generated: ${report.finishedAt}`);
  lines.push(`- OpenCode runtime: ${e.opencodeVersion}`);
  lines.push(`- Node: ${e.nodeVersion} (${e.platform})`);
  lines.push(`- Image: ${e.image}`);
  lines.push(`- Config: ${e.requested.all ? "all configurations" : e.requested.config} · tier: ${e.requested.tier} · online: ${e.requested.online}`);
  if (report.durationMs != null) lines.push(`- Duration: ${(report.durationMs / 1000).toFixed(1)}s`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Result | Count |");
  lines.push("| --- | --- |");
  lines.push(`| Pass | ${report.summary.counts.pass || 0} |`);
  lines.push(`| Fail | ${report.summary.counts.fail || 0} |`);
  lines.push(`| Skipped | ${report.summary.counts.skipped || 0} |`);
  lines.push(`| Total | ${report.summary.total} |`);
  lines.push("");
  lines.push("### By area");
  lines.push("");
  lines.push("| Area | Pass | Fail | Skipped |");
  lines.push("| --- | --- | --- | --- |");
  for (const section of Object.values(report.sections)) {
    lines.push(`| ${section.title} | ${section.counts.pass || 0} | ${section.counts.fail || 0} | ${section.counts.skipped || 0} |`);
  }
  lines.push("");

  lines.push("## Plugin packages under test");
  lines.push("");
  lines.push("| Plugin | Version | Commit | Branch | Dirty |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const [name, info] of Object.entries(e.plugins)) {
    lines.push(`| ${name} | ${info.version ?? "?"} | ${(info.commit ?? "?").slice(0, 10)} | ${info.branch ?? "?"} | ${info.dirty ?? "?"} |`);
  }
  lines.push("");

  for (const section of Object.values(report.sections)) {
    lines.push(`## ${section.title}`);
    lines.push("");
    lines.push(`Pass ${section.counts.pass || 0} · Fail ${section.counts.fail || 0} · Skipped ${section.counts.skipped || 0}`);
    lines.push("");
    for (const r of section.results) {
      const mark = r.status === "pass" ? "✅" : r.status === "fail" ? "❌" : "⏭️";
      const label = r.suite ? `\`${r.suite}\` \`${r.id}\`` : `\`${r.id}\``;
      lines.push(`- ${mark} ${label} (${r.durationMs}ms)${r.notes ? ` — ${r.notes}` : ""}`);
      if (r.status === "fail" && r.error) lines.push(`  - error: \`${r.error.split("\n")[0]}\``);
    }
    lines.push("");
  }

  if (report.failures.length) {
    lines.push("## Failures");
    lines.push("");
    for (const f of report.failures) {
      lines.push(`### ${f.suite} · ${f.id}`);
      lines.push("");
      lines.push("```");
      lines.push(f.error || "(no stack)");
      lines.push("```");
      lines.push("");
    }
  }

  lines.push("## Blockers");
  lines.push("");
  if (report.blockers.length) {
    for (const b of report.blockers) lines.push(`- ${b}`);
  } else {
    lines.push("- None. All required validations passed.");
  }
  lines.push("");

  lines.push("## Limitations / remaining unverified behaviors");
  lines.push("");
  for (const item of report.limitations) lines.push(`- ${item}`);
  lines.push("");

  lines.push("## Future improvements (not required for this validation)");
  lines.push("");
  for (const item of report.futureImprovements) lines.push(`- ${item}`);
  lines.push("");

  lines.push("## Reproduce");
  lines.push("");
  lines.push("```sh");
  if (e.requested.all) lines.push(`make suite`);
  else lines.push(`make test CONFIG=${e.requested.config} TIER=${e.requested.tier}`);
  lines.push("```");
  lines.push("");
  return lines.join("\n");
}

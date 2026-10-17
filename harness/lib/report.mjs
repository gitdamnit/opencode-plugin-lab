// Assemble machine-readable and human-readable test reports.
//
// The report is generic: it describes whatever the manifest declared, without
// hardcoding any plugin. It records provenance (manifest digest, per-plugin
// version/commit, OpenCode runtime version, container image id), the exact
// configuration requested, PASS/FAIL/SKIP counts per area, failure details,
// security warnings and a reproduction command.
import { existsSync, readdirSync, statSync } from "node:fs";
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
  const root = existsSync(dist) ? dist : pkgDir;
  if (!existsSync(root)) return { present: false, files: [] };
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        walk(full);
      } else files.push({ path: full.replace(pkgDir + "/", ""), bytes: statSync(full).size });
    }
  };
  walk(root);
  return { present: true, fileCount: files.length, bytes: files.reduce((a, f) => a + f.bytes, 0), files: files.slice(0, 200) };
}

export function collectEnvironment(argv, extra = {}) {
  const pluginBuilds = {};
  for (const name of Object.keys(PLUGINS)) {
    const info = { ...pluginSourceInfo(name), dist: distInventory(name) };
    info.capabilities = PLUGINS[name].capabilities;
    info.expectTools = PLUGINS[name].tools;
    pluginBuilds[name] = info;
  }
  return {
    schema: "opencode-plugin-lab/report/v1",
    generatedAt: new Date().toISOString(),
    runId: extra.runId || process.env.LAB_RUN_ID || null,
    opencodeVersion: opencodeVersion(),
    nodeVersion: process.version,
    platform: `${process.platform}/${process.arch}`,
    image: process.env.LAB_IMAGE || "opencode-plugin-lab:local",
    imageId: process.env.LAB_IMAGE_ID || null,
    labRoot: LAB.root,
    manifest: extra.summary || null,
    requested: { config: argv.config, tier: argv.tier, online: !!argv.online, all: !!argv.all },
    plugins: pluginBuilds,
  };
}

function subCounts(rows) {
  const c = { pass: 0, fail: 0, skipped: 0 };
  for (const r of rows) c[r.status] = (c[r.status] || 0) + 1;
  return c;
}

const KNOWN_TITLES = {
  "runtime/": "Runtime plugin loading",
  "model-path/": "Model-request path (offline mock provider)",
  "package-inspection/": "Package inspection & provenance",
  "load-order/": "Load-order permutations & tool conflicts",
  "failure-isolation/": "Failure isolation",
  "process-cleanup/": "Process cleanup",
  "install-artifact/": "Install from built artifact",
  "config-validation/": "Configuration validation & error handling",
  "online-model/": "Online model-request (optional, gated)",
};

function titleForSuite(suite) {
  for (const [prefix, title] of Object.entries(KNOWN_TITLES)) {
    if (suite.startsWith(prefix)) return title;
  }
  return suite;
}

function groupSections(flat) {
  const byTitle = new Map();
  for (const r of flat) {
    const title = titleForSuite(r.suite);
    if (!byTitle.has(title)) byTitle.set(title, []);
    byTitle.get(title).push(r);
  }
  const sections = {};
  let i = 0;
  for (const [title, rows] of byTitle) {
    sections[`section${i++}`] = { title, counts: subCounts(rows), results: rows };
  }
  return sections;
}

export function buildReport({ environment, suites, startedAt, finishedAt, notes = [] }) {
  const flat = suites.flatMap((s) => s.results.map((r) => ({ suite: s.suite, ...r })));
  const counts = { pass: 0, fail: 0, skipped: 0 };
  for (const r of flat) counts[r.status] = (counts[r.status] || 0) + 1;
  const failures = flat.filter((r) => r.status === "fail").map((r) => ({ suite: r.suite, id: r.id, error: r.error }));
  const skipped = flat.filter((r) => r.status === "skipped").map((r) => ({ suite: r.suite, id: r.id, reason: r.notes }));

  return {
    schema: "opencode-plugin-lab/report/v1",
    environment,
    startedAt,
    finishedAt,
    durationMs: startedAt ? new Date(finishedAt).getTime() - new Date(startedAt).getTime() : null,
    summary: { counts, total: flat.length },
    sections: groupSections(flat),
    blockers: failures.map((f) => `${f.suite}:${f.id}`),
    failures,
    skipped,
    securityWarnings: securityWarnings(environment),
    limitations: remainingUnverified(environment),
    notes,
    suites,
  };
}

export function securityWarnings(env) {
  const warnings = [];
  const plugins = env.plugins || {};
  const networked = Object.entries(plugins).filter(([, i]) => i.capabilities && i.capabilities.network);
  if (networked.length) warnings.push(`Plugins declare network capability: ${networked.map(([n]) => n).join(", ")}. Only the gated online tier enables networking.`);
  const dirty = Object.entries(plugins).filter(([, i]) => i.dirty === true);
  if (dirty.length) warnings.push(`Staged from a dirty worktree (uncommitted changes): ${dirty.map(([n]) => n).join(", ")}. Results may not reproduce from the recorded commit.`);
  const noCommit = Object.entries(plugins).filter(([, i]) => i.built && !i.commit && i.sourceType !== "npm");
  if (noCommit.length) warnings.push(`No source commit recorded for: ${noCommit.map(([n]) => n).join(", ")} (not a git worktree?).`);
  warnings.push("Third-party plugin code runs in the container during build and load. Rootless Docker limits but does not eliminate risk; do not run untrusted plugins without reviewing them.");
  return warnings;
}

export function remainingUnverified(env = {}) {
  const list = [
    "Live provider credential paths are not exercised unless `--online` and a dedicated test key are supplied (disabled by default).",
    "Outbound redaction is only asserted for plugins that declare capabilities.redaction; it is verified on the supported HTTP model-request path via the offline mock provider, never on provider-native WebSocket traffic.",
    "Docker (rootless or otherwise) reduces but does not eliminate the risk of malicious plugin code; plugins are not a hard security sandbox.",
    "Install-from-artifact packs the built output with npm scripts disabled and supplies the plugin SDK offline; a package that relies on install-time scripts is reported as skipped rather than forced.",
  ];
  for (const [name, info] of Object.entries(env.plugins || {})) {
    if (info.capabilities && info.capabilities.storage) list.push(`Persistence for "${name}" is exercised only through the generic write-boundary check, not a plugin-specific storage audit.`);
  }
  return list;
}

export function renderMarkdown(report) {
  const e = report.environment;
  const lines = [];
  lines.push("# OpenCode Plugin Lab — Test Report");
  lines.push("");
  lines.push(`- Run id: ${e.runId ?? "(none)"}`);
  lines.push(`- Generated: ${report.finishedAt}`);
  lines.push(`- OpenCode runtime: ${e.opencodeVersion}`);
  lines.push(`- Node: ${e.nodeVersion} (${e.platform})`);
  lines.push(`- Image: ${e.image}${e.imageId ? ` (${e.imageId})` : ""}`);
  if (e.manifest) lines.push(`- Manifest: ${e.manifest.name} · \`${e.manifest.path}\` · digest ${String(e.manifest.digest).slice(0, 16)}…`);
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

  lines.push("## Plugins under test");
  lines.push("");
  lines.push("| Plugin | Version | Commit | Branch | Dirty | Source type |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const [name, info] of Object.entries(e.plugins)) {
    lines.push(`| ${name} | ${info.version ?? "?"} | ${(info.commit ?? "?").slice(0, 10)} | ${info.branch ?? "?"} | ${info.dirty ?? "?"} | ${info.sourceType ?? "?"} |`);
  }
  lines.push("");

  lines.push("## Security warnings");
  lines.push("");
  for (const w of report.securityWarnings) lines.push(`- ${w}`);
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
  if (report.blockers.length) for (const b of report.blockers) lines.push(`- ${b}`);
  else lines.push("- None. All required validations passed.");
  lines.push("");

  lines.push("## Limitations / remaining unverified behaviors");
  lines.push("");
  for (const item of report.limitations) lines.push(`- ${item}`);
  lines.push("");

  lines.push("## Reproduce");
  lines.push("");
  lines.push("```sh");
  if (e.requested.all) lines.push("make suite");
  else lines.push(`make test CONFIG=${e.requested.config} TIER=${e.requested.tier}`);
  if (e.manifest && e.manifest.path && e.manifest.path.includes("/profiles/")) {
    lines.push("# (built with the profile manifest: " + e.manifest.path + ")");
  }
  lines.push("```");
  lines.push("");
  return lines.join("\n");
}

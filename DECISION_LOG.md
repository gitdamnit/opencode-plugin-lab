# Decision Log

## How to Use This Log

1. Copy the block below to the end of the `## Decisions` section.
2. Use the next free four-digit ID. IDs are never reused and never renumbered.
3. Date the record the day the decision was actually made (`YYYY-MM-DD`).
4. Record the alternatives you rejected and why. A decision without context is a
   rumour, not a record.
5. Never rewrite history. If a decision changes, append a superseding record.

```markdown
### D-0001 — Short imperative title

- **Date:** YYYY-MM-DD
- **Status:** Accepted
- **Context:** the situation and the constraint that forced a choice
- **Alternatives Considered:** option A (rejected because ...), option B (rejected because ...)
- **Decision:** what was decided, in one or two sentences
- **Rationale:** why this option wins, including what it costs
- **Consequences:** what follows from it — new constraints, follow-up work, risks
- **Supersedes:** None
```

Allowed statuses: `Proposed`, `Accepted`, `Superseded`, `Deprecated`, `Rejected`.

## Decisions

### D-0001 — Drive the lab from a declarative JSONC manifest

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** The lab hardcoded three plugins, their tools, ids, configs and
  specialized tests. A fresh user could not use it without those plugins.
- **Alternatives Considered:** Environment variables only (rejected: no structure,
  no validation, awkward for multiple plugins); a TypeScript config module
  (rejected: executes code before anything is validated, and adds a build step to
  the host); keeping hardcoded defaults plus env overrides (rejected: still
  assumes the three plugins).
- **Decision:** One `lab.config.json` (JSONC) per manifest declares plugins,
  sources, capabilities, expected tools, configurations and extensions, validated
  against `schema/lab.config.schema.json`.
- **Rationale:** Data is inspectable, diffable, lintable and portable. A single
  loader (`harness/lib/manifest.mjs`) is shared by every script, so staging,
  discovery, build and the harness cannot diverge. Cost: one more concept to
  learn, mitigated by a validator with actionable errors and examples.
- **Consequences:** All downstream tooling is manifest-driven; the old
  `plugins.tsv` and per-config JSONC files become reference artefacts.
- **Supersedes:** None

### D-0002 — Generate OpenCode configs at run time

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** Configs were baked JSONC templates with hardcoded plugin paths.
- **Alternatives Considered:** Templating the old JSONC files with placeholders
  (rejected: still per-plugin files, still requires editing); baking generated
  configs at build time (rejected: cannot support a manifest supplied at run
  time, e.g. `make test-plugin`).
- **Decision:** `harness/lib/opencode.mjs#generateConfig` builds each
  `opencode.json` from the manifest, appending the lab inspector last. An
  optional JSONC `template` supplies non-plugin settings.
- **Rationale:** The plugin list lives in exactly one place (the manifest);
  non-plugin settings remain expressible. The old per-plugin JSONC files are kept
  under `profiles/gitdamnit/configs/legacy/` for reference, not deleted.
- **Consequences:** Templates may only carry non-plugin keys; the generated list
  overrides any `plugins` key in a template.
- **Supersedes:** None

### D-0003 — Optional profiles with environment-overridable source paths

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** The three original plugins must remain reproducible, but must not
  be required by a fresh clone, and public manifests must not contain `/home/evan`
  paths.
- **Alternatives Considered:** Delete the old tests (rejected: destroys working
  regression coverage and history); keep them in the default manifest (rejected:
  re-creates the dependency); vendor the plugin sources (rejected: they are
  independent products under their own licences).
- **Decision:** Relocate the plugin-specific tests and configs into
  `profiles/gitdamnit/`, whose manifest points at sources via
  `${CHECKPOINT_ORCHESTRATOR_DIR:-$HOME/Projects/...}` style variables.
- **Rationale:** The default lab stays dependency-free; the profile is activated
  with `PROFILE=gitdamnit` and is fully overridable without editing files.
- **Consequences:** Profile tests import the harness via a relative path; the
  profile is documented as maintainer-oriented, not the default.
- **Supersedes:** None

### D-0004 — Ship two bundled example plugins

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** The default manifest must include a real `multi-plugin`
  configuration, and the lab must not assume every plugin registers tools.
- **Alternatives Considered:** One example plugin (rejected: `multi-plugin` would
  be meaningless); list one plugin twice (rejected: that is a duplicate-entry
  test, not multi-plugin compatibility); reuse a `@gitdamnit` plugin (rejected:
  re-creates the dependency).
- **Decision:** Ship `examples/example-plugin` (compiled TypeScript, registers one
  safe tool, lifecycle logging) and `examples/example-plugin-2` (prebuilt
  JavaScript, no tools).
- **Rationale:** It exercises both build shapes, gives `multi-plugin` real
  content, and demonstrates capability-aware skipping in the default suite.
- **Consequences:** Two tiny example packages are maintained in-tree; they are
  deliberately not full-featured projects.
- **Supersedes:** None

### D-0005 — Capability-aware assertions; skip rather than fabricate

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** Plugins differ: some register tools, some do not; some redact,
  some persist state. Asserting everything for everyone would produce false
  failures or meaningless passes.
- **Alternatives Considered:** Require tool registration (rejected: excludes valid
  plugins); assert nothing when uncertain (rejected: weakens the suite).
- **Decision:** Plugins declare `capabilities` and `expectTools`; the harness
  asserts only declared capabilities and records the rest as `skipped` with a
  reason. A redaction assertion runs only for plugins declaring
  `capabilities.redaction`.
- **Rationale:** PASS/FAIL/SKIP are distinguishable and honest; the model-path
  control experiment still proves the capture path observes real traffic.
- **Consequences:** Reports contain a non-zero skip count by design; reviewers
  must read skip reasons, which the report prints.
- **Supersedes:** None

### D-0006 — Disable npm lifecycle scripts by default

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** Building third-party plugin sources installs dependencies, which
  may run arbitrary install scripts — a supply-chain risk.
- **Alternatives Considered:** Run scripts by default to match upstream build
  behaviour (rejected: least privilege lost silently); forbid scripts entirely
  (rejected: some legitimate plugins need them).
- **Decision:** Dependency install runs with `--ignore-scripts` unless the
  manifest sets `install.scripts: true`. `source.type: npm` is never fetched
  unless `allowRemote: true`.
- **Rationale:** Least privilege is the default; opting in is explicit,
  documented and visible in the manifest.
- **Consequences:** A plugin that needs install scripts reports a build failure
  or skip until it opts in; the risk is documented in `docs/SECURITY.md`.
- **Supersedes:** None

### D-0007 — Preserve evidence: historical tree plus dated run archives

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** The original `145 passed` run is valuable evidence and must not be
  overwritten or relabelled.
- **Alternatives Considered:** Regenerate everything into `reports/` (rejected:
  destroys evidence); keep only a summary (rejected: less verifiable).
- **Decision:** Commit the original report and RC evidence unchanged under
  `reports/historical/gitdamnit-2026-10-17/`; every new run writes
  `reports/runs/<run-id>/` and never overwrites an earlier run.
- **Rationale:** Historical and current evidence coexist without ambiguity.
- **Consequences:** Generated reports are gitignored except the historical tree
  and the example `sample-report.md`.
- **Supersedes:** None

### D-0008 — License the lab MIT with third-party notices

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** The lab is prepared for public release; it stages third-party
  plugins but does not redistribute them.
- **Alternatives Considered:** Apache-2.0 (rejected: heavier, and the lab does not
  need patent terms); no licence (rejected: not open-source-ready).
- **Decision:** MIT for the lab and the example plugins; `THIRD_PARTY_NOTICES.md`
  records the licences of build-time dependencies and the optional profile's
  plugins.
- **Rationale:** Maximum compatibility; the bundled example plugins are lab-owned.
- **Consequences:** Attribution is documented; the profile's plugins keep their
  own licences (MIT / Apache-2.0).
- **Supersedes:** None

### D-0009 — Pin a tested OpenCode baseline; never auto-follow latest

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** OpenCode V2 ships frequently (2.0.21 → 2.0.3x within weeks).
  Assuming a newer version passes is unsafe.
- **Alternatives Considered:** Track `latest` (rejected: non-reproducible);
  hardcode one version with no override (rejected: prevents evaluation).
- **Decision:** Manifests pin 2.0.21 as the tested baseline; another version is
  selected explicitly with `OPENCODE_VERSION=…`; the installed version is recorded
  in every report. Compatibility with a newer version is *projected*, not claimed.
- **Rationale:** Reproducibility plus a documented path to evaluate newer
  runtimes.
- **Consequences:** A version bump is a deliberate, recorded action, not drift.
- **Supersedes:** None

### D-0010 — Distribute as source; not a loadable plugin, no registry publication

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** The lab could be mistaken for an OpenCode plugin, but it is a
  standalone developer tool.
- **Alternatives Considered:** Publish to npm as a plugin (rejected:
  misrepresents its purpose and serves no runtime need); publish a container image
  (rejected: not requested; adds a distribution channel to maintain).
- **Decision:** Distribute via GitHub source and Docker build; document the
  distinction prominently; do not submit to any plugin registry.
- **Rationale:** Honest positioning; users clone and run it.
- **Consequences:** Documentation must state the distinction; release checklist
  excludes registry publication.
- **Supersedes:** None

### D-0011 — Build from a resolved plan; builder is a Node script

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** The builder hardcoded three plugins and assumed a `tsc` build.
- **Alternatives Considered:** Keep a hardcoded builder (rejected: not generic);
  parse the manifest inside the image (rejected: source paths are host-only and
  must not be resolved in the container).
- **Decision:** Host staging emits `staging/_build/plan.json` (absolute,
  resolved); `docker/build-plugins.mjs` consumes it and builds each plugin per
  the manifest, supporting compiled and prebuilt shapes.
- **Rationale:** Separates host path resolution from image build; supports any
  plugin, both build shapes, and fails loudly on a missing build output.
- **Consequences:** The Docker context carries `staging/_build/plan.json`; the
  builder has no knowledge of the host filesystem.
- **Supersedes:** None

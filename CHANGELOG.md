# Changelog

All notable changes to OpenCode Plugin Lab are recorded here. This project uses
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-10-16

First generalized, standalone release. The lab no longer depends on any specific
plugin.

### Added

- **Manifest-driven architecture.** A single `lab.config.json` declares plugins
  (source directory / prebuilt package / tarball / opt-in npm), their
  capabilities and expected tools, the configurations to run, and optional test
  extensions. Full JSON Schema in `schema/lab.config.schema.json`.
- **Manifest CLI** (`scripts/lab-manifest.mjs`): `validate`, `plan`, `discover`,
  `configs`, `versions` — one shared implementation used by every script.
- **Bundled example plugins** (`examples/example-plugin`, `examples/example-plugin-2`):
  a compiled TypeScript plugin that registers a safe tool with lifecycle logging,
  and a prebuilt JavaScript plugin that registers no tools (exercising
  capability-aware skipping).
- **Generic test suites**:
  `package-inspection`, `load-order` (all permutations + duplicate entry +
  tool-conflict detection), `failure-isolation`, `process-cleanup`,
  `install-artifact` (pack + load the artifact), `config-validation`, and a
  capability-aware `runtime-load` and `model-path`.
- **Default configurations**: `baseline`, `example-plugin`, `single-plugin`,
  `multi-plugin`.
- **`make test-plugin PLUGIN=<path>`** to build and test an arbitrary local
  plugin with no committed manifest.
- **Optional regression profile** `profiles/gitdamnit/` for the three original
  `@gitdamnit` plugins, with their specialized tests relocated (not deleted).
- **Dated run archives**: every run writes `reports/runs/<run-id>/` and never
  overwrites earlier evidence.
- **Documentation**: `docs/CONFIGURATION.md`, `docs/TESTING.md`,
  `docs/RELEASE_CHECKLIST.md`, refreshed `README.md`, `docs/ARCHITECTURE.md`,
  `docs/SECURITY.md`, `LICENSE`, `THIRD_PARTY_NOTICES.md`.
- **ProDoc Guard** project memory: `PRODUCT_REQUIREMENTS.md`, `DECISION_LOG.md`,
  `PROJECT_STATUS.md`.

### Verified

- OpenCode V2 **2.0.21** (pinned baseline) and **2.0.32** (evaluated): the full
  generic suite passes identically on both — 76 pass / 0 fail / 5 skip. See
  `reports/v1.0.0/` and `docs/OPENCODE_COMPATIBILITY.md`.

### Changed

- The Docker builder is now driven by a resolved build plan
  (`staging/_build/plan.json`) instead of a hardcoded list of three plugins.
- Dependency installation disables npm lifecycle scripts by default
  (`--ignore-scripts`), opt-in per plugin.
- Reports carry manifest name/path/digest, image id, per-plugin source type, and
  security warnings.
- Commands were preserved: `help build stage discover start stop logs test suite
  validate rc-evidence test-online refresh reset report shell clean`.

### Preserved (not changed by this release)

- The original three-plugin regression evidence
  (`reports/historical/gitdamnit-2026-10-17/`) is committed unchanged and clearly
  labelled as historical: **145 passed / 0 failed / 0 skipped**, OpenCode
  v2.0.21, Node v22.23.3, image `sha256:76ebd805cd54…`.
- The three `@gitdamnit` plugins remain independent products. The lab is not a
  dependency of them and does not download them by default.

[1.0.0]: https://github.com/gitdamnit/opencode-plugin-lab/releases/tag/v1.0.0

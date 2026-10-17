# Project Status

## Current Phase

Released

## Repository State

<!-- Machine-maintained by `prodoc update`. Do not hand-edit. -->
<!-- prodoc:observed:start -->
<!-- Observed from Git metadata only, by `prodoc update`. This block is not evidence that the implementation or its tests are correct; record that under `## Verification Evidence`. -->
- **Observed branch:** main
- **Observed commit:** a89265058831d67d44b7bd38ae8ea4cb5a8a325a
- **Observed working tree:** dirty
- **Observed at:** 2026-10-17T03:38:53Z
<!-- prodoc:observed:end -->

## Verification Evidence

Written by a human, one line per verification. A commit identifier and an
artefact are both required; a release-state phase or a `Deployed`/`Published`
work item is rejected without at least one entry here.

- **Verification:** commit `96e67fc` — historical three-plugin evidence imported unchanged (145 passed / 0 failed / 0 skipped, OpenCode v2.0.21, image `sha256:76ebd805cd54…`) — evidence `reports/historical/gitdamnit-2026-10-17/test-report.json`
- **Verification:** commit `96e67fc` — original release-candidate provenance (source = staged = packed = installed) preserved — evidence `reports/historical/gitdamnit-2026-10-17/rc-evidence.json`
- **Verification:** commit `31ecf1a` — default manifest `make build && make suite` green (76 passed / 0 failed / 5 skipped), OpenCode v2.0.21, baked harness — evidence `reports/v1.0.0/default-run/test-report.json`
- **Verification:** commit `31ecf1a` — `gitdamnit` regression profile green against the pinned historical commits (153 passed / 0 failed / 8 skipped) — evidence `reports/v1.0.0/gitdamnit-profile/test-report.json`
- **Verification:** commit `31ecf1a` — arbitrary external plugin via `make test-plugin` green (30 passed / 0 failed / 3 skipped) — evidence `reports/v1.0.0/arbitrary-plugin/test-report.json`
- **Verification:** commit `31ecf1a` — source = staged = packed = installed for the default manifest — evidence `reports/v1.0.0/rc-evidence.json`
- **Verification:** commit `a892650` — OpenCode 2.0.32 evaluated end to end (76 pass / 0 fail / 5 skip) — evidence `reports/v1.0.0/opencode-2.0.32/test-report.json`
- **Verification:** commit `a892650` — published to GitHub; public clone loads and its manifests validate; tag `v1.0.0` (annotated) dereferences to `a892650`; release archive downloads — evidence https://github.com/gitdamnit/opencode-plugin-lab/releases/tag/v1.0.0

## Completed Work

- [Tested] Manifest-driven configuration, schema and validating CLI — `reports/v1.0.0/default-run/test-report.json`
- [Tested] Manifest-driven staging and image build (compiled and prebuilt shapes) — `reports/v1.0.0/rc-evidence.json`
- [Tested] Generic test suites (runtime, model path, package inspection, load order, failure isolation, process cleanup, install-from-artifact, config validation) — `reports/v1.0.0/default-run/test-report.json`
- [Tested] Dated run archives and richer reports with provenance — `reports/v1.0.0/default-run/test-report.json`
- [Tested] Bundled example plugins (one with a tool, one without) — `examples/`, `reports/v1.0.0/default-run/test-report.json`
- [Tested] Optional `gitdamnit` regression profile; original tests relocated, original configs preserved — `reports/v1.0.0/gitdamnit-profile/test-report.json`
- [Tested] `make test-plugin` for an arbitrary external plugin — `reports/v1.0.0/arbitrary-plugin/test-report.json`
- [Implemented] Documentation, licence, changelog and release materials — `README.md`, `docs/`, `CHANGELOG.md`, `LICENSE`
- [Removed] Hardcoded three-plugin staging/`plugins.tsv` from the default path (preserved in the profile) — `profiles/gitdamnit/plugins.tsv`
- [Tested] OpenCode 2.0.32 evaluated end to end — `reports/v1.0.0/opencode-2.0.32/test-report.json`
- [Published] v1.0.0 released on GitHub — https://github.com/gitdamnit/opencode-plugin-lab/releases/tag/v1.0.0

## Tests

| Suite | Command | Result | Evidence |
| --- | --- | --- | --- |
| historical (three-plugin) | `--all --tier validate` (2026-10-17) | Pass (145) | `reports/historical/gitdamnit-2026-10-17/test-report.json` |
| manifest validation | `node scripts/lab-manifest.mjs validate` (default + profile) | Pass | `lab.config.json`, `profiles/gitdamnit/lab.config.json` |
| default suite (clean build) | `make build && make suite` | Pass (76 / 0 fail / 5 skip) | `reports/v1.0.0/default-run/test-report.json` |
| regression profile | `PROFILE=gitdamnit make build && ./scripts/validate.sh` | Pass (153 / 0 fail / 8 skip) | `reports/v1.0.0/gitdamnit-profile/test-report.json` |
| arbitrary plugin | `make test-plugin PLUGIN=…` | Pass (30 / 0 fail / 3 skip) | `reports/v1.0.0/arbitrary-plugin/test-report.json` |
| rc-evidence | `make rc-evidence` | Pass (consistent) | `reports/v1.0.0/rc-evidence.json` |
| OpenCode 2.0.32 | `OPENCODE_VERSION=2.0.32 make build && make suite` | Pass (76 / 0 fail / 5 skip) | `reports/v1.0.0/opencode-2.0.32/test-report.json` |

## Known Defects

None known.

## Blockers

None.

## Next Actions

1. Keep the `v1.0.0` tag fixed at `a892650`; do not move it.
2. Optionally pin a newer OpenCode version after a fresh evaluation run
   (`make build OPENCODE_VERSION=<x> && make suite`).
3. Triage issues and PRs arriving against the public repository.

## Release Status

**v1.0.0 — Released** (2026-10-17).

- Repository (public, MIT): https://github.com/gitdamnit/opencode-plugin-lab
- Tag: `v1.0.0` (annotated) → commit `a89265058831d67d44b7bd38ae8ea4cb5a8a325a`
- Release: https://github.com/gitdamnit/opencode-plugin-lab/releases/tag/v1.0.0
- Nothing was published to npm or any Docker registry (this is not a loadable
  OpenCode plugin).

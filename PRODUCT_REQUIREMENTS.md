# Product Requirements

## Project Identity

**Name:** OpenCode Plugin Lab
**Repository:** https://github.com/gitdamnit/opencode-plugin-lab
**Licence:** MIT
**Maintainer:** gitdamnit

## Purpose

OpenCode V2 plugin authors have no easy way to prove that a plugin loads in the
real runtime and behaves safely alongside other plugins. Manual testing inside a
personal OpenCode installation is unreproducible, leaks credentials, and cannot
show failure isolation, load-order collisions, or install provenance.

OpenCode Plugin Lab exists to make that verification reproducible, disposable,
and safe: point it at any plugin, and it builds and loads the plugin in the real
`opencode` runtime inside an isolated, offline container, then reports exactly
what happened and what was installed.

## Intended Users

- **OpenCode plugin authors** who want a repeatable pass/fail before publishing.
- **Maintainers reviewing third-party plugins** who need a sandboxed smoke test.
- **CI pipelines** that need to gate a plugin on real-runtime behaviour.

They already know Node, npm and Docker, and are comfortable editing a JSON
manifest. They expect commands to be simple (`make …`) and results to be honest.

## Functional Requirements

| ID | Requirement | Acceptance signal |
| --- | --- | --- |
| FR-1 | The default configuration must work with no external plugin present. | `make build && make suite` passes with only the bundled example plugins. |
| FR-2 | A developer must be able to test an arbitrary plugin from a local directory, a packed tarball, or a prebuilt package. | `make test-plugin PLUGIN=<path>` builds and runs the suite. |
| FR-3 | Multiple arbitrary plugins must load together with configurable names, package names and paths. | `multi-plugin` configuration and the `load-order` suite. |
| FR-4 | Configurations must not assume any npm scope or absolute home path in the public manifests. | `node scripts/lab-manifest.mjs validate` and review of `lab.config.json`. |
| FR-5 | The lab must verify runtime loading, tool registration, tool-name collisions, failure isolation, process cleanup, install-from-artifact and configuration errors. | The named global suites in every report. |
| FR-6 | Capabilities a plugin does not declare must be reported as skipped, never failed or faked. | A no-tool plugin reports tool assertions as skipped. |
| FR-7 | The lab must record provenance: manifest digest, plugin version/commit, OpenCode and Node versions, image id. | `reports/runs/<id>/test-report.json` and `make rc-evidence`. |
| FR-8 | Reports must be preserved across runs and never overwrite earlier evidence. | One directory per run under `reports/runs/`; committed `reports/historical/`. |
| FR-9 | The three original `@gitdamnit` plugins must remain reproducible via an optional profile, without being a dependency of the lab. | `make suite PROFILE=gitdamnit`. |
| FR-10 | The historical three-plugin evidence must remain unchanged and clearly labelled. | `reports/historical/gitdamnit-2026-10-17/`. |
| FR-11 | A manifest must support plugin-specific and manifest-wide test extensions that run only when that manifest is active. | `tests` / `globalSuites` in the schema and the profile. |
| FR-12 | Selecting a different OpenCode V2 version must be explicit and recorded. | `make build OPENCODE_VERSION=…`; version in every report. |

## Nonfunctional Requirements

| ID | Requirement | Target |
| --- | --- | --- |
| NFR-1 | Offline by default | Every test runs with `network_mode: "none"`; only the gated `online` profile has network. |
| NFR-2 | Least privilege | `read_only` rootfs, all caps dropped, `no-new-privileges`, non-root, tmpfs scratch, resource limits. |
| NFR-3 | No host credential exposure | Never mounts SSH/npm/cloud creds, the real OpenCode config, home directories or the Docker socket. |
| NFR-4 | Reproducibility | Pinned versions; exact image id, manifest digest and plugin commits in every report. |
| NFR-5 | Portability | Runs on any POSIX host with Docker + Compose v2 + Node; documented for rootless Docker and WSL2. |
| NFR-6 | Honest reporting | PASS/FAIL/SKIP distinguished; unverifiable behaviour labelled, never passed. |
| NFR-7 | Supply-chain caution | npm lifecycle scripts disabled by default; `npm` sources require explicit `allowRemote`. |
| NFR-8 | Maintainability | One shared manifest implementation; no third-party runtime dependencies in the harness. |

## Scope and Exclusions

**In scope for v1.0.0**

- A manifest-driven, generic Docker test lab with the generic suites above.
- Bundled example plugins, default configurations, and an optional regression
  profile for the three original plugins.
- Report generation, provenance, documentation, licence and release materials.

**Out of scope**

- Publishing to npm, a container registry, or any plugin registry.
- Being a loadable OpenCode runtime plugin.
- Redesigning or modifying the three `@gitdamnit` plugins.
- Verifying provider-native WebSocket traffic or a >256 MiB fail-closed branch.
- A GUI, a hosted service, or a central server.

## Technical Constraints

- Docker with Compose v2 (BuildKit); host scripts are `bash` + Node ESM.
- Pinned baseline: `@opencode/cli` **2.0.21**, `@opencode/plugin` **2.0.21**,
  Node **22** base image.
- The V1 `opencode-ai` package is forbidden.
- The harness must have no third-party runtime dependencies.
- Public manifests must contain no hardcoded `/home/<user>` paths.

## Acceptance Criteria

- A clean clone builds and runs the default manifest with no external plugin and
  no network beyond the build.
- An arbitrary local plugin builds and passes the generic suite via
  `make test-plugin`.
- The three-plugin profile is reproducible and clearly identified by commit.
- Every report records exact versions, image id and manifest digest; a failing
  suite reproduces from the printed command.
- No assertion is weakened merely to increase a pass count; differing suite
  totals relative to the historical run are documented.

## Release Objectives

Ship **v1.0.0** as a standalone, reusable tool another developer can clone and
use without any of the maintainer's personal infrastructure:

1. Generalize the configuration architecture (manifest + schema + validation).
2. Provide generic, capability-aware test suites distinct from optional
   plugin-specific suites.
3. Preserve the historical regression evidence without relabelling it.
4. Prove it works: clean build, default suite, arbitrary-plugin run, and the
   optional regression profile.
5. Leave the repository ready for public GitHub publication, pending explicit
   maintainer approval.

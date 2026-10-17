# Testing the lab itself

This document is for people **changing the lab** (not for people using it to test
a plugin). It explains how to prove the lab works.

## Unit-ish checks (no Docker)

```sh
node scripts/lab-manifest.mjs validate                       # default manifest
node scripts/lab-manifest.mjs validate --manifest profiles/gitdamnit/lab.config.json
node scripts/lab-manifest.mjs discover                       # sources/versions/commits
node scripts/lab-manifest.mjs configs                        # configurations
```

These run on a bare host with only Node and exercise manifest loading, variable
expansion, path resolution and the configuration generator's error paths.

## Full runs (Docker)

```sh
make build                 # default manifest: the two bundled example plugins
make suite                 # every configuration + every global suite
make validate              # same, with the harness mounted read-only
```

Expected on the default manifest: `baseline`, `example-plugin`, `single-plugin`,
`multi-plugin` all pass; the no-tool plugin reports tool assertions as **skipped**
(never failed).

## Regression profile

```sh
make build PROFILE=gitdamnit
make suite PROFILE=gitdamnit
```

This builds the three `@gitdamnit` plugins from the paths in
`profiles/gitdamnit/lab.config.json` (override with
`CHECKPOINT_ORCHESTRATOR_DIR`, `GIT_THAT_SHIT_DIR`, `STRANGER_DANGER_DIR`) and runs
their specialized suites. The exact commits built are recorded in the report.
The committed `145 passed` evidence under `reports/historical/` is pinned to
specific commits and is **not** recomputed by this run.

## Acceptance scenarios for v1.0.0

| Scenario | How |
| --- | --- |
| A. Clean public install | fresh clone, no external plugins, `make build && make suite` |
| B. Baseline | `make test CONFIG=baseline TIER=validate` |
| C. Example plugin | `make test CONFIG=example-plugin TIER=validate` |
| D. Arbitrary plugin | `make test-plugin PLUGIN=/some/other/plugin` |
| E. Multiple plugins | `make test CONFIG=multi-plugin TIER=validate` |
| F. Regression compatibility | `make suite PROFILE=gitdamnit` |
| G. Security | `make test TIER=security` + `config-validation` + `failure-isolation` |
| H. Packaging | fresh clone builds without any ignored/generated file |
| I. Reproducibility | `make rc-evidence` shows source = staged = packed = installed |

## Reproducibility notes

- The builder installs dependencies with `--ignore-scripts` unless a manifest
  opts in, so a plugin with install hooks is reported as skipped rather than
  forced.
- Reports pin the manifest digest, image id, OpenCode/Node versions and each
  plugin's commit, so any run can be tied to exact inputs.
- The image is large (~3.6 GB) and dominates build time; `make build` under host
  load can take minutes. This is an infrastructure cost, not a correctness issue.

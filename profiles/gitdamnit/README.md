# Regression profile: three @gitdamnit plugins

This optional profile reproduces the lab's original purpose: validating three
independently developed OpenCode V2 plugins together.

It is **not** required to use the lab, and the plugins are **not** downloaded by
default. It exists so the historical regression work stays reproducible without
making any of the three plugins a dependency of the lab.

## Activate

```sh
make build PROFILE=gitdamnit
make suite PROFILE=gitdamnit
```

Individual configurations:

```sh
make test-checkpoint PROFILE=gitdamnit
make test-git-that-shit PROFILE=gitdamnit
make test-stranger-danger PROFILE=gitdamnit
make test-all PROFILE=gitdamnit
```

## Source locations

`lab.config.json` here points at the maintainer's worktrees by default. Override
without editing anything:

```sh
CHECKPOINT_ORCHESTRATOR_DIR=/path/to/checkpoint-orchestrator \
GIT_THAT_SHIT_DIR=/path/to/git-that-shit \
STRANGER_DANGER_DIR=/path/to/stranger-danger \
  make build PROFILE=gitdamnit
```

The exact commits built are recorded in every report. To build from a specific
historical commit without modifying the source repo, export it read-only first:

```sh
git -C /path/to/checkpoint-orchestrator archive 65bf698 | (mkdir -p /tmp/pin/cp && tar -x -C /tmp/pin/cp)
CHECKPOINT_ORCHESTRATOR_DIR=/tmp/pin/cp make build PROFILE=gitdamnit
```

## What is preserved here

- `tests/` — the plugin-specific suites, moved here from `harness/tests/`
  unchanged except for import paths: functional suites for each plugin, plus the
  shared `security`, `concurrency`, `combined` and `checkpoint-triggers` suites.
- `tests/workers/` — the multi-process workers used by the concurrency suite.
- `configs/legacy/` — the original per-plugin `opencode.jsonc` files, kept for
  reference. They are superseded by the generated configurations but are not
  deleted.
- `plugins.tsv` — the original source map, kept as historical reference.

## Historical evidence

The original three-plugin run is committed under
`../../reports/historical/gitdamnit-2026-10-17/`:

- **145 passed / 0 failed / 0 skipped**, OpenCode v2.0.21, Node v22.23.3,
  image `sha256:76ebd805cd54…`
- Checkpoint Orchestrator `2.0.0-dev.2` @ `65bf698`
- Git That Shit `0.3.0` @ `6069f91`
- Stranger Danger `0.2.0` @ `9cfd813`

Those files are **unchanged and clearly labelled as historical**. A fresh run of
this profile validates the generalized lab; it does not relabel the old evidence.

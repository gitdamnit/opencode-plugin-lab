# Architecture

## Overview

```
host                                     container (opencode-plugin-lab:local, no network)
├── scripts/*.sh ── docker compose ─────►  /opt/lab/plugins/<plugin>   (built lab packages)
│                                          /opt/lab/harness/run.mjs    (orchestrator)
├── staging/<plugin>/ (allowlisted)        /opt/lab/configs/<config>    (config templates)
│        │  COPY into plugin-builder       /lab/reports (bind mount)     (output only)
│        ▼                                 /lab/{home,xdg,work} (tmpfs)  (disposable state)
└── reports/ ◄──────────── reports ◄────── /lab/reports/test-report.*
```

## Build stages

### plugin-builder

1. Copies `staging/<plugin>/` (allowlisted sources) and `harness/inspector/`.
2. For each plugin: `npm ci` + the project's own `build` script (`tsc`, …).
3. Assembles a self-contained lab package:

   ```
   /out/plugins/<plugin>/
     index.ts              export { default } from "./dist/<entry>"
     dist/…                the compiled artifacts (real build output)
     package.json          lab metadata + pinned @opencode/plugin dependency
     node_modules/         so the plugin's @opencode/plugin import resolves
     upstream-package.json original package.json (for the report)
     LAB_SOURCE.json       provenance (worktree, branch, SHA, dirty)
   ```

   `index.ts` exists because OpenCode's local-directory loader uses a directory's
   `index.ts`/`index.js` entry rather than `package.json#main`. The shim only
   re-exports the compiled default export; all logic runs from `dist/`.

### runtime

1. Installs the pinned official `@opencode/cli` (V2) plus git, sqlite3, jq,
   python3 and a best-effort `bun` for Git That Shit's own `bun:test` suite.
2. Copies the built packages, harness, configs, fixtures and docs to `/opt/lab`.
3. Creates `/lab` scratch dirs (shadowed by tmpfs at runtime).

## Loading model

OpenCode V2 loads plugins from the `plugins` array in `opencode.json(c)`.
Each entry here is a local package directory:

```jsonc
{ "package": "/opt/lab/plugins/stranger-danger", "options": {} }
```

`opencode` resolves `@opencode/plugin` relative to the plugin directory, which is
why each built package carries its own `node_modules`.

## Isolation model

- **Per configuration:** its own project directory and HOME/XDG trees under
  `/lab/work/runs/<config>/…`, so session databases, plugin state (SQLite
  checkpoints, shadow Git repos, audit logs) never mix.
- **Per run:** the run directory is deleted at the start of each boot, so state
  never leaks between runs.
- **Per container:** `/lab` and `/tmp` are tmpfs; `docker compose down` discards
  everything.

## Verification strategy

| Layer | Mechanism |
| --- | --- |
| Runtime loading | `opencode serve` + `GET /api/plugin` |
| Tool registration | `lab.inspector` reads `ctx.tool.list()` during `setup` |
| Functional behavior | compiled `dist/` engines + plugin CLIs |
| Model-request path | local OpenAI-compatible mock provider captures the outbound body |
| Compatibility (matrix) | all 3! load orders + duplicate entry; per-order tool/conflict checks |
| Security | known-rule detection, idempotent redaction, allowlists, `0600` audit/DB modes, secret-free CLI/audit output, `.env` exclusion, snapshot redaction |
| Concurrency | multi-process SQLite writers, concurrent multi-process snapshots + `git fsck`, parallel redaction, per-session audit isolation |
| Failure isolation | broken plugin (throw / unresolvable) first and last; real plugins + inspector + server stay healthy |
| Combined | all three loaded together; tool-id conflict + FS-delta checks |

Global suites (matrix, security, concurrency, failure isolation) are
configuration-independent and run **once** per invocation. The compatibility
matrix boots the real server once per ordering via an inline config
(`startServer(..., { config })`), so no baked config template is needed.

The model-request test is the key honesty mechanism: it is a *control experiment*
for configurations without Stranger Danger (the synthetic secret must be present
in the captured request) and an *assertion* for configurations with it (the
secret must be absent, a redaction token present). If the capture path were
broken, the control would fail and the suite would report it.

## Failure handling

- A plugin that fails to build fails the image build (no silent fallback).
- A plugin that fails to load is reported by `/api/plugin` as `failed` and the
  runtime suite fails with the server log attached.
- Test failures do not stop the orchestrator; every configuration runs and the
  process exits non-zero if any test failed.

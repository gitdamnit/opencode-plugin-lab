# OpenCode V2 compatibility

The lab drives a specific OpenCode V2 runtime version and records which one it
used in every report. Compatibility is stated per version, and only a run makes
it *verified*.

## Verified (tested end to end)

| Version | Where | Result |
| --- | --- | --- |
| **2.0.21** | the pinned baseline, committed manifests, the historical evidence | verified: real `opencode serve` runtime, plugin loading, tool registration, model-request path |

The historical three-plugin run (`reports/historical/gitdamnit-2026-10-17/`)
was performed on OpenCode **v2.0.21** and Node **v22.23.3**.

## Projected (API surface probed, full matrix not re-run)

| Version | Status | Evidence |
| --- | --- | --- |
| **2.0.32** (latest stable at the time of writing) | projected compatible | `@opencode/cli@2.0.32` installs and reports `opencode v2.0.32`; `@opencode/plugin@2.0.32` exposes the same surface the lab relies on: `Plugin.define({ id, setup })`, `ctx.tool.transform` / `editor.add` / `editor.namespace`, `ctx.tool.hook("execute.before"|"execute.after")`, `ctx.plugin.list()`, `ctx.tool.list()`. |

**Projected is not verified.** The full matrix (server boot, `/api/plugin`,
inspector tool capture, failure isolation, install-from-artifact) has **not**
been run against 2.0.32 in this repository. To verify it:

```sh
make build OPENCODE_VERSION=2.0.32
make suite
make report        # the report records the exact runtime version used
```

The lab never follows `latest` automatically: a manifest pins a version,
`OPENCODE_VERSION` overrides it for one build, and the installed version is baked
into the report.

## What a version bump requires

1. `make build OPENCODE_VERSION=<x>` (network needed for the base image and npm).
2. `make suite`; inspect `## Plugins under test` and the runtime version in the
   report header.
3. If a break appears, it is in one of these surfaces, all of which the lab
   isolates:
   - **CLI/server**: `opencode serve`, `GET /api/info`, `GET /api/plugin`.
   - **Plugin SDK**: `@opencode/plugin` resolution and `Plugin.define`.
   - **Tool domain**: `ctx.tool.transform` / `hook`.
   - **Session/model domain**: the offline mock-provider request path.

   The failing suite names the surface; the fix is confined to the harness
   (`harness/lib/opencode.mjs`, `harness/inspector/index.ts`) or the plugin being
   tested, never to the plugins this lab merely observes.

## Known upstream evolution

OpenCode V2 ships frequently (`2.0.21` → `2.0.3x` within weeks of the baseline).
The lab is designed so that following it is a deliberate, recorded action rather
than silent drift. No breaking change to the lab's assumptions was found between
2.0.21 and 2.0.32 at the API-surface level; the runtime matrix on 2.0.32 remains
unverified until it is run.

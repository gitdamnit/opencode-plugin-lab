# Architecture

## Overview

```
host                                          container (opencode-plugin-lab:local, no network)
lab.config.json  ──► scripts/stage.mjs ─────►  /opt/lab/plugins/<name>      (built lab packages)
  (active manifest)   staging/<name>/          /opt/lab/lab.config.json     (active manifest)
                      staging/_build/plan.json /opt/lab/harness/run.mjs     (orchestrator)
                                               /opt/lab/{profiles,schema,examples}
reports/runs/<id>/ ◄──────── reports ◄──────── /lab/reports (bind mount, output only)
                                               /lab/{home,xdg,work} (tmpfs, disposable)
```

Nothing is hardcoded per plugin. The manifest names plugins, sources,
capabilities, expected tools and configurations; everything downstream is
derived.

## Manifest → plan → build

1. `scripts/stage.mjs --manifest <manifest>` loads and validates the manifest,
   resolves each plugin's source (expanding `~`, `$HOME`, `${VAR:-default}`),
   copies an allowlisted view of it into `staging/<name>/`, scans for
   credential-like files, records provenance into `LAB_SOURCE.json`, and writes
   `staging/_build/plan.json`.
2. `docker/build-plugins.mjs` reads the plan and, per plugin, installs
   dependencies (npm lifecycle scripts disabled unless opted in), runs the build,
   and assembles `/out/plugins/<name>/`:

   ```
   compiled :  index.ts (shim)  dist/…  package.json  node_modules/  upstream-package.json  LAB_SOURCE.json
   prebuilt :  <package files>  package.json  node_modules/  upstream-package.json  LAB_SOURCE.json
   ```

   `index.ts` exists because OpenCode's local-directory loader uses a directory
   entry, not `package.json#main`. The lab inspector is built the same way.
3. The runtime image bakes the built packages, the harness, and **all**
   manifests (`lab.config.json`, `profiles/`, `schema/`, `examples/`).

## Manifest → runtime config

`harness/lib/opencode.mjs#generateConfig` builds each `opencode.json` from the
manifest: the plugin list (absolute package dirs + options), an optional JSONC
template for non-plugin settings, and the lab inspector appended last.

## Loading model

OpenCode V2 loads plugins from the `plugins` array in `opencode.json(c)`:

```jsonc
{ "package": "/opt/lab/plugins/my-plugin", "options": { … } }
```

`opencode` resolves `@opencode/plugin` relative to the plugin directory, which is
why each built package carries its own `node_modules`.

## Isolation model

- **Per configuration:** its own project directory and HOME/XDG trees under
  `/lab/work/runs/<config>/…`, so session databases, plugin state and logs never
  mix. The run directory is deleted at the start of each boot.
- **Per run:** reports are archived under `reports/runs/<run-id>/`; the previous
  run is never overwritten.
- **Per container:** `/lab` and `/tmp` are tmpfs; `make reset` discards
  everything.

## Verification strategy

| Layer | Mechanism |
| --- | --- |
| Runtime loading | `opencode serve` + `GET /api/plugin`; plugins matched by source path (or id) |
| Tool registration | `lab.inspector` reads `ctx.tool.list()` during `setup` |
| Load order & conflicts | all permutations of the widest config + a duplicate entry |
| Failure isolation | broken plugins (throw / unresolvable import) first and last |
| Process cleanup | shutdown exits, port released, no orphan processes |
| Package & provenance | entry resolution, SDK presence, build output, commit/version |
| Install from artifact | `npm pack` the built package, extract, load in the runtime |
| Configuration validation | bad input rejected with an actionable error |
| Model-request path | local OpenAI-compatible mock captures the outbound body |
| Write boundaries | disposable project's top-level entries checked against expectations |

Global suites run **once** per invocation. Per-plugin (`tests`) and manifest-wide
(`globalSuites`) extensions run only while their manifest is active.

## Failure handling

- A plugin that fails to build fails the image build (no silent fallback).
- A plugin that fails to load is reported by `/api/plugin` as `failed`, and the
  runtime suite fails with the server log attached.
- Test failures do not stop the orchestrator; every configuration runs and the
  process exits non-zero if any test failed.
- Capabilities that a plugin does not declare are **skipped**, never faked.

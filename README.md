# OpenCode Plugin Lab

A disposable, isolated Docker test lab for three independently developed
OpenCode **V2** plugins:

| Plugin | Package | Lab source (default) |
| --- | --- | --- |
| Checkpoint Orchestrator | `@gitdamnit/checkpoint-orchestrator` | `~/Projects/checkpoint-orchestrator-v2` |
| Git That Shit | `@gitdamnit/opencode-git-that-shit` | `~/Projects/git-that-shit-v2` |
| Stranger Danger | `@gitdamnit/stranger-danger` | `~/Projects/stranger-danger-v2-hardening` |

The lab stages allowlisted copies of the plugin sources, builds them in a
pinned Node/OpenCode V2 image, and runs five isolated configurations — each with
its own disposable `HOME`, XDG directories, project and SQLite/state — against
the **real OpenCode V2 runtime** (`@opencode/cli`).

It never modifies the plugin repositories, never mounts them into a container,
and never reads credentials from your existing OpenCode installation.

---

## TL;DR

```sh
cd ~/Projects/opencode-plugin-lab

make build        # stage current dev builds + build the Docker image
make start        # baseline smoke check (proves OpenCode V2 boots)
make suite        # full suite across all five configurations
make report       # print the latest report
```

Then launch each test individually:

```sh
make test-baseline           # 1. OpenCode V2, no external plugins
make test-checkpoint         # 2. Checkpoint Orchestrator only
make test-git-that-shit      # 3. Git That Shit only
make test-stranger-danger    # 4. Stranger Danger only
make test-all                # 5. all three together
```

---

## Requirements

- Docker with Compose v2 (BuildKit)
- A POSIX host with `bash`, `make`, `git`, `node`
- Network access **during `make build`** only (npm installs, base image, OpenCode
  CLI). Once built, every offline test runs with `network_mode: "none"`.

---

## Layout

```
opencode-plugin-lab/
├── Dockerfile                 # 2-stage: build plugins, then runtime image
├── compose.yaml               # security-scoped, no-network `lab` service
├── Makefile                   # developer interface
├── lab.env                    # pinned versions + resource limits
├── plugins.tsv                # plugin source map (worktree → allowlist)
├── configs/<name>/opencode.jsonc   # the five isolated configurations
├── scripts/                   # host-side control scripts
├── docker/build-plugins.sh    # in-image plugin build + packaging
├── harness/                   # test harness run inside the container
│   ├── run.mjs                # orchestrator
│   ├── lib/                   # env, server control, assertions, reports
│   ├── tests/                 # runtime + functional + model + combined
│   ├── inspector/             # lab plugin that records runtime registration
│   └── mock-model-server.mjs  # offline OpenAI-compatible provider
├── fixtures/                  # disposable fixture templates (non-secret)
├── docs/                      # architecture + security notes
├── staging/                   # generated allowlisted sources (gitignored)
└── reports/                   # generated JSON + Markdown reports
```

---

## The five configurations

Each configuration is a self-contained OpenCode project with its own
`opencode.json`, HOME/XDG directories, session database and plugin state.

| # | Config | `opencode.json` | Expected third-party plugins |
| --- | --- | --- | --- |
| 1 | `baseline` | `configs/baseline` | none |
| 2 | `checkpoint-orchestrator` | `configs/checkpoint-orchestrator` | `gitdamnit.checkpoint-orchestrator` |
| 3 | `git-that-shit` | `configs/git-that-shit` | `gitdamnit.git-that-shit` |
| 4 | `stranger-danger` | `configs/stranger-danger` | `gitdamnit.stranger-danger` |
| 5 | `all` | `configs/all` | all three |

Plugins are loaded through the **official V2 `plugins` configuration** as local
package directories (`{"package": "/opt/lab/plugins/<name>", "options": {...}}`).
Every config that loads plugins also loads a lab-owned `lab.inspector` plugin
last, which records the runtime's active plugins and the tools that were
actually registered.

---

## Test tiers

| Tier | What runs |
| --- | --- |
| `smoke` | Server boots, plugin registry queried, tools recorded, no load errors |
| `functional` | smoke + the plugin's functional engine tests |
| `model` | Offline model-request path via a local mock provider |
| `integration` | smoke + combined all-plugins compatibility |
| `security` | Security suite (Stranger Danger, Checkpoint, Git That Shit) |
| `validate` | everything: runtime + functional + model + combined + all global suites |
| `all` | alias of `validate` |

`make test CONFIG=<name> TIER=<tier>` runs a single combination. `make suite`
runs `--all` across the five configs at tier `all`.

### Global suites (run once, configuration-independent)

| Suite | What it proves |
| --- | --- |
| `matrix` | All 3! load orders load cleanly, every tool registers, no tool-id conflicts, plus a duplicate-entry case |
| `security` | Known-rule detection, idempotent redaction, no false positives, window-boundary secrets, regex allowlists, `0600` audit/DB files, secret-free CLI/audit output, mandatory `.env` exclusion, snapshot redaction |
| `concurrency` | Multi-process SQLite writers (distinct + same session), concurrent multi-process snapshots with `git fsck`, parallel redaction, per-session audit isolation |
| `failure-isolation` | A plugin that throws in `setup`, and one that cannot resolve its entry, loaded **first and last** — the real plugins, the inspector, and the server stay healthy |
| `checkpoint-triggers` | Live-runtime verification of Checkpoint's automatic triggers: Trigger B (periodic autosave on `session.hook("prompt")`) and Trigger A (compaction). Each is attributed with the other disabled; if a trigger is not observable it is reported as **skipped/unverified**, never passed |

### Release-candidate evidence (`make rc-evidence`)

Produces `reports/rc-evidence.json` / `.md` comparing, per plugin: **source** branch/SHA/dirty/version, **staged** version, **packed** tarball version + sha256, and the **installed** version/SHA baked into the image, with a consistency check.

### Harness-only iteration (no image rebuild)

While iterating on the harness you can bind-mount it read-only over the baked
copy, which leaves the reproducible image untouched:

```sh
docker compose -f compose.yaml -p opencode-plugin-lab run --rm --no-deps \
  -v "$PWD/harness:/opt/lab/harness:ro" lab \
  node /opt/lab/harness/run.mjs --all --tier validate
```

---

## How OpenCode is verified (not mocked)

The harness drives the real `opencode` binary inside the container:

1. **Runtime loading** — boots `opencode serve` in an isolated HOME/XDG/project,
   then queries `GET /api/plugin` and asserts the expected plugins are present,
   active, and that no plugin is in a `failed` state.
2. **Tool registration** — the `lab.inspector` plugin reads `ctx.plugin.list()`
   and `ctx.tool.list()` during `setup` and writes the result as JSON. The tests
   assert every expected tool id (`checkpoint_*`, `gts_*`, `sd_*`) is present.
3. **Model-request path (offline)** — a local OpenAI-compatible mock provider
   records the exact request body OpenCode sends. For configurations with
   Stranger Danger, the synthetic secret must be absent and a redaction token
   present; for control configurations the secret must be present. This verifies
   redaction on the **supported request path** without any outbound traffic.

Functional tests exercise each plugin's compiled engine (`dist/…`) and its CLI
where present, using real artifacts produced by the build stage.

---

## Disposable fixtures and destructive tests

Every destructive test (Git That Shit restore, prune, concurrent snapshots) runs
against throwaway Git repositories created under a tmpfs and deleted afterwards.
Nothing is ever run against a real repository. The Checkpoint handoff test reads
JSON exports — a live SQLite database is never copied as a "backup".

---

## Security posture

The offline `lab` service:

- `network_mode: "none"` — no outbound networking after the image is built
- no host Docker socket, no `--privileged`, no host networking
- `read_only` rootfs with small `tmpfs` scratch mounts (all test data disposable)
- all capabilities dropped, `no-new-privileges`
- runs as your host uid/gid (non-root)
- no published ports; the server binds `127.0.0.1` inside the container only
- resource limits (memory, CPUs, PIDs) and `restart: "no"`
- only `./reports` is bind-mounted out; the plugin repositories are never mounted

The only service with networking is `lab-online`, behind the `online` profile and
used exclusively by `make test-online`.

See [`docs/SECURITY.md`](docs/SECURITY.md) for details.

---

## Staging and refreshing plugin builds

`scripts/stage.sh` copies an allowlist of files (from `plugins.tsv`) into
`staging/<plugin>/`, excluding `node_modules`, `.git`, build output, images and
every `.env*`. It refuses to proceed if a credential-like file slips through, and
records the source worktree, branch, commit SHA and dirty state.

Because the plugin projects are under active development, always refresh before
a meaningful run:

```sh
make refresh          # re-stage current builds and rebuild the image
make refresh ARGS=--no-cache   # force a clean rebuild
```

`make discover` shows the currently resolved worktree, version, commit and dirty
state for each plugin.

---

## Reports

Every run writes:

- `reports/test-report.json` — machine-readable (schema `opencode-plugin-lab/report/v1`)
- `reports/test-report.md` — human-readable
- a timestamped JSON copy per run

Reports include the OpenCode runtime version, plugin package versions and commit
SHAs, build inventory, runtime plugin-loading status, functional results,
combined compatibility results, failures with logs, and remaining unverified
behaviors. Credentials are never written to reports or logs.

`reports/sample-report.md` is a committed example.

---

## Optional online model test

Disabled by default. To enable, copy `.env.example` to `.env`, add a **dedicated,
limited test credential**, then:

```sh
make test-online CONFIG=baseline
```

The lab reads credentials only from `.env`; it never imports them from
`~/.config/opencode`, `auth.json`, or any existing OpenCode data directory.

Note: the online test verifies provider reachability. Outbound redaction is
verified **offline** by the `model-path` tier against the supported request path
against the local mock provider — the online test deliberately does not claim it.

---

## Command reference

```
make help                 Show all commands
make build                Stage sources + build the image
make stage                Stage allowlisted sources only
make discover             Show plugin worktrees / versions / commits
make start                Build if needed + baseline smoke check
make stop                 Stop lab containers
make logs                 Container logs + latest report
make test CONFIG=x TIER=y Run a single configuration/tier
make test-baseline|test-checkpoint|test-git-that-shit|test-stranger-danger|test-all
make suite                Full suite, all five configurations
make test-online          Optional online model test (.env required)
make refresh              Re-stage current builds + rebuild
make reset                Reset disposable test data
make report               Print the latest report
make shell                Interactive shell in the lab container (no network)
make clean                Remove lab image, staged sources and reports
```

---

## Troubleshooting

- **`configured plugin path must be a directory`** — plugins are loaded as
  package directories, not file paths. This is how the configs reference
  `/opt/lab/plugins/<name>`.
- **`Cannot find package '@opencode/plugin'`** — a plugin package is missing its
  `node_modules`. The build stage installs `@opencode/plugin` (pinned) next to
  every staged plugin; re-run `make build`.
- **Plugin shows `failed` in `/api/plugin`** — check the server log under the
  run directory; the report embeds it for failing suites.
- **A plugin build fails** — the image build fails loudly rather than shipping a
  stale artifact. Check the staged sources with `make discover` and rebuild.

---

## Future improvements (deferred, not functional blockers)

- **Image size / export time.** The image is ~3.61 GB with ~73k files, dominated
  by four identical copies of `@opencode/plugin` (~189 MB / ~17.8k files each).
  Installing the SDK once and symlinking `node_modules/@opencode` into each plugin
  directory would remove ~570 MB and ~53k files — but must be re-verified with a
  loading test before adoption.
- **Drop the optional global `bun`** (85 MB) from the runtime image; it is only
  needed for Git That Shit's own `bun:test` suite, which the harness does not run.
- **Build when the host is quieter**, or run the build under
  `nice -n 19 ionice -c3`; exports take minutes under load because rootless
  overlayfs writes ~3.6 GB / ~73k files on a single volume.

## What this lab does not do

- It does not modify, build inside, or mount the plugin repositories.
- It does not touch your existing OpenCode installation or running sessions.
- It does not use the V1 `opencode-ai` package.
- It does not verify provider-native WebSocket traffic or the >256 MiB
  fail-closed branch (documented as remaining unverified in each report).

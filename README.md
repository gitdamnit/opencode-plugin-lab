# OpenCode Plugin Lab

A disposable, isolated Docker test lab for **OpenCode V2 plugins**. Point it at
any plugin and it builds the plugin, loads it in the *real* `opencode` runtime,
and checks the things plugin authors actually care about: does it load, do its
tools register, does it collide with other plugins, does it survive running next
to a broken plugin, does it clean up, and what exactly gets installed.

It does not touch your OpenCode installation, never mounts a development
repository into a container, and runs entirely offline after the image is built.

- **Default manifest works out of the box** — no external plugins required; it
  tests two tiny bundled example plugins.
- **Bring your own plugin** — a local source directory, a packed tarball, or an
  already-built package, configurable by name and path.
- **Test several together** — load-order permutations, tool-name collisions and
  failure isolation are generic.
- **Optional regression profile** — reproduce the original three-plugin
  compatibility matrix without making those plugins a dependency of the lab.

> The lab is a **standalone developer tool**, not a loadable OpenCode plugin.
> See [Ecosystem & distribution](#ecosystem--distribution).

---

## Five-minute quick start

```sh
git clone https://github.com/gitdamnit/opencode-plugin-lab
cd opencode-plugin-lab

make build      # stage the bundled example plugins + build the Docker image
make start      # smoke-check the default configuration
make suite      # full generic suite across every configuration
make report     # print the latest report
```

`make discover` lists the plugins and configurations in the active manifest.

### Test your own plugin

```sh
make test-plugin PLUGIN=/path/to/your-plugin
```

That generates a temporary single-plugin manifest, stages and builds your plugin,
and runs the full generic suite. Nothing is committed. Add `NAME=...`,
`TYPE=directory|package|tarball` or `ENTRY=index.js` to override the guesses.

---

## Requirements

- Docker with Compose v2 (BuildKit)
- A POSIX host with `bash`, `make`, `git`, `node` (the scripts are bash + Node
  ESM; macOS and Linux are supported, Windows via WSL2)
- Network access **during `make build` only** (npm installs, base image, OpenCode
  CLI). Once built, every test runs with `network_mode: "none"`.

## Supported OpenCode versions

| Version | Status |
| --- | --- |
| **2.0.21** | **Reproducible tested baseline.** The pinned version in every committed manifest and in the historical evidence. |
| **2.0.32** | **Verified by evaluation** (`make build OPENCODE_VERSION=2.0.32 && make suite`): 76 pass / 0 fail / 5 skip, identical to 2.0.21. Not the pinned default. |

The OpenCode V2 line moves quickly. The lab never silently follows `latest`: a
manifest pins an exact version, `make build OPENCODE_VERSION=…` selects another
for a one-off evaluation, and the **exact installed version is recorded in every
report**. See [`docs/OPENCODE_COMPATIBILITY.md`](docs/OPENCODE_COMPATIBILITY.md).

---

## How it works (in one picture)

```
host                                      container (opencode-plugin-lab:local, no network)
lab.config.json ──► scripts/stage.mjs ──►  /opt/lab/plugins/<name>   (built lab packages)
   (manifest)         staging/<name>/      /opt/lab/harness/run.mjs   (orchestrator)
                                          /opt/lab/lab.config.json    (active manifest)
reports/ ◄──────────── reports ◄─────────  /lab/reports (bind mount, output only)
                                          /lab/{home,xdg,work} (tmpfs, disposable)
```

A manifest declares plugins and configurations. Staging copies each plugin's
source (allowlisted, credential-scanned) into the build context; the builder
installs dependencies and runs the plugin's build; the runtime image loads the
built packages by absolute path through OpenCode's official `plugins`
configuration. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## The default configurations

`lab.config.json` ships four configurations and two example plugins:

| Config | Plugins | What it proves |
| --- | --- | --- |
| `baseline` | none | the runtime boots cleanly with no external plugins |
| `example-plugin` | `example-plugin` | a compiled plugin registers a tool and cleans up |
| `single-plugin` | `example-plugin` (+ option override) | a single plugin with explicit options |
| `multi-plugin` | `example-plugin`, `example-plugin-2` | a tool registerer **and** a no-tool plugin coexist |

Test one: `make test CONFIG=multi-plugin TIER=validate`.

### Test tiers

| Tier | What runs |
| --- | --- |
| `smoke` | server boots; plugins load; package inspection |
| `functional` | smoke + package inspection |
| `model` | offline model-request path via a local mock provider |
| `integration` | smoke + load-order permutations |
| `security` | configuration validation & error handling |
| `validate` / `all` | everything: per-config runtime + model, plus every global suite |

### Global suites (run once, configuration-independent)

| Suite | What it proves |
| --- | --- |
| `package-inspection` | package metadata, SDK resolution, entry point, build output, provenance |
| `load-order` | every load-order permutation + duplicate entry; tool ids unique, no conflicts |
| `failure-isolation` | a plugin that throws in `setup`, and one with an unresolvable import, loaded first and last — everything else stays healthy |
| `process-cleanup` | graceful shutdown exits the process, releases the port, leaves no orphans |
| `install-artifact` | the `npm pack`ed artifact (not just the build tree) loads in the runtime |
| `config-validation` | bad configuration input is rejected with a useful error, not a crash |

Capabilities are respected: a plugin that registers no tools is not failed for
"missing tools" — the assertion is **skipped** and reported as such.

---

## Configuration schema and examples

The full JSON Schema is [`schema/lab.config.schema.json`](schema/lab.config.schema.json);
a walkthrough with copy-paste examples is [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md).

```sh
node scripts/lab-manifest.mjs validate            # lint the default manifest
node scripts/lab-manifest.mjs validate --manifest my-lab.config.json
node scripts/lab-manifest.mjs discover            # show sources/versions/commits
```

Minimal single-plugin manifest:

```jsonc
{
  "$schema": "./schema/lab.config.schema.json",
  "version": 1,
  "plugins": [
    { "name": "my-plugin",
      "source": { "type": "directory", "path": "../my-plugin" },
      "build": { "command": "npm run build", "dist": "dist", "entry": "index.js" },
      "capabilities": { "tools": true },
      "expectTools": ["my_tool"] }
  ],
  "configs": [ { "name": "my-plugin", "plugins": ["my-plugin"] } ]
}
```

Plugin inputs supported: `directory` (built), `package` (prebuilt, used as-is),
`tarball` (a local `.tgz`), and `npm` (opt-in only via `allowRemote`; never fetched
silently). No plugin is assumed to be in a particular npm scope, and public
manifests contain no hardcoded home paths.

---

## Optional regression profile (three @gitdamnit plugins)

The lab originally validated three independent plugins. That work is preserved as
an **optional profile** — not a dependency of the default lab:

```sh
make build PROFILE=gitdamnit      # stage + build the three plugins
make suite PROFILE=gitdamnit      # full suite incl. their specialized assertions
make test-checkpoint PROFILE=gitdamnit
```

Source paths default to `$HOME/Projects/...` and are overridable without editing
the profile:

```sh
CHECKPOINT_ORCHESTRATOR_DIR=... GIT_THAT_SHIT_DIR=... STRANGER_DANGER_DIR=... \
  make build PROFILE=gitdamnit
```

See [`profiles/gitdamnit/README.md`](profiles/gitdamnit/README.md). The original
`145 passed / 0 failed` run and its release-candidate evidence are **committed,
unchanged, and clearly labelled as historical** under
[`reports/historical/`](reports/historical/gitdamnit-2026-10-17/). They are not
relabelled as validation of this generalized lab.

---

## Test extensions

A manifest can add its own suites for a plugin-specific capability:

- per-plugin: `"tests": ["tests/my-plugin.mjs"]`
- manifest-wide: `"globalSuites": [{ "name": "my-suite", "module": "tests/suite.mjs" }]`

Each module exports `run({ tier, plugin })`. See
[`docs/CONFIGURATION.md`](docs/CONFIGURATION.md#test-extensions) and the profile
tests for complete examples. Extensions run **only** when their manifest is
active — a fresh user never runs the three-plugin assertions.

---

## Reports

Every run writes a dated, self-contained report and leaves the previous ones
untouched:

```
reports/runs/<run-id>/test-report.json   machine-readable (schema v1)
reports/runs/<run-id>/test-report.md     human-readable
reports/test-report.{json,md}            convenience pointer to the latest run
```

Reports record: the manifest (name, path, digest), OpenCode and Node versions,
container image id, per-plugin version/commit/branch/dirty/source-type, the exact
requested configuration, PASS/FAIL/SKIP counts by area, failures with logs,
security warnings, and a reproduction command. Credentials are never written.

`make rc-evidence` additionally produces `reports/rc-evidence.{json,md}`:
source → staged → packed tarball (+ sha256) → installed-in-image, with a
consistency check.

---

## Security model

The offline `lab` service: `network_mode: "none"`, `read_only` rootfs with small
tmpfs scratch mounts, all capabilities dropped, `no-new-privileges`, runs as your
host uid/gid, no published ports, resource limits, `restart: "no"`. Only
`./reports` is bind-mounted out; the plugin repositories are never mounted into a
container. The only networked service is `lab-online`, behind the `online`
profile, used exclusively by `make test-online`.

Never mounted: host SSH/npm/cloud credentials, your real OpenCode configuration,
entire home directories, or the Docker daemon socket.

**Rootless Docker reduces risk but is not an absolute boundary against malicious
plugin code.** Plugin source is built (dependencies + build scripts run) and then
loaded by the runtime; review untrusted plugins before pointing the lab at them.
Install-time lifecycle scripts are disabled by default (`install.scripts: false`);
a plugin that needs them must opt in. See
[`docs/SECURITY.md`](docs/SECURITY.md).

---

## Command reference

```
make help                 Show all commands
make build                Stage sources + build the image
make stage                Stage manifest sources only
make discover             Show plugin sources, versions, commits, configs
make start                Build if needed + smoke-check the default config
make stop                 Stop lab containers
make logs                 Container logs + latest report
make test CONFIG=x TIER=y Run one configuration/tier
make suite                Full suite across every configuration
make validate             Full validation incl. all global suites
make rc-evidence          Source/packed/installed version evidence
make test-plugin PLUGIN=… Build and test an arbitrary local plugin
make profile PROFILE=…    Build + full suite for an optional profile
make test-online          Optional online model test (.env required)
make refresh              Re-stage sources and rebuild
make reset                Reset disposable test data
make report               Print the latest report
make shell                Interactive shell in the lab container
make clean                Remove lab image, staged sources and reports
```

Select a manifest with `PROFILE=<name>` (see `profiles/`) or `LAB_MANIFEST_FILE=<path>`.

---

## Docker troubleshooting

- **Rootless Docker** maps container UIDs into a subuid range, so a host-owned
  directory is not writable by a non-root container. `scripts/lib.sh` chmods
  `./reports` to `0777` for this reason; if a fresh run cannot write reports,
  check `docker info` reports `rootless`.
- **`configured plugin path must be a directory`** — plugins are loaded as
  package directories, not file paths.
- **`Cannot find package '@opencode/plugin'`** — a built package is missing its
  SDK dependency. Re-run `make build`; the builder installs it next to every
  plugin.
- **Plugin shows `failed` in `/api/plugin`** — the report embeds the server log
  for failing suites; the plugin's `setup` most likely threw.
- **A plugin build fails** — the image build fails loudly on purpose rather than
  shipping a stale artifact. Run `make discover` and check the staged source.

---

## Ecosystem & distribution

This lab is a **standalone developer/testing tool**. It is not a loadable
OpenCode runtime plugin, and it is not published to any plugin registry. It is
distributed as source on GitHub and run with Docker. See
[`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md) for the publication
procedure and the suggested repository description and topics.

## License

MIT — see [`LICENSE`](LICENSE) and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
Change history: [`CHANGELOG.md`](CHANGELOG.md).

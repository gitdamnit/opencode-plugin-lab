# Release-candidate verification — three plugins together

**Verdict: the latest three development candidates pass together.** 145/145 lab
tests passed, plus 83/83 of Checkpoint Orchestrator's own suites run against the
built artifact. Rootless Docker isolation and all production services were
untouched. No repositories were modified; nothing was published, merged, or
tagged; global OpenCode configuration was not changed.

## Artifacts verified (source = staged = packed = installed)

| Plugin | Version | Commit | Branch | Worktree | Consistent |
| --- | --- | --- | --- | --- | --- |
| Checkpoint Orchestrator | `2.0.0-dev.1` | `bedc14b` | `feat/sqlite-opencode-v2` | clean | yes |
| Git That Shit | `0.3.0` | `afddd15` | `feat/git-that-shit-v2-hardening` | clean | yes |
| Stranger Danger | `0.2.0` | `5465988` | `feat/stranger-danger-v2-hardening` | clean | yes |

Full evidence (source SHA/dirty, staged version, packed tarball version + sha256,
installed version/SHA from the image): [`rc-evidence.md`](rc-evidence.md) /
[`rc-evidence.json`](rc-evidence.json).

Built image: `opencode-plugin-lab:local` (`a3c40f5e9c87`, per-plugin install
metadata read back from `/opt/lab/plugins/*/upstream-package.json` and
`LAB_SOURCE.json`).

## Stale-build finding (requirement 3)

The previous lab run did **not** merely misreport the commit — it genuinely
installed and tested a stale Checkpoint build. Evidence read back from the prior
image: `upstream-package.json` → `2.0.0-dev.0`, `LAB_SOURCE.json` → commit
`2a099b4b…`, `dirty: true`. The current image contains `2.0.0-dev.1` @ `bedc14b`
(`dirty: false`). The image was rebuilt because installing the correct artifacts
was required for valid evidence; nothing else was changed.

## Lab validation — `--all --tier validate`

| Area | Pass | Fail | Skipped |
| --- | --- | --- | --- |
| Runtime plugin loading (5 configs) | 29 | 0 | 0 |
| Functional tests (incl. namespaced handoff + legacy safeguards) | 60 | 0 | 0 |
| Model-request path (offline mock provider) | 15 | 0 | 0 |
| Combined compatibility (all three) | 8 | 0 | 0 |
| Plugin compatibility matrix (all 6 load orders + duplicate) | 7 | 0 | 0 |
| Security | 16 | 0 | 0 |
| Concurrency & crash consistency | 5 | 0 | 0 |
| Failure isolation | 3 | 0 | 0 |
| **Checkpoint automatic triggers (live runtime)** | **2** | 0 | 0 |
| **Total** | **145** | **0** | **0** |

Machine-readable: [`test-report.json`](test-report.json) · human: [`test-report.md`](test-report.md).

## Checkpoint new behavior (requirements 7 & 8)

- **Namespaced handoff (verified):** exports go to
  `<project>/.opencode/state/checkpoint-orchestrator/handoff-<session>.md`; the
  plugin writes nothing to the shared `.opencode/state` root; a sibling plugin's
  file there is byte-identical afterwards. (`checkpoint.handoff-namespaced-and-isolated`, `combined.checkpoint-handoff-through-stranger-danger`.)
- **Legacy migration safeguards (verified):** import is a no-op when disabled;
  a foreign payload at the legacy path is reported and left untouched; a valid
  legacy checkpoint imports into the `legacy::<projectID>` namespace with backups
  written inside the plugin's own namespace and originals byte-identical;
  re-import is idempotent. Also 12 upstream legacy tests pass.
- **Trigger B — periodic autosave (verified, live runtime):** with
  `autosaveEvery=1` and automatic compaction disabled, an admitted prompt set the
  session's `lastAutosaveAt` and reset `messagesSinceSave` (the B-specific,
  persisted signal). `tickPrompt` correctly does not synthesize when no
  checkpoint exists.
- **Trigger A — compaction (verified, live runtime):** with `autosaveEvery=0`
  (B disabled), a compaction request against a live session persisted a
  synthesized checkpoint — attributable only to the compaction path.

## Independent upstream cross-check

Checkpoint Orchestrator's own suites, run against the built `dist` inside the
container: **83/83** (`isolation.test.js` + `legacy.test.js` = 29; `store` +
`service` + `unit` = 54). See [`rc-upstream-tests.md`](rc-upstream-tests.md).

## Limitations / remaining unverified

- Live provider credentials and online model calls: disabled by default; not exercised.
- Outbound redaction verified on the supported HTTP model path via the offline mock provider; provider-native WebSocket traffic is not covered.
- Stranger Danger's >256 MiB fail-closed branch asserted by constant, not by a >256 MiB allocation.
- Hook registration observed indirectly (tool registration + the trigger/model paths); OpenCode exposes no hook-enumeration API.
- Checkpoint's `plugin.test.js` / `interop.test.js` not run (need package-name + `@opencode/plugin` resolution); their areas are covered by lab runtime/matrix/trigger suites.
- Image size / export time is a deferred infrastructure improvement, not a functional blocker.

## Blockers

- None.

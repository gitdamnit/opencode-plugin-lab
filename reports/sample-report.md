# OpenCode Plugin Lab — Test Report

- Generated: 2026-10-15T17:04:35.842Z
- OpenCode runtime: opencode v2.0.21
- Node: v22.23.3 (linux/x64)
- Image: opencode-plugin-lab:local
- Config: all configurations · tier: validate · online: false
- Duration: 128.0s

## Summary

| Result | Count |
| --- | --- |
| Pass | 145 |
| Fail | 0 |
| Skipped | 0 |
| Total | 145 |

### By area

| Area | Pass | Fail | Skipped |
| --- | --- | --- | --- |
| Runtime plugin loading | 29 | 0 | 0 |
| Functional tests | 60 | 0 | 0 |
| Model-request path (offline mock provider) | 15 | 0 | 0 |
| Combined compatibility | 8 | 0 | 0 |
| Plugin compatibility matrix (load orders) | 7 | 0 | 0 |
| Security tests | 16 | 0 | 0 |
| Concurrency & crash consistency | 5 | 0 | 0 |
| Failure isolation | 3 | 0 | 0 |
| Checkpoint automatic triggers (live runtime) | 2 | 0 | 0 |

## Plugin packages under test

| Plugin | Version | Commit | Branch | Dirty |
| --- | --- | --- | --- | --- |
| checkpoint-orchestrator | 2.0.0-dev.1 | bedc14babf | feat/sqlite-opencode-v2 | false |
| git-that-shit | 0.3.0 | afddd15a20 | feat/git-that-shit-v2-hardening | false |
| stranger-danger | 0.2.0 | 5465988597 | feat/stranger-danger-v2-hardening | false |

## Runtime plugin loading

Pass 29 · Fail 0 · Skipped 0

- ✅ `runtime/baseline` `runtime.server-boot` (8ms)
- ✅ `runtime/baseline` `runtime.plugins-active` (15ms)
- ✅ `runtime/baseline` `runtime.no-load-errors` (0ms)
- ✅ `runtime/baseline` `runtime.log-snapshot` (0ms)
- ✅ `runtime/baseline` `runtime.cleanup` (302ms)
- ✅ `runtime/checkpoint-orchestrator` `runtime.server-boot` (95ms)
- ✅ `runtime/checkpoint-orchestrator` `runtime.plugins-active` (20ms)
- ✅ `runtime/checkpoint-orchestrator` `runtime.tools-registered` (3ms)
- ✅ `runtime/checkpoint-orchestrator` `runtime.no-load-errors` (1ms)
- ✅ `runtime/checkpoint-orchestrator` `runtime.log-snapshot` (0ms)
- ✅ `runtime/checkpoint-orchestrator` `runtime.cleanup` (301ms)
- ✅ `runtime/git-that-shit` `runtime.server-boot` (3ms)
- ✅ `runtime/git-that-shit` `runtime.plugins-active` (11ms)
- ✅ `runtime/git-that-shit` `runtime.tools-registered` (0ms)
- ✅ `runtime/git-that-shit` `runtime.no-load-errors` (0ms)
- ✅ `runtime/git-that-shit` `runtime.log-snapshot` (1ms)
- ✅ `runtime/git-that-shit` `runtime.cleanup` (300ms)
- ✅ `runtime/stranger-danger` `runtime.server-boot` (15ms)
- ✅ `runtime/stranger-danger` `runtime.plugins-active` (18ms)
- ✅ `runtime/stranger-danger` `runtime.tools-registered` (0ms)
- ✅ `runtime/stranger-danger` `runtime.no-load-errors` (1ms)
- ✅ `runtime/stranger-danger` `runtime.log-snapshot` (0ms)
- ✅ `runtime/stranger-danger` `runtime.cleanup` (345ms)
- ✅ `runtime/all` `runtime.server-boot` (5ms)
- ✅ `runtime/all` `runtime.plugins-active` (21ms)
- ✅ `runtime/all` `runtime.tools-registered` (0ms)
- ✅ `runtime/all` `runtime.no-load-errors` (0ms)
- ✅ `runtime/all` `runtime.log-snapshot` (1ms)
- ✅ `runtime/all` `runtime.cleanup` (455ms)

## Functional tests

Pass 60 · Fail 0 · Skipped 0

- ✅ `functional/checkpoint-orchestrator` `checkpoint.path-resolution` (1ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.sqlite-init` (5ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.create-load-status` (7ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.multiple-session-ids` (4ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.snapshots-restore` (6ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.concurrent-writes` (48ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.restart-recovery` (5ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.handoff-namespaced-and-isolated` (6ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.legacy-import-disabled-is-a-noop` (2ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.legacy-foreign-payload-left-alone` (3ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.legacy-import-copies-and-backs-up` (4ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.clear` (3ms)
- ✅ `functional/git-that-shit` `gts.init-shadow-repo` (622ms)
- ✅ `functional/git-that-shit` `gts.automatic-snapshot` (173ms)
- ✅ `functional/git-that-shit` `gts.manual-snapshot-cli` (259ms)
- ✅ `functional/git-that-shit` `gts.snapshot-git-history` (108ms)
- ✅ `functional/git-that-shit` `gts.locking` (2871ms)
- ✅ `functional/git-that-shit` `gts.restore-dry-run` (350ms)
- ✅ `functional/git-that-shit` `gts.real-restore` (214ms)
- ✅ `functional/git-that-shit` `gts.simultaneous-sessions` (699ms)
- ✅ `functional/stranger-danger` `sd.scan-synthetic-keys` (14ms)
- ✅ `functional/stranger-danger` `sd.file-reads-cli-secret-free` (104ms)
- ✅ `functional/stranger-danger` `sd.context-redaction` (3ms)
- ✅ `functional/stranger-danger` `sd.tool-output-protection` (1ms)
- ✅ `functional/stranger-danger` `sd.large-output-windowed-scan` (914ms)
- ✅ `functional/stranger-danger` `sd.large-output-oversize-fails-closed` (0ms)
- ✅ `functional/stranger-danger` `sd.allowlist-suppresses-finding` (7ms)
- ✅ `functional/stranger-danger` `sd.audit-records-secret-free` (0ms)
- ✅ `functional/stranger-danger` `sd.multiple-sessions-isolated-audit-paths` (1ms)
- ✅ `functional/stranger-danger` `sd.safe-finding-projection` (1ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.path-resolution` (0ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.sqlite-init` (11ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.create-load-status` (7ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.multiple-session-ids` (9ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.snapshots-restore` (140ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.concurrent-writes` (42ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.restart-recovery` (6ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.handoff-namespaced-and-isolated` (5ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.legacy-import-disabled-is-a-noop` (52ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.legacy-foreign-payload-left-alone` (2ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.legacy-import-copies-and-backs-up` (4ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.clear` (3ms)
- ✅ `functional/git-that-shit` `gts.init-shadow-repo` (83ms)
- ✅ `functional/git-that-shit` `gts.automatic-snapshot` (183ms)
- ✅ `functional/git-that-shit` `gts.manual-snapshot-cli` (318ms)
- ✅ `functional/git-that-shit` `gts.snapshot-git-history` (191ms)
- ✅ `functional/git-that-shit` `gts.locking` (3097ms)
- ✅ `functional/git-that-shit` `gts.restore-dry-run` (397ms)
- ✅ `functional/git-that-shit` `gts.real-restore` (346ms)
- ✅ `functional/git-that-shit` `gts.simultaneous-sessions` (481ms)
- ✅ `functional/stranger-danger` `sd.scan-synthetic-keys` (4ms)
- ✅ `functional/stranger-danger` `sd.file-reads-cli-secret-free` (289ms)
- ✅ `functional/stranger-danger` `sd.context-redaction` (0ms)
- ✅ `functional/stranger-danger` `sd.tool-output-protection` (0ms)
- ✅ `functional/stranger-danger` `sd.large-output-windowed-scan` (749ms)
- ✅ `functional/stranger-danger` `sd.large-output-oversize-fails-closed` (0ms)
- ✅ `functional/stranger-danger` `sd.allowlist-suppresses-finding` (0ms)
- ✅ `functional/stranger-danger` `sd.audit-records-secret-free` (0ms)
- ✅ `functional/stranger-danger` `sd.multiple-sessions-isolated-audit-paths` (1ms)
- ✅ `functional/stranger-danger` `sd.safe-finding-projection` (0ms)

## Model-request path (offline mock provider)

Pass 15 · Fail 0 · Skipped 0

- ✅ `model-path/baseline` `model.run-completes` (0ms)
- ✅ `model-path/baseline` `model.request-reached-provider` (0ms)
- ✅ `model-path/baseline` `model.control-transmits-secret` (0ms)
- ✅ `model-path/checkpoint-orchestrator` `model.run-completes` (0ms)
- ✅ `model-path/checkpoint-orchestrator` `model.request-reached-provider` (0ms)
- ✅ `model-path/checkpoint-orchestrator` `model.control-transmits-secret` (0ms)
- ✅ `model-path/git-that-shit` `model.run-completes` (0ms)
- ✅ `model-path/git-that-shit` `model.request-reached-provider` (0ms)
- ✅ `model-path/git-that-shit` `model.control-transmits-secret` (0ms)
- ✅ `model-path/stranger-danger` `model.run-completes` (0ms)
- ✅ `model-path/stranger-danger` `model.request-reached-provider` (0ms)
- ✅ `model-path/stranger-danger` `model.secret-redacted-before-transmission` (0ms)
- ✅ `model-path/all` `model.run-completes` (0ms)
- ✅ `model-path/all` `model.request-reached-provider` (0ms)
- ✅ `model-path/all` `model.secret-redacted-before-transmission` (0ms)

## Combined compatibility

Pass 8 · Fail 0 · Skipped 0

- ✅ `combined/all-plugins` `combined.all-plugins-active` (20ms)
- ✅ `combined/all-plugins` `combined.no-tool-name-conflicts` (3ms)
- ✅ `combined/all-plugins` `combined.no-unexpected-project-writes` (0ms)
- ✅ `combined/all-plugins` `combined.server-log-clean` (0ms)
- ✅ `combined/all-plugins` `combined.cleanup` (302ms)
- ✅ `combined/all-plugins` `combined.checkpoint-handoff-through-stranger-danger` (9ms)
- ✅ `combined/all-plugins` `combined.no-live-database-copied-as-backup` (1ms)
- ✅ `combined/all-plugins` `combined.git-that-shit-snapshots-config-artifacts` (148ms)

## Plugin compatibility matrix (load orders)

Pass 7 · Fail 0 · Skipped 0

- ✅ `matrix/load-order` `matrix.order.cp>gts>sd` (5429ms)
- ✅ `matrix/load-order` `matrix.order.cp>sd>gts` (4462ms)
- ✅ `matrix/load-order` `matrix.order.gts>cp>sd` (4362ms)
- ✅ `matrix/load-order` `matrix.order.gts>sd>cp` (5556ms)
- ✅ `matrix/load-order` `matrix.order.sd>cp>gts` (4183ms)
- ✅ `matrix/load-order` `matrix.order.sd>gts>cp` (4693ms)
- ✅ `matrix/load-order` `matrix.duplicate-entry` (5597ms)

## Security tests

Pass 16 · Fail 0 · Skipped 0

- ✅ `security/all-plugins` `security.sd-known-rule-detection` (1ms)
- ✅ `security/all-plugins` `security.sd-redaction-is-idempotent` (1ms)
- ✅ `security/all-plugins` `security.sd-preserves-benign-content` (0ms)
- ✅ `security/all-plugins` `security.sd-no-false-positives` (0ms)
- ✅ `security/all-plugins` `security.sd-secret-across-window-boundary` (748ms)
- ✅ `security/all-plugins` `security.sd-allowlist-by-regex` (1ms)
- ✅ `security/all-plugins` `security.sd-audit-file-mode-0600` (0ms)
- ✅ `security/all-plugins` `security.sd-audit-never-stores-secret` (0ms)
- ✅ `security/all-plugins` `security.sd-safe-projection-secret-free` (0ms)
- ✅ `security/all-plugins` `security.sd-cli-output-secret-free` (454ms)
- ✅ `security/all-plugins` `security.sd-oversize-is-fail-closed` (0ms)
- ✅ `security/all-plugins` `security.checkpoint-db-permissions` (1ms)
- ✅ `security/all-plugins` `security.checkpoint-db-outside-project` (0ms)
- ✅ `security/all-plugins` `security.checkpoint-session-isolation` (2ms)
- ✅ `security/all-plugins` `security.gts-excludes-sensitive-env` (83ms)
- ✅ `security/all-plugins` `security.gts-redacts-secret-in-tracked-file` (99ms)

## Concurrency & crash consistency

Pass 5 · Fail 0 · Skipped 0

- ✅ `concurrency/multi-process` `concurrency.checkpoint-multi-process-distinct-sessions` (304ms)
- ✅ `concurrency/multi-process` `concurrency.checkpoint-multi-process-same-session` (317ms)
- ✅ `concurrency/multi-process` `concurrency.gts-multi-process-snapshots` (667ms)
- ✅ `concurrency/multi-process` `concurrency.sd-parallel-redaction` (214ms)
- ✅ `concurrency/multi-process` `concurrency.sd-audit-sessions-do-not-mix` (2ms)

## Failure isolation

Pass 3 · Fail 0 · Skipped 0

- ✅ `failure-isolation/broken-plugin` `failure-isolation.broken-first` (5605ms)
- ✅ `failure-isolation/broken-plugin` `failure-isolation.broken-last` (5296ms)
- ✅ `failure-isolation/broken-plugin` `failure-isolation.unresolvable-import-first` (5354ms)

## Checkpoint automatic triggers (live runtime)

Pass 2 · Fail 0 · Skipped 0

- ✅ `checkpoint-triggers/live-runtime` `checkpoint.trigger-b-periodic-autosave` (4109ms)
- ✅ `checkpoint-triggers/live-runtime` `checkpoint.trigger-a-compaction` (5252ms)

## Blockers

- None. All required validations passed.

## Limitations / remaining unverified behaviors

- Live provider credential paths are not exercised unless `--online` and a dedicated test key are supplied (disabled by default).
- Outbound redaction is verified on the supported HTTP model-request path via the offline mock provider; provider-native WebSocket traffic (experimental) is not covered.
- The stranger-danger oversize fail-closed branch (>256MiB) is asserted by its constant, not by allocating a >256MiB payload inside the resource-limited container.
- Hook registration is observed indirectly (through tool registration and the offline model path); OpenCode exposes no API to enumerate hooks.
- Tool-result transformations beyond the prompt/context/output paths depend on the same hooks and are covered by the functional suite rather than distinct live sessions.
- Plugin cleanup is verified by graceful server shutdown; explicit registration disposal / plugin unload is not separately asserted.
- The compatibility matrix covers the three plugins in every load order plus a duplicate entry, but not arbitrary third-party plugins.

## Future improvements (not required for this validation)

- Image size / export time (deferred, not a functional issue): the final image is ~3.61GB with ~73k files, dominated by four identical copies of `@opencode/plugin` (~189MB / ~17.8k files each). Installing the SDK once and symlinking `node_modules/@opencode` into each plugin directory would remove ~570MB and ~53k files, but must be re-verified with a loading test before adoption.
- Drop the optional global `bun` (85MB) from the runtime image; it is only needed for Git That Shit's own `bun:test` suite, which the lab harness does not run.
- Build when the host is quieter or run the build under `nice -n 19 ionice -c3`; exports take minutes under load because rootless overlayfs writes ~3.6GB / ~73k files on a single volume.

## Reproduce

```sh
make suite
```

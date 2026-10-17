# OpenCode Plugin Lab — Test Report

- Run id: 2026-10-17T02-08-02-793Z
- Generated: 2026-10-17T02:09:45.756Z
- OpenCode runtime: opencode v2.0.21
- Node: v22.23.3 (linux/x64)
- Image: opencode-plugin-lab:local (sha256:e3f9f4a326bd129d6324a2637f6d34b3fa7c7b42252be1069dd547ddf9bbf3e4)
- Manifest: opencode-plugin-lab · gitdamnit regression profile · `/opt/lab/profiles/gitdamnit/lab.config.json` · digest a016cb649ce2dd25…
- Config: all configurations · tier: validate · online: false
- Duration: 102.8s

## Summary

| Result | Count |
| --- | --- |
| Pass | 153 |
| Fail | 0 |
| Skipped | 8 |
| Total | 161 |

### By area

| Area | Pass | Fail | Skipped |
| --- | --- | --- | --- |
| Runtime plugin loading | 34 | 0 | 5 |
| Model-request path (offline mock provider) | 15 | 0 | 3 |
| Package inspection & provenance | 19 | 0 | 0 |
| Load-order permutations & tool conflicts | 7 | 0 | 0 |
| Failure isolation | 3 | 0 | 0 |
| Process cleanup | 4 | 0 | 0 |
| Install from built artifact | 6 | 0 | 0 |
| Configuration validation & error handling | 4 | 0 | 0 |
| security/all-plugins | 16 | 0 | 0 |
| concurrency/multi-process | 5 | 0 | 0 |
| combined/all-plugins | 8 | 0 | 0 |
| checkpoint-triggers/live-runtime | 2 | 0 | 0 |
| functional/checkpoint-orchestrator | 12 | 0 | 0 |
| functional/git-that-shit | 8 | 0 | 0 |
| functional/stranger-danger | 10 | 0 | 0 |

## Plugins under test

| Plugin | Version | Commit | Branch | Dirty | Source type |
| --- | --- | --- | --- | --- | --- |
| checkpoint-orchestrator | 2.0.0-dev.2 | ? | ? | ? | directory |
| git-that-shit | 0.3.0 | ? | ? | ? | directory |
| stranger-danger | 0.2.0 | ? | ? | ? | directory |

## Security warnings

- No source commit recorded for: checkpoint-orchestrator, git-that-shit, stranger-danger (not a git worktree?).
- Third-party plugin code runs in the container during build and load. Rootless Docker limits but does not eliminate risk; do not run untrusted plugins without reviewing them.

## Runtime plugin loading

Pass 34 · Fail 0 · Skipped 5

- ✅ `runtime/baseline` `runtime.server-boot` (63ms)
- ✅ `runtime/baseline` `runtime.plugins-active` (21ms)
- ✅ `runtime/baseline` `runtime.no-load-errors` (0ms)
- ⏭️ `runtime/baseline` `runtime.lifecycle-setup` (0ms) — no plugin declares a setup marker
- ✅ `runtime/baseline` `runtime.write-boundaries` (0ms)
- ✅ `runtime/baseline` `runtime.log-snapshot` (0ms)
- ✅ `runtime/baseline` `runtime.cleanup` (301ms)
- ✅ `runtime/checkpoint-orchestrator` `runtime.server-boot` (4ms)
- ✅ `runtime/checkpoint-orchestrator` `runtime.plugins-active` (7ms)
- ✅ `runtime/checkpoint-orchestrator` `runtime.tools-registered` (0ms)
- ✅ `runtime/checkpoint-orchestrator` `runtime.no-load-errors` (0ms)
- ⏭️ `runtime/checkpoint-orchestrator` `runtime.lifecycle-setup` (0ms) — no plugin declares a setup marker
- ✅ `runtime/checkpoint-orchestrator` `runtime.write-boundaries` (1ms)
- ✅ `runtime/checkpoint-orchestrator` `runtime.log-snapshot` (0ms)
- ✅ `runtime/checkpoint-orchestrator` `runtime.cleanup` (151ms)
- ✅ `runtime/git-that-shit` `runtime.server-boot` (4ms)
- ✅ `runtime/git-that-shit` `runtime.plugins-active` (10ms)
- ✅ `runtime/git-that-shit` `runtime.tools-registered` (0ms)
- ✅ `runtime/git-that-shit` `runtime.no-load-errors` (0ms)
- ⏭️ `runtime/git-that-shit` `runtime.lifecycle-setup` (0ms) — no plugin declares a setup marker
- ✅ `runtime/git-that-shit` `runtime.write-boundaries` (1ms)
- ✅ `runtime/git-that-shit` `runtime.log-snapshot` (0ms)
- ✅ `runtime/git-that-shit` `runtime.cleanup` (150ms)
- ✅ `runtime/stranger-danger` `runtime.server-boot` (7ms)
- ✅ `runtime/stranger-danger` `runtime.plugins-active` (13ms)
- ✅ `runtime/stranger-danger` `runtime.tools-registered` (0ms)
- ✅ `runtime/stranger-danger` `runtime.no-load-errors` (0ms)
- ⏭️ `runtime/stranger-danger` `runtime.lifecycle-setup` (0ms) — no plugin declares a setup marker
- ✅ `runtime/stranger-danger` `runtime.write-boundaries` (1ms)
- ✅ `runtime/stranger-danger` `runtime.log-snapshot` (0ms)
- ✅ `runtime/stranger-danger` `runtime.cleanup` (150ms)
- ✅ `runtime/all` `runtime.server-boot` (3ms)
- ✅ `runtime/all` `runtime.plugins-active` (15ms)
- ✅ `runtime/all` `runtime.tools-registered` (0ms)
- ✅ `runtime/all` `runtime.no-load-errors` (1ms)
- ⏭️ `runtime/all` `runtime.lifecycle-setup` (0ms) — no plugin declares a setup marker
- ✅ `runtime/all` `runtime.write-boundaries` (0ms)
- ✅ `runtime/all` `runtime.log-snapshot` (0ms)
- ✅ `runtime/all` `runtime.cleanup` (313ms)

## Model-request path (offline mock provider)

Pass 15 · Fail 0 · Skipped 3

- ✅ `model-path/baseline` `model.run-completes` (0ms)
- ✅ `model-path/baseline` `model.request-reached-provider` (0ms)
- ✅ `model-path/baseline` `model.control-transmits-secret` (1ms)
- ⏭️ `model-path/baseline` `model.redaction` (0ms) — no plugin in this configuration declares capabilities.redaction
- ✅ `model-path/checkpoint-orchestrator` `model.run-completes` (0ms)
- ✅ `model-path/checkpoint-orchestrator` `model.request-reached-provider` (0ms)
- ✅ `model-path/checkpoint-orchestrator` `model.control-transmits-secret` (0ms)
- ⏭️ `model-path/checkpoint-orchestrator` `model.redaction` (0ms) — no plugin in this configuration declares capabilities.redaction
- ✅ `model-path/git-that-shit` `model.run-completes` (0ms)
- ✅ `model-path/git-that-shit` `model.request-reached-provider` (0ms)
- ✅ `model-path/git-that-shit` `model.control-transmits-secret` (0ms)
- ⏭️ `model-path/git-that-shit` `model.redaction` (0ms) — no plugin in this configuration declares capabilities.redaction
- ✅ `model-path/stranger-danger` `model.run-completes` (0ms)
- ✅ `model-path/stranger-danger` `model.request-reached-provider` (0ms)
- ✅ `model-path/stranger-danger` `model.secret-redacted-before-transmission` (0ms)
- ✅ `model-path/all` `model.run-completes` (0ms)
- ✅ `model-path/all` `model.request-reached-provider` (0ms)
- ✅ `model-path/all` `model.secret-redacted-before-transmission` (0ms)

## Package inspection & provenance

Pass 19 · Fail 0 · Skipped 0

- ✅ `package-inspection/artifacts` `package.checkpoint-orchestrator.present` (0ms)
- ✅ `package-inspection/artifacts` `package.checkpoint-orchestrator.metadata` (1ms)
- ✅ `package-inspection/artifacts` `package.checkpoint-orchestrator.sdk-resolvable` (0ms)
- ✅ `package-inspection/artifacts` `package.checkpoint-orchestrator.entry-resolves` (1ms)
- ✅ `package-inspection/artifacts` `package.checkpoint-orchestrator.build-output` (1ms)
- ✅ `package-inspection/artifacts` `package.checkpoint-orchestrator.provenance` (1ms)
- ✅ `package-inspection/artifacts` `package.git-that-shit.present` (0ms)
- ✅ `package-inspection/artifacts` `package.git-that-shit.metadata` (0ms)
- ✅ `package-inspection/artifacts` `package.git-that-shit.sdk-resolvable` (1ms)
- ✅ `package-inspection/artifacts` `package.git-that-shit.entry-resolves` (0ms)
- ✅ `package-inspection/artifacts` `package.git-that-shit.build-output` (3ms)
- ✅ `package-inspection/artifacts` `package.git-that-shit.provenance` (0ms)
- ✅ `package-inspection/artifacts` `package.stranger-danger.present` (1ms)
- ✅ `package-inspection/artifacts` `package.stranger-danger.metadata` (0ms)
- ✅ `package-inspection/artifacts` `package.stranger-danger.sdk-resolvable` (0ms)
- ✅ `package-inspection/artifacts` `package.stranger-danger.entry-resolves` (1ms)
- ✅ `package-inspection/artifacts` `package.stranger-danger.build-output` (3ms)
- ✅ `package-inspection/artifacts` `package.stranger-danger.provenance` (0ms)
- ✅ `package-inspection/artifacts` `package.inspector.present` (0ms)

## Load-order permutations & tool conflicts

Pass 7 · Fail 0 · Skipped 0

- ✅ `load-order/permutations` `load-order.order.checkpointorchestrator_gitthatshit_strangerdanger` (3343ms)
- ✅ `load-order/permutations` `load-order.order.checkpointorchestrator_strangerdanger_gitthatshit` (3609ms)
- ✅ `load-order/permutations` `load-order.order.gitthatshit_checkpointorchestrator_strangerdanger` (3804ms)
- ✅ `load-order/permutations` `load-order.order.gitthatshit_strangerdanger_checkpointorchestrator` (3466ms)
- ✅ `load-order/permutations` `load-order.order.strangerdanger_checkpointorchestrator_gitthatshit` (3930ms)
- ✅ `load-order/permutations` `load-order.order.strangerdanger_gitthatshit_checkpointorchestrator` (3225ms)
- ✅ `load-order/permutations` `load-order.duplicate-entry` (3522ms)

## Failure isolation

Pass 3 · Fail 0 · Skipped 0

- ✅ `failure-isolation/broken-plugin` `failure-isolation.broken-first` (3169ms)
- ✅ `failure-isolation/broken-plugin` `failure-isolation.broken-last` (3005ms)
- ✅ `failure-isolation/broken-plugin` `failure-isolation.unresolvable-import-first` (2842ms)

## Process cleanup

Pass 4 · Fail 0 · Skipped 0

- ✅ `process-cleanup/graceful-shutdown` `process-cleanup.server-alive` (3ms)
- ✅ `process-cleanup/graceful-shutdown` `process-cleanup.shutdown-exits` (151ms)
- ✅ `process-cleanup/graceful-shutdown` `process-cleanup.port-released` (403ms)
- ✅ `process-cleanup/graceful-shutdown` `process-cleanup.no-orphans` (1902ms)

## Install from built artifact

Pass 6 · Fail 0 · Skipped 0

- ✅ `install-artifact/packaged` `install.checkpoint-orchestrator.pack` (1324ms)
- ✅ `install-artifact/packaged` `install.checkpoint-orchestrator.loads-in-runtime` (1890ms)
- ✅ `install-artifact/packaged` `install.git-that-shit.pack` (737ms)
- ✅ `install-artifact/packaged` `install.git-that-shit.loads-in-runtime` (2076ms)
- ✅ `install-artifact/packaged` `install.stranger-danger.pack` (741ms)
- ✅ `install-artifact/packaged` `install.stranger-danger.loads-in-runtime` (1970ms)

## Configuration validation & error handling

Pass 4 · Fail 0 · Skipped 0

- ✅ `config-validation/errors` `config-validation.unknown-configuration` (0ms)
- ✅ `config-validation/errors` `config-validation.invalid-manifest-rejected` (1ms)
- ✅ `config-validation/errors` `config-validation.missing-plugin-directory` (1831ms)
- ✅ `config-validation/errors` `config-validation.malformed-package-json` (2417ms)

## security/all-plugins

Pass 16 · Fail 0 · Skipped 0

- ✅ `security/all-plugins` `security.sd-known-rule-detection` (3ms)
- ✅ `security/all-plugins` `security.sd-redaction-is-idempotent` (2ms)
- ✅ `security/all-plugins` `security.sd-preserves-benign-content` (2ms)
- ✅ `security/all-plugins` `security.sd-no-false-positives` (0ms)
- ✅ `security/all-plugins` `security.sd-secret-across-window-boundary` (642ms)
- ✅ `security/all-plugins` `security.sd-allowlist-by-regex` (1ms)
- ✅ `security/all-plugins` `security.sd-audit-file-mode-0600` (1ms)
- ✅ `security/all-plugins` `security.sd-audit-never-stores-secret` (0ms)
- ✅ `security/all-plugins` `security.sd-safe-projection-secret-free` (1ms)
- ✅ `security/all-plugins` `security.sd-cli-output-secret-free` (141ms)
- ✅ `security/all-plugins` `security.sd-oversize-is-fail-closed` (0ms)
- ✅ `security/all-plugins` `security.checkpoint-db-permissions` (3ms)
- ✅ `security/all-plugins` `security.checkpoint-db-outside-project` (0ms)
- ✅ `security/all-plugins` `security.checkpoint-session-isolation` (8ms)
- ✅ `security/all-plugins` `security.gts-excludes-sensitive-env` (696ms)
- ✅ `security/all-plugins` `security.gts-redacts-secret-in-tracked-file` (59ms)

## concurrency/multi-process

Pass 5 · Fail 0 · Skipped 0

- ✅ `concurrency/multi-process` `concurrency.checkpoint-multi-process-distinct-sessions` (160ms)
- ✅ `concurrency/multi-process` `concurrency.checkpoint-multi-process-same-session` (135ms)
- ✅ `concurrency/multi-process` `concurrency.gts-multi-process-snapshots` (577ms)
- ✅ `concurrency/multi-process` `concurrency.sd-parallel-redaction` (161ms)
- ✅ `concurrency/multi-process` `concurrency.sd-audit-sessions-do-not-mix` (2ms)

## combined/all-plugins

Pass 8 · Fail 0 · Skipped 0

- ✅ `combined/all-plugins` `combined.all-plugins-active` (134ms)
- ✅ `combined/all-plugins` `combined.no-tool-name-conflicts` (0ms)
- ✅ `combined/all-plugins` `combined.no-unexpected-project-writes` (0ms)
- ✅ `combined/all-plugins` `combined.server-log-clean` (0ms)
- ✅ `combined/all-plugins` `combined.cleanup` (482ms)
- ✅ `combined/all-plugins` `combined.checkpoint-handoff-through-stranger-danger` (6ms)
- ✅ `combined/all-plugins` `combined.no-live-database-copied-as-backup` (0ms)
- ✅ `combined/all-plugins` `combined.git-that-shit-snapshots-config-artifacts` (185ms)

## checkpoint-triggers/live-runtime

Pass 2 · Fail 0 · Skipped 0

- ✅ `checkpoint-triggers/live-runtime` `checkpoint.trigger-b-periodic-autosave` (3091ms)
- ✅ `checkpoint-triggers/live-runtime` `checkpoint.trigger-a-compaction` (4149ms)

## functional/checkpoint-orchestrator

Pass 12 · Fail 0 · Skipped 0

- ✅ `functional/checkpoint-orchestrator` `checkpoint.path-resolution` (0ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.sqlite-init` (3ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.create-load-status` (4ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.multiple-session-ids` (4ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.snapshots-restore` (8ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.concurrent-writes` (31ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.restart-recovery` (4ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.handoff-namespaced-and-isolated` (6ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.legacy-import-disabled-is-a-noop` (5ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.legacy-foreign-payload-left-alone` (3ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.legacy-import-copies-and-backs-up` (11ms)
- ✅ `functional/checkpoint-orchestrator` `checkpoint.clear` (5ms)

## functional/git-that-shit

Pass 8 · Fail 0 · Skipped 0

- ✅ `functional/git-that-shit` `gts.init-shadow-repo` (64ms)
- ✅ `functional/git-that-shit` `gts.automatic-snapshot` (106ms)
- ✅ `functional/git-that-shit` `gts.manual-snapshot-cli` (200ms)
- ✅ `functional/git-that-shit` `gts.snapshot-git-history` (150ms)
- ✅ `functional/git-that-shit` `gts.locking` (2871ms)
- ✅ `functional/git-that-shit` `gts.restore-dry-run` (171ms)
- ✅ `functional/git-that-shit` `gts.real-restore` (168ms)
- ✅ `functional/git-that-shit` `gts.simultaneous-sessions` (378ms)

## functional/stranger-danger

Pass 10 · Fail 0 · Skipped 0

- ✅ `functional/stranger-danger` `sd.scan-synthetic-keys` (0ms)
- ✅ `functional/stranger-danger` `sd.file-reads-cli-secret-free` (79ms)
- ✅ `functional/stranger-danger` `sd.context-redaction` (1ms)
- ✅ `functional/stranger-danger` `sd.tool-output-protection` (0ms)
- ✅ `functional/stranger-danger` `sd.large-output-windowed-scan` (691ms)
- ✅ `functional/stranger-danger` `sd.large-output-oversize-fails-closed` (1ms)
- ✅ `functional/stranger-danger` `sd.allowlist-suppresses-finding` (1ms)
- ✅ `functional/stranger-danger` `sd.audit-records-secret-free` (1ms)
- ✅ `functional/stranger-danger` `sd.multiple-sessions-isolated-audit-paths` (0ms)
- ✅ `functional/stranger-danger` `sd.safe-finding-projection` (1ms)

## Blockers

- None. All required validations passed.

## Limitations / remaining unverified behaviors

- Live provider credential paths are not exercised unless `--online` and a dedicated test key are supplied (disabled by default).
- Outbound redaction is only asserted for plugins that declare capabilities.redaction; it is verified on the supported HTTP model-request path via the offline mock provider, never on provider-native WebSocket traffic.
- Docker (rootless or otherwise) reduces but does not eliminate the risk of malicious plugin code; plugins are not a hard security sandbox.
- Install-from-artifact packs the built output with npm scripts disabled and supplies the plugin SDK offline; a package that relies on install-time scripts is reported as skipped rather than forced.
- Persistence for "checkpoint-orchestrator" is exercised only through the generic write-boundary check, not a plugin-specific storage audit.
- Persistence for "git-that-shit" is exercised only through the generic write-boundary check, not a plugin-specific storage audit.
- Persistence for "stranger-danger" is exercised only through the generic write-boundary check, not a plugin-specific storage audit.

## Reproduce

```sh
make suite
# (built with the profile manifest: /opt/lab/profiles/gitdamnit/lab.config.json)
```

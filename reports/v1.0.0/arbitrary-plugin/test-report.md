# OpenCode Plugin Lab — Test Report

- Run id: 2026-10-17T02-15-38-449Z
- Generated: 2026-10-17T02:16:08.881Z
- OpenCode runtime: opencode v2.0.21
- Node: v22.23.3 (linux/x64)
- Image: opencode-plugin-lab:local
- Manifest: local plugin: stranger-danger-pin · `/opt/lab/lab.config.json` · digest a55be923bcb9fcc2…
- Config: all configurations · tier: all · online: false
- Duration: 30.3s

## Summary

| Result | Count |
| --- | --- |
| Pass | 30 |
| Fail | 0 |
| Skipped | 3 |
| Total | 33 |

### By area

| Area | Pass | Fail | Skipped |
| --- | --- | --- | --- |
| Runtime plugin loading | 6 | 0 | 2 |
| Model-request path (offline mock provider) | 2 | 0 | 1 |
| Package inspection & provenance | 7 | 0 | 0 |
| Load-order permutations & tool conflicts | 2 | 0 | 0 |
| Failure isolation | 3 | 0 | 0 |
| Process cleanup | 4 | 0 | 0 |
| Install from built artifact | 2 | 0 | 0 |
| Configuration validation & error handling | 4 | 0 | 0 |

## Plugins under test

| Plugin | Version | Commit | Branch | Dirty | Source type |
| --- | --- | --- | --- | --- | --- |
| stranger-danger-pin | 0.2.0 | ? | ? | ? | directory |

## Security warnings

- No source commit recorded for: stranger-danger-pin (not a git worktree?).
- Third-party plugin code runs in the container during build and load. Rootless Docker limits but does not eliminate risk; do not run untrusted plugins without reviewing them.

## Runtime plugin loading

Pass 6 · Fail 0 · Skipped 2

- ✅ `runtime/plugin` `runtime.server-boot` (9ms)
- ✅ `runtime/plugin` `runtime.plugins-active` (37ms)
- ⏭️ `runtime/plugin` `runtime.tools-registered` (0ms) — no plugin in this configuration declares tools; tool registration not applicable
- ✅ `runtime/plugin` `runtime.no-load-errors` (0ms)
- ⏭️ `runtime/plugin` `runtime.lifecycle-setup` (0ms) — no plugin declares a setup marker
- ✅ `runtime/plugin` `runtime.write-boundaries` (0ms)
- ✅ `runtime/plugin` `runtime.log-snapshot` (0ms)
- ✅ `runtime/plugin` `runtime.cleanup` (302ms)

## Model-request path (offline mock provider)

Pass 2 · Fail 0 · Skipped 1

- ✅ `model-path/plugin` `model.run-completes` (0ms)
- ✅ `model-path/plugin` `model.request-reached-provider` (0ms)
- ⏭️ `model-path/plugin` `model.redaction` (0ms) — plugin appears to redact the request but did not declare capabilities.redaction; declare it to assert strictly

## Package inspection & provenance

Pass 7 · Fail 0 · Skipped 0

- ✅ `package-inspection/artifacts` `package.stranger-danger-pin.present` (0ms)
- ✅ `package-inspection/artifacts` `package.stranger-danger-pin.metadata` (1ms)
- ✅ `package-inspection/artifacts` `package.stranger-danger-pin.sdk-resolvable` (0ms)
- ✅ `package-inspection/artifacts` `package.stranger-danger-pin.entry-resolves` (1ms)
- ✅ `package-inspection/artifacts` `package.stranger-danger-pin.build-output` (4ms)
- ✅ `package-inspection/artifacts` `package.stranger-danger-pin.provenance` (1ms)
- ✅ `package-inspection/artifacts` `package.inspector.present` (0ms)

## Load-order permutations & tool conflicts

Pass 2 · Fail 0 · Skipped 0

- ✅ `load-order/permutations` `load-order.order.strangerdangerpin` (2052ms)
- ✅ `load-order/permutations` `load-order.duplicate-entry` (2039ms)

## Failure isolation

Pass 3 · Fail 0 · Skipped 0

- ✅ `failure-isolation/broken-plugin` `failure-isolation.broken-first` (2058ms)
- ✅ `failure-isolation/broken-plugin` `failure-isolation.broken-last` (2054ms)
- ✅ `failure-isolation/broken-plugin` `failure-isolation.unresolvable-import-first` (2071ms)

## Process cleanup

Pass 4 · Fail 0 · Skipped 0

- ✅ `process-cleanup/graceful-shutdown` `process-cleanup.server-alive` (3ms)
- ✅ `process-cleanup/graceful-shutdown` `process-cleanup.shutdown-exits` (150ms)
- ✅ `process-cleanup/graceful-shutdown` `process-cleanup.port-released` (407ms)
- ✅ `process-cleanup/graceful-shutdown` `process-cleanup.no-orphans` (142ms)

## Install from built artifact

Pass 2 · Fail 0 · Skipped 0

- ✅ `install-artifact/packaged` `install.stranger-danger-pin.pack` (2482ms)
- ✅ `install-artifact/packaged` `install.stranger-danger-pin.loads-in-runtime` (1893ms)

## Configuration validation & error handling

Pass 4 · Fail 0 · Skipped 0

- ✅ `config-validation/errors` `config-validation.unknown-configuration` (0ms)
- ✅ `config-validation/errors` `config-validation.invalid-manifest-rejected` (1ms)
- ✅ `config-validation/errors` `config-validation.missing-plugin-directory` (1860ms)
- ✅ `config-validation/errors` `config-validation.malformed-package-json` (1871ms)

## Blockers

- None. All required validations passed.

## Limitations / remaining unverified behaviors

- Live provider credential paths are not exercised unless `--online` and a dedicated test key are supplied (disabled by default).
- Outbound redaction is only asserted for plugins that declare capabilities.redaction; it is verified on the supported HTTP model-request path via the offline mock provider, never on provider-native WebSocket traffic.
- Docker (rootless or otherwise) reduces but does not eliminate the risk of malicious plugin code; plugins are not a hard security sandbox.
- Install-from-artifact packs the built output with npm scripts disabled and supplies the plugin SDK offline; a package that relies on install-time scripts is reported as skipped rather than forced.

## Reproduce

```sh
make suite
```

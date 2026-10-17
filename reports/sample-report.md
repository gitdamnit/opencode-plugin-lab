# OpenCode Plugin Lab — Test Report

- Run id: 2026-10-17T02-23-31-053Z
- Generated: 2026-10-17T02:24:13.903Z
- OpenCode runtime: opencode v2.0.21
- Node: v22.23.3 (linux/x64)
- Image: opencode-plugin-lab:local (sha256:8991705754c61317e9ab1eef000b8ecd13dee8cc48381adcdcf63f011a7a4f0e)
- Manifest: opencode-plugin-lab (default: bundled example plugin) · `/opt/lab/lab.config.json` · digest ef54a1d29680ecb8…
- Config: all configurations · tier: all · online: false
- Duration: 42.7s

## Summary

| Result | Count |
| --- | --- |
| Pass | 76 |
| Fail | 0 |
| Skipped | 5 |
| Total | 81 |

### By area

| Area | Pass | Fail | Skipped |
| --- | --- | --- | --- |
| Runtime plugin loading | 33 | 0 | 1 |
| Model-request path (offline mock provider) | 12 | 0 | 4 |
| Package inspection & provenance | 13 | 0 | 0 |
| Load-order permutations & tool conflicts | 3 | 0 | 0 |
| Failure isolation | 3 | 0 | 0 |
| Process cleanup | 4 | 0 | 0 |
| Install from built artifact | 4 | 0 | 0 |
| Configuration validation & error handling | 4 | 0 | 0 |

## Plugins under test

| Plugin | Version | Commit | Branch | Dirty | Source type |
| --- | --- | --- | --- | --- | --- |
| example-plugin | 1.0.0 | 96e67fc43e | release/v1.0.0 | true | directory |
| example-plugin-2 | 1.0.0 | 96e67fc43e | release/v1.0.0 | true | package |

## Security warnings

- Staged from a dirty worktree (uncommitted changes): example-plugin, example-plugin-2. Results may not reproduce from the recorded commit.
- Third-party plugin code runs in the container during build and load. Rootless Docker limits but does not eliminate risk; do not run untrusted plugins without reviewing them.

## Runtime plugin loading

Pass 33 · Fail 0 · Skipped 1

- ✅ `runtime/baseline` `runtime.server-boot` (4ms)
- ✅ `runtime/baseline` `runtime.plugins-active` (8ms)
- ✅ `runtime/baseline` `runtime.no-load-errors` (0ms)
- ⏭️ `runtime/baseline` `runtime.lifecycle-setup` (0ms) — no plugin declares a setup marker
- ✅ `runtime/baseline` `runtime.write-boundaries` (0ms)
- ✅ `runtime/baseline` `runtime.log-snapshot` (0ms)
- ✅ `runtime/baseline` `runtime.cleanup` (300ms)
- ✅ `runtime/example-plugin` `runtime.server-boot` (4ms)
- ✅ `runtime/example-plugin` `runtime.plugins-active` (10ms)
- ✅ `runtime/example-plugin` `runtime.tools-registered` (0ms)
- ✅ `runtime/example-plugin` `runtime.no-load-errors` (0ms)
- ✅ `runtime/example-plugin` `runtime.lifecycle-setup` (0ms)
- ✅ `runtime/example-plugin` `runtime.write-boundaries` (1ms)
- ✅ `runtime/example-plugin` `runtime.log-snapshot` (0ms)
- ✅ `runtime/example-plugin` `runtime.cleanup` (151ms)
- ✅ `runtime/example-plugin` `runtime.lifecycle-cleanup` (0ms)
- ✅ `runtime/single-plugin` `runtime.server-boot` (2ms)
- ✅ `runtime/single-plugin` `runtime.plugins-active` (7ms)
- ✅ `runtime/single-plugin` `runtime.tools-registered` (0ms)
- ✅ `runtime/single-plugin` `runtime.no-load-errors` (0ms)
- ✅ `runtime/single-plugin` `runtime.lifecycle-setup` (0ms)
- ✅ `runtime/single-plugin` `runtime.write-boundaries` (1ms)
- ✅ `runtime/single-plugin` `runtime.log-snapshot` (0ms)
- ✅ `runtime/single-plugin` `runtime.cleanup` (149ms)
- ✅ `runtime/single-plugin` `runtime.lifecycle-cleanup` (0ms)
- ✅ `runtime/multi-plugin` `runtime.server-boot` (3ms)
- ✅ `runtime/multi-plugin` `runtime.plugins-active` (5ms)
- ✅ `runtime/multi-plugin` `runtime.tools-registered` (0ms)
- ✅ `runtime/multi-plugin` `runtime.no-load-errors` (0ms)
- ✅ `runtime/multi-plugin` `runtime.lifecycle-setup` (0ms)
- ✅ `runtime/multi-plugin` `runtime.write-boundaries` (0ms)
- ✅ `runtime/multi-plugin` `runtime.log-snapshot` (0ms)
- ✅ `runtime/multi-plugin` `runtime.cleanup` (151ms)
- ✅ `runtime/multi-plugin` `runtime.lifecycle-cleanup` (0ms)

## Model-request path (offline mock provider)

Pass 12 · Fail 0 · Skipped 4

- ✅ `model-path/baseline` `model.run-completes` (0ms)
- ✅ `model-path/baseline` `model.request-reached-provider` (1ms)
- ✅ `model-path/baseline` `model.control-transmits-secret` (0ms)
- ⏭️ `model-path/baseline` `model.redaction` (0ms) — no plugin in this configuration declares capabilities.redaction
- ✅ `model-path/example-plugin` `model.run-completes` (0ms)
- ✅ `model-path/example-plugin` `model.request-reached-provider` (0ms)
- ✅ `model-path/example-plugin` `model.control-transmits-secret` (0ms)
- ⏭️ `model-path/example-plugin` `model.redaction` (0ms) — no plugin in this configuration declares capabilities.redaction
- ✅ `model-path/single-plugin` `model.run-completes` (0ms)
- ✅ `model-path/single-plugin` `model.request-reached-provider` (0ms)
- ✅ `model-path/single-plugin` `model.control-transmits-secret` (0ms)
- ⏭️ `model-path/single-plugin` `model.redaction` (0ms) — no plugin in this configuration declares capabilities.redaction
- ✅ `model-path/multi-plugin` `model.run-completes` (1ms)
- ✅ `model-path/multi-plugin` `model.request-reached-provider` (0ms)
- ✅ `model-path/multi-plugin` `model.control-transmits-secret` (0ms)
- ⏭️ `model-path/multi-plugin` `model.redaction` (0ms) — no plugin in this configuration declares capabilities.redaction

## Package inspection & provenance

Pass 13 · Fail 0 · Skipped 0

- ✅ `package-inspection/artifacts` `package.example-plugin.present` (0ms)
- ✅ `package-inspection/artifacts` `package.example-plugin.metadata` (0ms)
- ✅ `package-inspection/artifacts` `package.example-plugin.sdk-resolvable` (0ms)
- ✅ `package-inspection/artifacts` `package.example-plugin.entry-resolves` (0ms)
- ✅ `package-inspection/artifacts` `package.example-plugin.build-output` (0ms)
- ✅ `package-inspection/artifacts` `package.example-plugin.provenance` (1ms)
- ✅ `package-inspection/artifacts` `package.example-plugin-2.present` (0ms)
- ✅ `package-inspection/artifacts` `package.example-plugin-2.metadata` (0ms)
- ✅ `package-inspection/artifacts` `package.example-plugin-2.sdk-resolvable` (0ms)
- ✅ `package-inspection/artifacts` `package.example-plugin-2.entry-resolves` (0ms)
- ✅ `package-inspection/artifacts` `package.example-plugin-2.build-output` (0ms)
- ✅ `package-inspection/artifacts` `package.example-plugin-2.provenance` (1ms)
- ✅ `package-inspection/artifacts` `package.inspector.present` (0ms)

## Load-order permutations & tool conflicts

Pass 3 · Fail 0 · Skipped 0

- ✅ `load-order/permutations` `load-order.order.exampleplugin_exampleplugin2` (2103ms)
- ✅ `load-order/permutations` `load-order.order.exampleplugin2_exampleplugin` (2103ms)
- ✅ `load-order/permutations` `load-order.duplicate-entry` (2102ms)

## Failure isolation

Pass 3 · Fail 0 · Skipped 0

- ✅ `failure-isolation/broken-plugin` `failure-isolation.broken-first` (2130ms)
- ✅ `failure-isolation/broken-plugin` `failure-isolation.broken-last` (2117ms)
- ✅ `failure-isolation/broken-plugin` `failure-isolation.unresolvable-import-first` (2124ms)

## Process cleanup

Pass 4 · Fail 0 · Skipped 0

- ✅ `process-cleanup/graceful-shutdown` `process-cleanup.server-alive` (3ms)
- ✅ `process-cleanup/graceful-shutdown` `process-cleanup.shutdown-exits` (150ms)
- ✅ `process-cleanup/graceful-shutdown` `process-cleanup.port-released` (403ms)
- ✅ `process-cleanup/graceful-shutdown` `process-cleanup.no-orphans` (209ms)

## Install from built artifact

Pass 4 · Fail 0 · Skipped 0

- ✅ `install-artifact/packaged` `install.example-plugin.pack` (2067ms)
- ✅ `install-artifact/packaged` `install.example-plugin.loads-in-runtime` (1796ms)
- ✅ `install-artifact/packaged` `install.example-plugin-2.pack` (518ms)
- ✅ `install-artifact/packaged` `install.example-plugin-2.loads-in-runtime` (1992ms)

## Configuration validation & error handling

Pass 4 · Fail 0 · Skipped 0

- ✅ `config-validation/errors` `config-validation.unknown-configuration` (0ms)
- ✅ `config-validation/errors` `config-validation.invalid-manifest-rejected` (1ms)
- ✅ `config-validation/errors` `config-validation.missing-plugin-directory` (1791ms)
- ✅ `config-validation/errors` `config-validation.malformed-package-json` (1910ms)

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

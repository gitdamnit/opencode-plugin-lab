# v1.0.0 evidence

Reports produced while verifying the generalized lab. Generated reports normally
live under `reports/runs/` (gitignored); these are committed as the release
evidence for v1.0.0.

| Run | What it proves | Result |
| --- | --- | --- |
| `default-run/` | clean default manifest (bundled example plugins only), baked harness, `make build && make suite` at OpenCode **2.0.21** | 76 pass / 0 fail / 5 skipped |
| `opencode-2.0.32/` | the same default manifest evaluated on OpenCode **2.0.32** | 76 pass / 0 fail / 5 skipped |
| `gitdamnit-profile/` | the optional three-plugin regression profile on the pinned historical commits, OpenCode **2.0.21** | 153 pass / 0 fail / 8 skipped |
| `arbitrary-plugin/` | an external plugin the default lab knows nothing about, via `make test-plugin`, OpenCode **2.0.21** | 30 pass / 0 fail / 3 skipped |

`rc-evidence.{json,md}` shows source = staged = packed = installed for the default
manifest (2.0.21). `PROFILE_COMMITS.txt` pins the commits behind the profile run.

OpenCode runtime per run is recorded in each report header; the Node version in
the container is **v22.23.3**.

The reports embed local filesystem paths (the maintainer's worktree for the
profile, `/tmp` scratch dirs for artifact tests, and this repository's own path).
They are evidence and are kept as recorded; they contain **no credentials**.

The original `145 passed` run remains separate and unchanged under
`reports/historical/gitdamnit-2026-10-17/`. It is not relabelled here.

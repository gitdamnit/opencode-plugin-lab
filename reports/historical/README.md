# Historical evidence (preserved unchanged)

These files are the original three-plugin regression evidence, reproduced here
byte-for-byte from the pre-v1.0.0 lab. They are **not** relabelled as validation
of the generalized lab.

- `test-report.json` / `test-report.md` — **145 passed / 0 failed / 0 skipped**,
  OpenCode **v2.0.21**, Node v22.23.3, image `sha256:76ebd805cd54…`
- `rc-evidence.json` / `rc-evidence.md` — source = staged = packed = installed
- `rc-verification.md`, `rc-upstream-tests.md` — release-candidate write-ups

## About local paths in these files

The reports embed the maintainer's local worktree paths (e.g.
`/home/evan/Projects/…`) and ephemeral `/tmp/…` scratch paths, because that is
what the lab recorded at the time. They are retained deliberately: altering them
would weaken the integrity of the historical record. They contain **no
credentials, tokens, keys, or secrets** — only directory names. The three plugin
projects referenced are independently published (MIT / Apache-2.0); this lab is
not a dependency of them.

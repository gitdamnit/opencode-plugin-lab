# v1.0.0 evidence

Reports produced while verifying the generalized lab. Generated reports normally
live under `reports/runs/` (gitignored); these are committed as the release
evidence for v1.0.0.

| Run | What it proves | Result |
| --- | --- | --- |
| `default-run/` | clean default manifest (bundled example plugins only), baked harness, `make build && make suite` | 76 pass / 0 fail / 5 skipped |
| `gitdamnit-profile/` | the optional three-plugin regression profile on the pinned historical commits | 153 pass / 0 fail / 8 skipped |
| `arbitrary-plugin/` | an external plugin the default lab knows nothing about, via `make test-plugin` | 30 pass / 0 fail / 3 skipped |

`rc-evidence.{json,md}` shows source = staged = packed = installed for the default
manifest. `PROFILE_COMMITS.txt` pins the commits behind the profile run.

OpenCode runtime for every run: **v2.0.21**; Node **v22.23.3** (container).

The original `145 passed` run remains separate and unchanged under
`reports/historical/gitdamnit-2026-10-17/`. It is not relabelled here.

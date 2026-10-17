# Security notes

The lab is designed to test security- and state-sensitive plugins (including a
secret-redaction guard and a snapshot engine) without exposing the host or any
real data.

## Container hardening (`lab` service)

| Control | Setting |
| --- | --- |
| Networking | `network_mode: "none"` — no DNS, no outbound, loopback only |
| Privileges | `cap_drop: ["ALL"]`, `security_opt: ["no-new-privileges:true"]` |
| Filesystem | `read_only: true` rootfs; scratch via tmpfs (`/lab/{home,xdg,work}`, `/tmp`, `/run`) |
| User | runs as the invoking host uid/gid (non-root) |
| Privileged mode | never used |
| Docker socket | never mounted |
| Host networking | never used |
| Ports | none published; the server binds `127.0.0.1` inside the container |
| Restart | `restart: "no"` |
| Limits | `mem_limit`, `cpus`, `pids_limit` |

## Host surface

- **No writable (or read-only) mount of any development repository.** Plugin
  sources are copied into `staging/` at build time; only built `dist/` artifacts
  reach the image.
- **Only `./reports` is bind-mounted** into the container, and only for output.
- All test state (SQLite databases, shadow Git repos, audit logs, fixtures)
  lives on tmpfs and is discarded with the container.

## What is never staged or shipped

`scripts/stage.sh` copies an allowlist of top-level entries and excludes
`node_modules`, `.git`, `.github`, `dist`, `dist-test`, `coverage`, build output,
images, logs, and **every `.env*`**. `.dockerignore` additionally excludes
`.env*`, key material, `.ssh`, `.aws`, `.config/opencode` and `.opencode`. The
staging script aborts if a credential-like file (`.env*`, `auth.json`,
`credentials*`, `*.pem`, `id_rsa*`) is found in the staged tree.

## Credentials

- The lab never reads credentials from an existing OpenCode installation
  (`~/.config/opencode`, `auth.json`, `~/.local/share/opencode`).
- The optional online tier reads a **dedicated test credential** only from
  `.env` (see `.env.example`). The value is passed as an environment variable to
  the single `lab-online` container and is never logged or written to reports.
- All functional tests use clearly synthetic, non-functional placeholders.

## Scope of `reset` / `clean`

- `make reset` removes only this compose project's containers and the lab's own
  generated reports.
- `make clean` additionally removes the lab image, `staging/`, and generated
  reports. It never touches other Docker resources or any repository.

## Known limitations (also listed in every report)

- Outbound redaction is verified on the supported HTTP model-request path using a
  local mock provider. Provider-native WebSocket traffic is not covered.
- The stranger-danger >256 MiB fail-closed branch is asserted by constant, not by
  allocating a >256 MiB payload inside the resource-limited container.
- Hook registration is observed indirectly (tool registration + the model path);
  OpenCode exposes no API to enumerate hooks.

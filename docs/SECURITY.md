# Security notes

The lab is designed to test security- and state-sensitive plugins without
exposing the host or any real data. It does **not** claim to be a hard sandbox.

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

- **No mount of any development repository into a container.** Plugin sources are
  copied into `staging/` at build time; only built artifacts reach the image.
- **Only `./reports` is bind-mounted** into the container, and only for output.
- A selected manifest file may be mounted read-only over its baked path so edits
  are never stale.
- All test state (databases, shadow repos, audit logs, fixtures) lives on tmpfs
  and is discarded with the container.

## What is never staged or shipped

`scripts/stage.mjs` excludes `node_modules`, `.git`, `.github`, build output,
coverage, images, logs, `.opencode`, and **every `.env*`**, then aborts if a
credential-like file (`.env*`, `auth.json`, `credentials*`, `*.pem`, `id_rsa*`)
is found in the staged tree. `.dockerignore` additionally excludes `.env*`, key
material, `.ssh`, `.aws`, `.config/opencode`, `.opencode` and `.lab`.

## Credentials

- The lab never reads credentials from an existing OpenCode installation
  (`~/.config/opencode`, `auth.json`, `~/.local/share/opencode`).
- The optional online tier reads a **dedicated test credential** only from
  `.env` (see `.env.example`). The value is passed as an environment variable to
  the single `lab-online` container and is never logged or written to reports.
- All functional tests use clearly synthetic, non-functional placeholders.

## Supply chain

- Dependency installation runs with `--ignore-scripts` by default. A plugin that
  needs lifecycle scripts must set `install.scripts: true` in the manifest — an
  explicit, documented supply-chain decision.
- A `source.type: npm` plugin is **never** fetched unless `source.allowRemote`
  is `true`; the default refuses.
- Building a plugin source inevitably runs *its build*, which may execute
  arbitrary code. Review untrusted plugins before pointing the lab at them.

## Shell argument handling

Host scripts quote all arguments and pass manifest-derived values through arrays
(`mapfile`), not unquoted interpolation. The container runs the harness with
fixed arguments. No manifest field is passed to `eval` except the manifest's
`opencode` version, which is read into `OPENCODE_VERSION`/`PLUGIN_SDK_VERSION`
and constrained by the manifest schema's version pattern.

## Scope of `reset` / `clean`

- `make reset` removes only this compose project's containers and generated
  reports (keeping `reports/historical/`).
- `make clean` additionally removes the lab image, `staging/` and generated
  reports. It never touches other Docker resources, any repository, or the
  committed historical evidence.

## Known limitations (also listed in every report)

- **Rootless Docker reduces risk but is not an absolute boundary against
  malicious plugin code.** A container escape or a resource-exhaustion attack is
  still possible in principle.
- Outbound redaction is verified on the supported HTTP model-request path using a
  local mock provider. Provider-native WebSocket traffic is not covered.
- Hook registration is observed indirectly (tool registration + the model path);
  OpenCode exposes no API to enumerate hooks.
- A plugin’s own persistence is exercised only through the generic
  write-boundary check, not a plugin-specific storage audit.

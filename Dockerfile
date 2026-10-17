# syntax=docker/dockerfile:1
#
# OpenCode Plugin Lab — two-stage image.
#
#   plugin-builder : compiles the staged (allowlisted) plugin sources into
#                    self-contained lab packages under /out/plugins.
#   runtime        : pinned OpenCode V2 CLI + Node/Git/SQLite toolchain, the lab
#                    harness, config templates and fixtures. Non-root, and run
#                    with no network by compose.
#
ARG NODE_IMAGE=node:22-bookworm-slim

# ==========================================================================
# Stage 1 — build staged plugin packages
# ==========================================================================
FROM ${NODE_IMAGE} AS plugin-builder
ARG OPENCODE_VERSION=2.0.21
ARG PLUGIN_SDK_VERSION=2.0.21
ENV DEBIAN_FRONTEND=noninteractive
# Build toolchain (tsc projects may need make/g++ for optional native deps).
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git ca-certificates python3 make g++ bash \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
# Staged, allowlisted sources produced on the host by scripts/stage.sh.
COPY staging/ /src/staged/
# Lab-owned inspector plugin (verifies runtime registration).
COPY harness/inspector/ /src/inspector/
COPY docker/build-plugins.sh /usr/local/bin/build-plugins.sh
RUN chmod +x /usr/local/bin/build-plugins.sh \
    && PLUGIN_SDK_VERSION="${PLUGIN_SDK_VERSION}" /usr/local/bin/build-plugins.sh

# ==========================================================================
# Stage 2 — runtime
# ==========================================================================
FROM ${NODE_IMAGE} AS runtime
ARG OPENCODE_VERSION=2.0.21
ARG PLUGIN_SDK_VERSION=2.0.21
ENV DEBIAN_FRONTEND=noninteractive \
    HOME=/lab/home \
    XDG_CONFIG_HOME=/lab/xdg/config \
    XDG_DATA_HOME=/lab/xdg/data \
    XDG_CACHE_HOME=/lab/xdg/cache \
    OPENCODE_DISABLE_AUTOUPDATE=1 \
    NODE_ENV=production

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git ca-certificates curl jq sqlite3 python3 procps bash tini \
    && rm -rf /var/lib/apt/lists/*

# Pinned OpenCode V2 CLI from the official package. The package's postinstall
# selects the native binary for this platform. `opencode-ai` (V1) is not used.
RUN npm install -g "@opencode/cli@${OPENCODE_VERSION}" \
    && opencode --version

# Bun is only needed to run Git That Shit's own `bun:test` suite. Best effort.
RUN npm install -g bun@1 >/dev/null 2>&1 || echo "bun install skipped (optional)"

# Baked, read-only lab content.
COPY --from=plugin-builder /out/plugins/ /opt/lab/plugins/
COPY harness/ /opt/lab/harness/
COPY configs/ /opt/lab/configs/
COPY fixtures/ /opt/lab/fixtures/
COPY docs/ /opt/lab/docs/

# Writable scratch locations exist in the image but are normally shadowed by
# tmpfs mounts at runtime (see compose.yaml), keeping test data disposable.
# (No recursive chmod here: COPY already yields world-readable 0644/0755, and a
# recursive chmod over the plugin node_modules is needlessly expensive.)
RUN mkdir -p /lab/home /lab/xdg/config /lab/xdg/data /lab/xdg/cache /lab/reports /lab/work

WORKDIR /lab/work
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "/opt/lab/harness/run.mjs", "--config", "all", "--tier", "all"]

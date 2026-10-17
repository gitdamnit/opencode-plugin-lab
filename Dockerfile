# syntax=docker/dockerfile:1
#
# OpenCode Plugin Lab — two-stage image.
#
#   plugin-builder : compiles the staged (manifest-declared) plugin sources into
#                    self-contained lab packages under /out/plugins.
#   runtime        : pinned OpenCode V2 CLI + Node/Git/SQLite toolchain, the lab
#                    harness, manifests, profiles and fixtures. Non-root, and run
#                    with no network by compose.
#
# The set of plugins built is whatever scripts/stage.sh put in staging/, which is
# derived entirely from the active lab manifest. No plugin is hardcoded.
ARG NODE_IMAGE=node:22-bookworm-slim

# ==========================================================================
# Stage 1 — build manifest plugin packages
# ==========================================================================
FROM ${NODE_IMAGE} AS plugin-builder
ARG PLUGIN_SDK_VERSION=2.0.21
ENV DEBIAN_FRONTEND=noninteractive
# Build toolchain (tsc projects may need make/g++ for optional native deps).
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git ca-certificates python3 make g++ bash \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
# Staged, manifest-declared sources produced on the host by scripts/stage.mjs.
COPY staging/ /src/staged/
# Lab-owned inspector plugin (verifies runtime registration).
COPY harness/inspector/ /src/inspector/
COPY docker/build-plugins.mjs /usr/local/bin/build-plugins.mjs
RUN PLUGIN_SDK_VERSION="${PLUGIN_SDK_VERSION}" node /usr/local/bin/build-plugins.mjs

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
    LAB_MANIFEST=/opt/lab/lab.config.json \
    NODE_ENV=production

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git ca-certificates curl jq sqlite3 python3 procps bash tini \
    && rm -rf /var/lib/apt/lists/*

# Pinned OpenCode V2 CLI from the official package. The package's postinstall
# selects the native binary for this platform. `opencode-ai` (V1) is not used.
RUN npm install -g "@opencode/cli@${OPENCODE_VERSION}" \
    && opencode --version

# Baked, read-only lab content.
COPY --from=plugin-builder /out/plugins/ /opt/lab/plugins/
COPY harness/ /opt/lab/harness/
COPY lab.config.json /opt/lab/lab.config.json
COPY profiles/ /opt/lab/profiles/
COPY schema/ /opt/lab/schema/
COPY examples/ /opt/lab/examples/
COPY fixtures/ /opt/lab/fixtures/
COPY docs/ /opt/lab/docs/

# Writable scratch locations exist in the image but are normally shadowed by
# tmpfs mounts at runtime (see compose.yaml), keeping test data disposable.
RUN mkdir -p /lab/home /lab/xdg/config /lab/xdg/data /lab/xdg/cache /lab/reports /lab/work

WORKDIR /lab/work
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "/opt/lab/harness/run.mjs", "--all", "--tier", "all"]

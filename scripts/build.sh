#!/usr/bin/env bash
# Build the lab: stage sources, then build the Docker image.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_docker

eval "$(node "$LAB_ROOT/scripts/lab-manifest.mjs" versions --manifest "$(manifest_host_path)")"
export OPENCODE_VERSION PLUGIN_SDK_VERSION

ensure_reports_dir
log "staging (manifest: $(manifest_label))"
node "$LAB_ROOT/scripts/stage.mjs" --manifest "$(manifest_host_path)"

log "building image opencode-plugin-lab:local (OpenCode ${OPENCODE_VERSION})"
"${COMPOSE[@]}" build "$@" lab
log "image built"
docker image inspect opencode-plugin-lab:local --format '  {{.Id}}  {{.Size}} bytes' 2>/dev/null || true

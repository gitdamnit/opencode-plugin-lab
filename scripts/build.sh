#!/usr/bin/env bash
# Build the lab: stage sources, then build the Docker image.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_docker

ensure_reports_dir
"$LAB_ROOT/scripts/stage.sh"

log "building image opencode-plugin-lab:local (OpenCode ${OPENCODE_VERSION:-2.0.21})"
"${COMPOSE[@]}" build "$@" lab
log "image built"
docker image inspect opencode-plugin-lab:local --format '  {{.Id}}  {{.Size}} bytes' 2>/dev/null || true

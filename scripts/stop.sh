#!/usr/bin/env bash
# Stop and remove lab containers (only this compose project).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_docker

log "stopping lab containers (project $COMPOSE_PROJECT)"
"${COMPOSE[@]}" down --remove-orphans --timeout 10 || true
log "stopped"

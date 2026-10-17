#!/usr/bin/env bash
# Re-stage the current development builds and rebuild the image.
#
# Use after the plugin worktrees advance. Extra args are forwarded to
# `docker compose build` (e.g. `--no-cache`, `--pull`).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_docker

log "refreshing staged plugin builds"
"${LAB_ROOT}/scripts/build.sh" "$@"
log "refresh complete"

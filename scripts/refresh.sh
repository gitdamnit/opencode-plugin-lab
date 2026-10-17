#!/usr/bin/env bash
# Re-stage the current sources and rebuild the image.
#
# Use after a plugin source, manifest, or profile advances. Extra args are
# forwarded to `docker compose build` (e.g. `--no-cache`, `--pull`).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_docker

log "refreshing (manifest: $(manifest_label))"
"$LAB_ROOT/scripts/build.sh" "$@"
log "refresh complete"

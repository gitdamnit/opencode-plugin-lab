#!/usr/bin/env bash
# Start the lab and verify it is operational (builds the image if missing).
#
# The lab is a disposable, no-network test container rather than a long-running
# service, so "start" builds the image and runs the manifest's default
# configuration at the smoke tier.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_docker

ensure_reports_dir
if ! image_exists; then
  log "image not found — building"
  "$LAB_ROOT/scripts/build.sh"
fi

set_image_id
mapfile -t M_ARGS < <(manifest_compose_args)
log "running smoke check for the default configuration (manifest: $(manifest_label))"
"${COMPOSE[@]}" run --rm --no-deps "${M_ARGS[@]}" lab \
  node /opt/lab/harness/run.mjs --tier smoke
log "lab is ready. Try: make test CONFIG=<name> TIER=all   (make discover lists the names)"

#!/usr/bin/env bash
# Start the lab and verify it is operational (builds the image if missing).
#
# The lab is a disposable, no-network test container rather than a long-running
# service, so "start" builds the image and runs the baseline smoke check.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_docker

ensure_reports_dir
if ! image_exists; then
  log "image not found — building"
  "$LAB_ROOT/scripts/build.sh"
fi

log "running baseline smoke check"
"${COMPOSE[@]}" run --rm --no-deps lab \
  node /opt/lab/harness/run.mjs --config baseline --tier smoke
log "lab is ready. Try: make test CONFIG=all TIER=all"

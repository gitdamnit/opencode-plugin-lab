#!/usr/bin/env bash
# Run the complete suite across every configuration the manifest declares.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_docker

ensure_reports_dir
set_image_id
mapfile -t M_ARGS < <(manifest_compose_args)
log "running complete suite (all configs, tier=${TIER:-all}, manifest: $(manifest_label))"
"${COMPOSE[@]}" run --rm --no-deps "${M_ARGS[@]}" lab \
  node /opt/lab/harness/run.mjs --all --tier "${TIER:-all}" ${EXTRA_ARGS:-}

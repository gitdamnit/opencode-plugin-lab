#!/usr/bin/env bash
# Run the lab for a single configuration and tier.
#
#   scripts/test.sh <config> [tier] [--online]
#   CONFIG=all TIER=all scripts/test.sh
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_docker

ensure_reports_dir
CONFIG="${1:-${CONFIG:-all}}"
TIER="${2:-${TIER:-all}}"

set_image_id
mapfile -t M_ARGS < <(manifest_compose_args)
log "test config=$CONFIG tier=$TIER (manifest: $(manifest_label))"
"${COMPOSE[@]}" run --rm --no-deps "${M_ARGS[@]}" lab \
  node /opt/lab/harness/run.mjs --config "$CONFIG" --tier "$TIER" ${EXTRA_ARGS:-}

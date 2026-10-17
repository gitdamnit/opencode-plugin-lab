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

log "test config=$CONFIG tier=$TIER"
"${COMPOSE[@]}" run --rm --no-deps lab \
  node /opt/lab/harness/run.mjs --config "$CONFIG" --tier "$TIER" ${EXTRA_ARGS:-}

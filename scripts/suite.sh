#!/usr/bin/env bash
# Run the complete suite across all five configurations.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_docker

ensure_reports_dir
log "running complete suite (all configs, tier=all)"
"${COMPOSE[@]}" run --rm --no-deps lab \
  node /opt/lab/harness/run.mjs --all --tier "${TIER:-all}" ${EXTRA_ARGS:-}

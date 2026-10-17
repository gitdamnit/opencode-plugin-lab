#!/usr/bin/env bash
# Full validation run across all five configurations plus the global suites
# (compatibility matrix, security, concurrency, failure isolation).
#
# The harness is bind-mounted READ-ONLY over the copy baked into the image. This
# runs the current harness (including the global suites) without rebuilding the
# reproducible image, which is left untouched.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_docker

if ! image_exists; then
  die "image opencode-plugin-lab:local not found — run 'make build' first"
fi
ensure_reports_dir

log "full validation (all configs, tier=validate, harness mounted read-only)"
"${COMPOSE[@]}" run --rm --no-deps \
  -v "$LAB_ROOT/harness:/opt/lab/harness:ro" \
  lab node /opt/lab/harness/run.mjs --all --tier validate "${EXTRA_ARGS:-}"

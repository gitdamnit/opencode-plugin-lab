#!/usr/bin/env bash
# Full validation run across every configuration plus the global suites
# (package inspection, load-order, failure isolation, process cleanup,
# install-from-artifact, configuration validation, and any manifest extensions).
#
# The harness is bind-mounted READ-ONLY over the copy baked into the image. This
# runs the current harness without rebuilding the reproducible image, which is
# left untouched.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_docker

if ! image_exists; then
  die "image opencode-plugin-lab:local not found — run 'make build' first"
fi
ensure_reports_dir

set_image_id
mapfile -t M_ARGS < <(manifest_compose_args)
log "full validation (all configs, tier=validate, manifest: $(manifest_label))"
"${COMPOSE[@]}" run --rm --no-deps "${M_ARGS[@]}" \
  -v "$LAB_ROOT/harness:/opt/lab/harness:ro" \
  lab node /opt/lab/harness/run.mjs --all --tier validate "${EXTRA_ARGS:-}"

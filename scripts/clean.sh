#!/usr/bin/env bash
# Full cleanup: remove lab containers, the lab image, staged sources and
# generated reports. Touches ONLY resources created by this lab.
#
# Development repositories, reports/historical/ and every other Docker resource
# are left untouched.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_docker

log "removing lab containers + image"
"${COMPOSE[@]}" down --remove-orphans --timeout 10 --rmi local || true

log "removing staged sources"
rm -rf "$LAB_ROOT/staging"
mkdir -p "$LAB_ROOT/staging"; touch "$LAB_ROOT/staging/.gitkeep"

log "removing generated reports (keeping reports/historical/)"
find "$LAB_ROOT/reports" -maxdepth 1 -type f \( -name 'test-report*.json' -o -name 'test-report*.md' -o -name 'runtime-*.json' -o -name 'load-order-*.json' -o -name 'matrix-*.json' -o -name 'failure-isolation-*.json' -o -name 'install-artifact-*.json' -o -name 'config-validation-*.json' \) -delete 2>/dev/null || true
rm -rf "$LAB_ROOT/reports/runs" 2>/dev/null || true

log "clean complete (image opencode-plugin-lab:local removed if it existed)"

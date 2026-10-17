#!/usr/bin/env bash
# Full cleanup: remove lab containers, the lab image, staged sources and
# generated reports. Touches ONLY resources created by this lab.
#
# Development repositories and every other Docker resource are left untouched.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_docker

log "removing lab containers + image"
"${COMPOSE[@]}" down --remove-orphans --timeout 10 --rmi local || true

log "removing staged sources"
rm -rf "$LAB_ROOT/staging"
mkdir -p "$LAB_ROOT/staging"; touch "$LAB_ROOT/staging/.gitkeep"

log "removing generated reports"
find "$LAB_ROOT/reports" -maxdepth 1 -type f ! -name 'sample-report.md' ! -name '.gitkeep' -delete 2>/dev/null || true

log "clean complete (image opencode-plugin-lab:local removed if it existed)"

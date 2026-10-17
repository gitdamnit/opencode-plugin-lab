#!/usr/bin/env bash
# Reset disposable test data.
#
# All session databases, plugin state, fixtures and scratch directories live in
# ephemeral tmpfs inside the container, so removing the lab containers discards
# them. This also clears generated reports (the committed sample is kept).
#
# Scope: ONLY this compose project's containers and the lab's own ./reports.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_docker

log "removing lab containers (project $COMPOSE_PROJECT)"
"${COMPOSE[@]}" down --remove-orphans --timeout 10 || true

log "clearing generated reports (keeping sample-report.md)"
find "$LAB_ROOT/reports" -maxdepth 1 -type f ! -name 'sample-report.md' ! -name '.gitkeep' -delete 2>/dev/null || true
find "$LAB_ROOT/reports" -maxdepth 1 -type d -name 'test-report-*' -exec rm -rf {} + 2>/dev/null || true

log "reset complete"

#!/usr/bin/env bash
# Reset disposable test data.
#
# All session databases, plugin state, fixtures and scratch directories live in
# ephemeral tmpfs inside the container, so removing the lab containers discards
# them. This also clears generated reports (the committed historical evidence
# under reports/historical/ is kept).
#
# Scope: ONLY this compose project's containers and the lab's own ./reports.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_docker

log "removing lab containers (project $COMPOSE_PROJECT)"
"${COMPOSE[@]}" down --remove-orphans --timeout 10 || true

log "clearing generated reports (keeping reports/historical/)"
find "$LAB_ROOT/reports" -maxdepth 1 -type f \( -name 'test-report*.json' -o -name 'test-report*.md' -o -name 'runtime-*.json' -o -name 'load-order-*.json' -o -name 'matrix-*.json' -o -name 'failure-isolation-*.json' -o -name 'install-artifact-*.json' -o -name 'config-validation-*.json' \) -delete 2>/dev/null || true
rm -rf "$LAB_ROOT/reports/runs" 2>/dev/null || true

log "reset complete"

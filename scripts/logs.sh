#!/usr/bin/env bash
# Show lab container logs and the most recent human-readable report.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

echo "================ docker compose logs (project $COMPOSE_PROJECT) ================"
"${COMPOSE[@]}" logs --no-color 2>&1 | tail -n 200 || true

echo
echo "================ latest test report ================"
if [ -f "$LAB_ROOT/reports/test-report.md" ]; then
  cat "$LAB_ROOT/reports/test-report.md"
else
  echo "(no report yet — run: make suite)"
fi

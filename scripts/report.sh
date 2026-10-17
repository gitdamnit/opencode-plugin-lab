#!/usr/bin/env bash
# Print the latest test report (human-readable) and its location.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

if [ -f "$LAB_ROOT/reports/test-report.md" ]; then
  echo "reports/test-report.md (machine-readable: reports/test-report.json)"
  echo
  cat "$LAB_ROOT/reports/test-report.md"
else
  die "no report yet — run: make suite"
fi

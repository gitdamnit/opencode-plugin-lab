#!/usr/bin/env bash
# Optional online model-request test (disabled by default).
#
# Requires a dedicated, limited test credential in ./.env (see .env.example).
# Uses the `lab-online` compose profile (the only service with networking).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_docker

ensure_reports_dir
if [ ! -f "$LAB_ROOT/.env" ]; then
  die "missing .env — copy .env.example and add a DEDICATED test credential"
fi

# shellcheck disable=SC1091
set -a; . "$LAB_ROOT/.env"; set +a
[ -n "${LAB_TEST_API_KEY:-}" ] || die "LAB_TEST_API_KEY is not set in .env"
[ -n "${LAB_TEST_MODEL:-}" ] || die "LAB_TEST_MODEL is not set in .env"

CONFIG="${1:-${CONFIG:-baseline}}"
log "online test config=$CONFIG model=$LAB_TEST_MODEL (credential value is never logged)"
"${COMPOSE[@]}" --profile online run --rm --no-deps lab-online \
  node /opt/lab/harness/run.mjs --config "$CONFIG" --tier all --online

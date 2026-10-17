#!/usr/bin/env bash
# Stage the manifest's plugin sources into ./staging for the Docker build.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

log "staging sources (manifest: $(manifest_label))"
node "$LAB_ROOT/scripts/stage.mjs" --manifest "$(manifest_host_path)"

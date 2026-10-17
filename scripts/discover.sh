#!/usr/bin/env bash
# Read-only discovery of the manifest's plugin sources.
#
# Shows, per plugin: version, HEAD commit, dirty state, source type and path,
# and the declared configurations. NEVER writes to any source repository.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

echo "profile:  $(manifest_label)"
echo
node "$LAB_ROOT/scripts/lab-manifest.mjs" discover --manifest "$(manifest_host_path)"
echo
echo "configurations:"
node "$LAB_ROOT/scripts/lab-manifest.mjs" configs --manifest "$(manifest_host_path)"

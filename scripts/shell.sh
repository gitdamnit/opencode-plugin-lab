#!/usr/bin/env bash
# Open an interactive shell inside the lab container for debugging.
# NOTE: the offline container has no network, by design.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_docker

"${COMPOSE[@]}" run --rm --no-deps lab bash

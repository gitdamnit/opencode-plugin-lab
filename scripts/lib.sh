#!/usr/bin/env bash
# Shared helpers for the lab's host-side control scripts.
set -euo pipefail

LAB_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$LAB_ROOT"

# Load pinned versions / limits (exported for compose interpolation).
if [ -f "$LAB_ROOT/lab.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$LAB_ROOT/lab.env"
  set +a
fi

export LAB_UID="${LAB_UID:-$(id -u)}"
export LAB_GID="${LAB_GID:-$(id -g)}"

COMPOSE_PROJECT="opencode-plugin-lab"
COMPOSE=(docker compose -f "$LAB_ROOT/compose.yaml" -p "$COMPOSE_PROJECT")

log()  { printf '\033[1;36m[lab]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[lab]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[lab:error]\033[0m %s\n' "$*" >&2; exit 1; }

require_docker() {
  command -v docker >/dev/null 2>&1 || die "docker is required"
  docker compose version >/dev/null 2>&1 || die "docker compose v2 is required"
}

image_exists() {
  docker image inspect "opencode-plugin-lab:local" >/dev/null 2>&1
}

# Rootless Docker maps container UIDs into a subuid range, so a host-owned
# directory is not writable by a non-root container. The lab's own output
# directory must therefore be writable by the container's mapped uid.
ensure_reports_dir() {
  mkdir -p "$LAB_ROOT/reports"
  chmod 0777 "$LAB_ROOT/reports" 2>/dev/null || true
}

# Read plugins.tsv (tab separated, skip comments/blanks) and invoke a callback.
# callback: <name> <preferred> <fallback> <entries>
each_plugin() {
  local cb="$1"
  while IFS=$'\t' read -r name preferred fallback entries; do
    case "$name" in ''|\#*) continue ;; esac
    "$cb" "$name" "$preferred" "$fallback" "$entries"
  done < "$LAB_ROOT/plugins.tsv"
}

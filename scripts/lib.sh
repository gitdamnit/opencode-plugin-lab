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

# Export the running image id so reports can record exact provenance.
set_image_id() {
  export LAB_IMAGE_ID
  LAB_IMAGE_ID="$(docker image inspect opencode-plugin-lab:local --format '{{.Id}}' 2>/dev/null || true)"
}

# Rootless Docker maps container UIDs into a subuid range, so a host-owned
# directory is not writable by a non-root container. The lab's own output
# directory must therefore be writable by the container's mapped uid.
ensure_reports_dir() {
  mkdir -p "$LAB_ROOT/reports"
  chmod 0777 "$LAB_ROOT/reports" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# Manifest / profile resolution.
#
#   PROFILE=gitdamnit   -> profiles/gitdamnit/lab.config.json
#   PROFILE=            -> lab.config.json (default: bundled example plugins)
#   LAB_MANIFEST_FILE=  -> an explicit host manifest path (used by test-plugin)
# ---------------------------------------------------------------------------
manifest_host_path() {
  if [ -n "${LAB_MANIFEST_FILE:-}" ]; then
    printf '%s' "$LAB_MANIFEST_FILE"
  elif [ -n "${PROFILE:-}" ]; then
    local p="$LAB_ROOT/profiles/$PROFILE/lab.config.json"
    [ -f "$p" ] || die "unknown profile '$PROFILE' (no $p)"
    printf '%s' "$p"
  else
    printf '%s' "$LAB_ROOT/lab.config.json"
  fi
}

manifest_container_path() {
  if [ -n "${LAB_MANIFEST_FILE:-}" ]; then
    printf '/opt/lab/lab.config.json'
  elif [ -n "${PROFILE:-}" ]; then
    printf '/opt/lab/profiles/%s/lab.config.json' "$PROFILE"
  else
    printf '/opt/lab/lab.config.json'
  fi
}

# Extra compose arguments that make the container use the selected manifest
# (mounting the host copy so edits are never stale).
manifest_compose_args() {
  printf -- '-e\nLAB_MANIFEST=%s\n' "$(manifest_container_path)"
  if [ -n "${LAB_MANIFEST_FILE:-}${PROFILE:-}" ]; then
    printf -- '-v\n%s:%s:ro\n' "$(manifest_host_path)" "$(manifest_container_path)"
  fi
}

# Human-readable label for the active manifest.
manifest_label() {
  if [ -n "${LAB_MANIFEST_FILE:-}" ]; then echo "custom ($LAB_MANIFEST_FILE)";
  elif [ -n "${PROFILE:-}" ]; then echo "profile:$PROFILE";
  else echo "default"; fi
}

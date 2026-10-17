#!/usr/bin/env bash
# Stage allowlisted plugin sources into ./staging/<name> for the Docker build.
#
# Safety:
#   * reads the plugin worktrees read-only (never writes to them)
#   * copies only allowlisted top-level entries (see plugins.tsv)
#   * excludes node_modules, .git, build output, images and every .env*
#   * aborts if any .env / credential-looking file slipped through
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

STAGING="$LAB_ROOT/staging"
mkdir -p "$STAGING"

EXCLUDES=(
  --exclude=node_modules
  --exclude=.git
  --exclude=.github
  --exclude=dist
  --exclude=dist-test
  --exclude=coverage
  --exclude=.opencode/state
  --exclude='.env'
  --exclude='.env.*'
  --exclude='*.jpg'
  --exclude='*.jpeg'
  --exclude='*.png'
  --exclude='*.gif'
  --exclude='*.webp'
  --exclude='*.log'
)

stage_one() {
  local name="$1" preferred="$2" fallback="$3" entries="$4"
  local src
  if [ -d "$preferred" ]; then src="$preferred"; else src="$fallback"; fi
  [ -d "$src" ] || die "no source directory for $name (tried $preferred and $fallback)"

  local dest="$STAGING/$name"
  rm -rf "$dest"
  mkdir -p "$dest"

  local present=()
  for e in $entries; do [ -e "$src/$e" ] && present+=("$e"); done
  [ "${#present[@]}" -gt 0 ] || die "no allowlisted entries exist for $name in $src"

  # Copy the allowlisted entries, honouring excludes.
  ( cd "$src" && tar "${EXCLUDES[@]}" -cf - "${present[@]}" ) | ( cd "$dest" && tar -xf - )

  # Refuse anything that looks like a credential file.
  local bad
  bad="$(find "$dest" \( -name '.env' -o -name '.env.*' -o -name 'auth.json' -o -name 'credentials*' -o -name '*.pem' -o -name 'id_rsa*' \) -print 2>/dev/null || true)"
  [ -z "$bad" ] || die "refusing to stage credential-like files for $name:\n$bad"

  # Provenance for the report.
  local commit branch dirty version
  version="$(node -e "try{console.log(require('$src/package.json').version)}catch{console.log('?')}" 2>/dev/null || echo '?')"
  if git -C "$src" rev-parse --git-dir >/dev/null 2>&1; then
    commit="$(git -C "$src" rev-parse HEAD)"
    branch="$(git -C "$src" rev-parse --abbrev-ref HEAD)"
    if [ -n "$(git -C "$src" status --porcelain)" ]; then dirty="true"; else dirty="false"; fi
  else
    commit=""; branch=""; dirty=""
  fi
  cat > "$dest/LAB_SOURCE.json" <<JSON
{
  "name": "$name",
  "packageVersion": "$version",
  "sourcePath": "$src",
  "preferredPath": "$preferred",
  "fallbackPath": "$fallback",
  "branch": "$branch",
  "commit": "$commit",
  "dirty": $([ -n "$dirty" ] && echo "$dirty" || echo null),
  "stagedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "entries": "$entries"
}
JSON
  log "staged $name <- $src ($branch@${commit:0:8}$([ "$dirty" = "true" ] && echo ' DIRTY' || echo ''))"
}

log "staging allowlisted sources into $STAGING"
each_plugin stage_one
log "staging complete"

#!/usr/bin/env bash
# Read-only discovery of the plugin development worktrees.
#
# Prefers the active V2/hardening worktree from plugins.tsv, falls back to the
# reference checkout, and reports branch, HEAD SHA, dirty state and package
# version. NEVER writes to any source repository.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

resolve_source() {
  local preferred="$1" fallback="$2"
  if [ -d "$preferred" ]; then echo "$preferred"; else echo "$fallback"; fi
}

printf '%-26s %-8s %-12s %-10s %s\n' "PLUGIN" "VERSION" "COMMIT" "DIRTY" "SOURCE"
printf '%-26s %-8s %-12s %-10s %s\n' "------" "-------" "------" "-----" "------"

one() {
  local name="$1" preferred="$2" fallback="$3"
  local src; src="$(resolve_source "$preferred" "$fallback")"
  [ -d "$src" ] || { printf '%-26s %s\n' "$name" "MISSING ($preferred)"; return; }
  local version commit branch dirty
  version="$(node -e "try{console.log(require('$src/package.json').version)}catch{console.log('?')}" 2>/dev/null || echo '?')"
  if git -C "$src" rev-parse --git-dir >/dev/null 2>&1; then
    commit="$(git -C "$src" rev-parse --short HEAD)"
    branch="$(git -C "$src" rev-parse --abbrev-ref HEAD)"
    if [ -n "$(git -C "$src" status --porcelain)" ]; then dirty="yes"; else dirty="no"; fi
  else
    commit="(no-git)"; branch="?"; dirty="?"
  fi
  printf '%-26s %-8s %-12s %-10s %s\n' "$name" "$version" "$commit" "$dirty" "$src [$branch]"
}

each_plugin one

echo
echo "worktrees:"
for r in $(node -e "const fs=require('fs');for(const l of fs.readFileSync('$LAB_ROOT/plugins.tsv','utf8').split('\n')){if(!l||l.startsWith('#'))continue;const c=l.split('\t');console.log(c[1])}"); do
  [ -d "$r" ] && git -C "$r" worktree list 2>/dev/null | sed 's/^/  /'
done

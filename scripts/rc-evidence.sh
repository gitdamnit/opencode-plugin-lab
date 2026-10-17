#!/usr/bin/env bash
# Release-candidate evidence: source commit, package version, packed artifact,
# and the version actually installed in the built image — for every plugin.
#
# Read-only with respect to the development repositories: the packed artifact is
# assembled in a temporary directory from the *baked* build output plus the
# staged package.json, never from the source checkout.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_docker
if ! image_exists; then die "image not built — run 'make build'"; fi
ensure_reports_dir

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
OUT="$TMP/records.jsonl"
: > "$OUT"

record() {
  local name="$1" src="$2"
  local branch commit dirty srcver stagedver
  branch="$(git -C "$src" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
  commit="$(git -C "$src" rev-parse HEAD 2>/dev/null || echo '')"
  dirty="$( [ -n "$(git -C "$src" status --porcelain 2>/dev/null)" ] && echo true || echo false )"
  srcver="$(node -e "try{console.log(require('$src/package.json').version)}catch{console.log('')}" 2>/dev/null)"
  stagedver="$(node -e "try{console.log(require('$LAB_ROOT/staging/$name/LAB_SOURCE.json').packageVersion)}catch{console.log('')}" 2>/dev/null)"

  # Installed artifact metadata from the built image.
  local instver instcommit
  instver="$(docker run --rm --entrypoint cat opencode-plugin-lab:local /opt/lab/plugins/$name/upstream-package.json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).version)}catch{console.log("")}})')"
  instcommit="$(docker run --rm --entrypoint cat opencode-plugin-lab:local /opt/lab/plugins/$name/LAB_SOURCE.json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).commit)}catch{console.log("")}})')"

  # Packed artifact: baked dist + staged package.json, packed in a temp dir.
  local packdir="$TMP/pack-$name"
  mkdir -p "$packdir"
  docker run --rm -v "$packdir:/out" --entrypoint bash opencode-plugin-lab:local -lc \
    "cp -R /opt/lab/plugins/$name/dist /out/dist && cp /opt/lab/plugins/$name/upstream-package.json /out/package.json" >/dev/null 2>&1
  local tarball="" packver="" sha=""
  ( cd "$packdir" && npm pack --ignore-scripts --json > pack.json 2>/dev/null ) || true
  if [ -f "$packdir/pack.json" ]; then
    tarball="$(node -e "try{console.log(require('$packdir/pack.json')[0].filename)}catch{console.log('')}")"
    packver="$(node -e "try{const t=require('$packdir/pack.json')[0];console.log(t.version)}catch{console.log('')}")"
  fi
  [ -n "$tarball" ] && [ -f "$packdir/$tarball" ] && sha="$(sha256sum "$packdir/$tarball" | awk '{print $1}')"

  node -e "
    const r = {
      name: '$name',
      sourcePath: '$src',
      source: { branch: '$branch', commit: '$commit', dirty: $dirty, version: '$srcver' },
      staged: { version: '$stagedver' },
      packed: { tarball: '$tarball', version: '$packver', sha256: '$sha' },
      installed: { version: '$instver', commit: '$instcommit' },
      consistent: ('$srcver' === '$stagedver') && ('$srcver' === '$packver') && ('$srcver' === '$instver') && ('$commit' === '$instcommit')
    };
    console.log(JSON.stringify(r));
  " >> "$OUT"
}

while IFS=$'\t' read -r name preferred fallback entries; do
  case "$name" in ''|\#*) continue ;; esac
  src="$preferred"; [ -d "$src" ] || src="$fallback"
  if [ -d "$src" ]; then record "$name" "$src"; fi
done < "$LAB_ROOT/plugins.tsv"

node -e "
const fs = require('fs');
const lines = fs.readFileSync('$OUT','utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const report = { generatedAt: new Date().toISOString(), image: 'opencode-plugin-lab:local', plugins: lines };
fs.writeFileSync('$LAB_ROOT/reports/rc-evidence.json', JSON.stringify(report, null, 2));
const rows = lines.map(r => '| ' + [r.name, r.source.version, r.source.commit.slice(0,7), (r.source.dirty?'dirty':'clean'), r.staged.version, r.packed.version, r.installed.version, r.installed.commit.slice(0,7), (r.consistent?'yes':'NO')].join(' | ') + ' |');
const md = ['# Release-candidate evidence','', 'Generated: ' + report.generatedAt, '', '| Plugin | Source ver | Source SHA | Worktree | Staged ver | Packed ver | Installed ver | Installed SHA | Consistent |','| --- | --- | --- | --- | --- | --- | --- | --- | --- |', ...rows, ''].join('\n');
fs.writeFileSync('$LAB_ROOT/reports/rc-evidence.md', md);
console.log(md);
"
log "wrote reports/rc-evidence.json and reports/rc-evidence.md"

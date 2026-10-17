#!/usr/bin/env bash
# Release-candidate evidence: source commit, package version, packed artifact and
# the version actually installed in the built image — for every plugin in the
# active manifest.
#
# Read-only with respect to the plugin sources: the packed artifact is assembled
# in a temporary directory from the *baked* build output, never from a source
# checkout.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_docker
if ! image_exists; then die "image not built — run 'make build'"; fi
ensure_reports_dir

MANIFEST="$(manifest_host_path)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
PLAN="$TMP/plan.json"
RECORDS="$TMP/records.jsonl"
node "$LAB_ROOT/scripts/lab-manifest.mjs" plan --manifest "$MANIFEST" > "$PLAN"
: > "$RECORDS"

# Read one field from a JSON file baked into the image.
img_json_field() { # <plugin> <file> <field>
  docker run --rm --entrypoint cat opencode-plugin-lab:local "/opt/lab/plugins/$1/$2" 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);const p=process.argv[1].split(".");let v=j;for(const k of p)v=v?.[k];console.log(v??"")}catch{console.log("")}})' "$3"
}

node -e '
const fs=require("fs");
const plan=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
for(const p of plan.plugins) console.log(JSON.stringify({name:p.name,source:{type:p.source.type,path:p.source.path||p.source.ref},provenance:p.provenance}));
' "$PLAN" > "$TMP/plugins.jsonl"

while IFS= read -r line; do
  name="$(node -e 'console.log(JSON.parse(process.argv[1]).name)' "$line")"
  srcver="$(node -e 'const p=JSON.parse(process.argv[1]).provenance;console.log(p.version??"")' "$line")"
  commit="$(node -e 'const p=JSON.parse(process.argv[1]).provenance;console.log(p.commit??"")' "$line")"
  branch="$(node -e 'const p=JSON.parse(process.argv[1]).provenance;console.log(p.branch??"")' "$line")"
  dirty="$(node -e 'const p=JSON.parse(process.argv[1]).provenance;console.log(p.dirty===true?"true":"false")' "$line")"
  srctype="$(node -e 'console.log(JSON.parse(process.argv[1]).source.type)' "$line")"

  instver="$(img_json_field "$name" upstream-package.json version)"
  instcommit="$(img_json_field "$name" LAB_SOURCE.json commit)"
  stagedver="$(img_json_field "$name" LAB_SOURCE.json packageVersion)"

  packdir="$TMP/pack-$name"; mkdir -p "$packdir"
  docker run --rm -v "$packdir:/out" --entrypoint bash opencode-plugin-lab:local -lc \
    "cp -R /opt/lab/plugins/$name/dist /out/dist 2>/dev/null; cp /opt/lab/plugins/$name/upstream-package.json /out/package.json 2>/dev/null; cp /opt/lab/plugins/$name/index.ts /out/index.ts 2>/dev/null" >/dev/null 2>&1 || true
  tarball=""; packver=""; sha=""
  ( cd "$packdir" && npm pack --ignore-scripts --json > pack.json 2>/dev/null ) || true
  if [ -f "$packdir/pack.json" ]; then
    tarball="$(node -e "try{console.log(require('$packdir/pack.json')[0].filename)}catch{}")"
    packver="$(node -e "try{console.log(require('$packdir/pack.json')[0].version)}catch{}")"
  fi
  [ -n "$tarball" ] && [ -f "$packdir/$tarball" ] && sha="$(sha256sum "$packdir/$tarball" | awk '{print $1}')"

  node -e "
    const r={name:'$name',sourceType:'$srctype',source:{branch:'$branch',commit:'$commit',dirty:$dirty,version:'$srcver'},
      staged:{version:'$stagedver'},packed:{tarball:'$tarball',version:'$packver',sha256:'$sha'},
      installed:{version:'$instver',commit:'$instcommit'},
      consistent:('$srcver'==='$stagedver')&&('$srcver'==='$packver')&&('$srcver'==='$instver')&&('$commit'==='$instcommit'||'$srctype'==='npm')};
    console.log(JSON.stringify(r));
  " >> "$RECORDS"
done < "$TMP/plugins.jsonl"

node -e "
const fs=require('fs');
const lines=fs.readFileSync('$RECORDS','utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const report={generatedAt:new Date().toISOString(),image:'opencode-plugin-lab:local',manifest:'$MANIFEST',plugins:lines};
fs.writeFileSync('$LAB_ROOT/reports/rc-evidence.json',JSON.stringify(report,null,2));
const rows=lines.map(r=>'| '+[r.name,r.source.version,r.source.commit.slice(0,7),(r.source.dirty?'dirty':'clean'),r.sourceType,r.staged.version,r.packed.version,r.installed.version,(r.consistent?'yes':'NO')].join(' | ')+' |');
const md=['# Release-candidate evidence','','Generated: '+report.generatedAt,'','Manifest: \`'+report.manifest+'\`','','| Plugin | Source ver | Source SHA | Worktree | Source type | Staged ver | Packed ver | Installed ver | Consistent |','| --- | --- | --- | --- | --- | --- | --- | --- | --- |',...rows,''].join('\n');
fs.writeFileSync('$LAB_ROOT/reports/rc-evidence.md',md);
console.log(md);
"
log "wrote reports/rc-evidence.json and reports/rc-evidence.md"

#!/usr/bin/env bash
# Build and test an ARBITRARY OpenCode plugin from a local source directory,
# a packed tarball, or an already-built package directory — without committing
# anything.
#
#   make test-plugin PLUGIN=/path/to/plugin [NAME=my-plugin] [TYPE=directory] [ENTRY=index.js] [TIER=all]
#
# A temporary single-plugin manifest is generated under .lab/ and used for the
# build and the run. Your existing manifests are never modified.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_docker

PLUGIN="${PLUGIN:-${1:-}}"
[ -n "$PLUGIN" ] || die "set PLUGIN=/path/to/plugin (or pass it as the first argument)"
[ -e "$PLUGIN" ] || die "plugin path does not exist: $PLUGIN"
PLUGIN_ABS="$(cd "$(dirname "$PLUGIN")" && pwd)/$(basename "$PLUGIN")"

# Derive a stable lab name from the path unless NAME is given.
NAME="${NAME:-$(basename "$PLUGIN" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9._-]+/-/g; s/^[^a-z0-9]+//')}"
[ -n "$NAME" ] || die "could not derive a plugin name; pass NAME=..."

# Decide the source type: a .tgz is a tarball; a directory whose package.json
# has a build script is built; otherwise it is used as a prebuilt package.
ENTRY="${ENTRY:-index.js}"
if [ -n "${TYPE:-}" ]; then
  STYPE="$TYPE"
elif [[ "$PLUGIN_ABS" == *.tgz ]]; then
  STYPE="tarball"
elif [ -f "$PLUGIN_ABS/package.json" ] && node -e "process.exit(require('$PLUGIN_ABS/package.json').scripts?.build?0:1)"; then
  STYPE="directory"
else
  STYPE="package"
fi

LAB_DIR="$LAB_ROOT/.lab"
mkdir -p "$LAB_DIR"
MANIFEST="$LAB_DIR/manifest.json"

node -e '
const fs=require("fs");
const [out, name, type, path, entry] = process.argv.slice(1);
const build = type === "directory"
  ? { command: "npm run build", dist: "dist", entry }
  : { rootEntry: true, entry };
const manifest = {
  version: 1,
  name: `local plugin: ${name}`,
  opencode: { version: process.env.OPENCODE_VERSION || "2.0.21", sdkVersion: process.env.PLUGIN_SDK_VERSION || "2.0.21" },
  defaultConfig: "plugin",
  plugins: [{ name, source: { type, path }, build }],
  configs: [{ name: "plugin", description: "the supplied plugin", plugins: [name] }],
};
fs.writeFileSync(out, JSON.stringify(manifest, null, 2) + "\n");
' "$MANIFEST" "$NAME" "$STYPE" "$PLUGIN_ABS" "$ENTRY"

export LAB_MANIFEST_FILE="$MANIFEST"
log "test-plugin name=$NAME type=$STYPE entry=$ENTRY path=$PLUGIN_ABS"

ensure_reports_dir
eval "$(node "$LAB_ROOT/scripts/lab-manifest.mjs" versions --manifest "$MANIFEST")"
export OPENCODE_VERSION PLUGIN_SDK_VERSION

node "$LAB_ROOT/scripts/stage.mjs" --manifest "$MANIFEST"
"${COMPOSE[@]}" build lab

mapfile -t M_ARGS < <(manifest_compose_args)
"${COMPOSE[@]}" run --rm --no-deps "${M_ARGS[@]}" lab \
  node /opt/lab/harness/run.mjs --all --tier "${TIER:-all}" ${EXTRA_ARGS:-}

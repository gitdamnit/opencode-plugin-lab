#!/usr/bin/env bash
# Build the staged plugins into self-contained lab packages.
#
# For each plugin this:
#   1. `npm ci` (offline-friendly, lockfile-driven) in the staged source
#   2. runs the project's own `build` script (tsc, etc.)
#   3. assembles /out/plugins/<name>/ with:
#        dist/                the compiled artifacts (real build output)
#        index.ts             a thin entry shim: `export { default } from "./dist/<entry>"`
#        package.json         lab package metadata (+ @opencode/plugin dependency)
#        node_modules/        so `@opencode/plugin` resolves at load time
#        LAB_SOURCE.json      provenance (worktree, branch, SHA, dirty)
#        upstream-package.json the original package.json
#
# The resulting directory is what OpenCode loads as a local plugin package.
set -euo pipefail

SDK="${PLUGIN_SDK_VERSION:-2.0.21}"
OUT=/out/plugins
mkdir -p "$OUT"

log() { printf '\n──────── %s ────────\n' "$*"; }

build_plugin() {
  local name="$1" entry="$2"
  local src="/src/staged/$name"
  log "building plugin: $name (dist/$entry)"

  if [ ! -d "$src" ]; then
    echo "FATAL: missing staged source for $name at $src" >&2
    exit 1
  fi

  (
    cd "$src"
    if [ -f package-lock.json ]; then
      npm ci --no-audit --no-fund
    else
      npm install --no-audit --no-fund
    fi
    npm run build
  )

  if [ ! -f "$src/dist/$entry" ]; then
    echo "FATAL: expected build output $src/dist/$entry was not produced" >&2
    exit 1
  fi

  local pkg="$OUT/$name"
  rm -rf "$pkg"
  mkdir -p "$pkg"
  cp -R "$src/dist" "$pkg/dist"
  printf 'export { default } from "./dist/%s"\n' "$entry" > "$pkg/index.ts"

  cat > "$pkg/package.json" <<JSON
{
  "name": "@opencode-lab/$name",
  "version": "0.0.0-lab",
  "private": true,
  "type": "module",
  "main": "index.ts",
  "dependencies": {
    "@opencode/plugin": "$SDK"
  }
}
JSON

  cp "$src/package.json" "$pkg/upstream-package.json"
  [ -f "$src/LAB_SOURCE.json" ] && cp "$src/LAB_SOURCE.json" "$pkg/LAB_SOURCE.json" || true

  (
    cd "$pkg"
    npm install --no-audit --no-fund
  )

  echo "OK: $pkg"
}

build_plugin checkpoint-orchestrator checkpoint-orchestrator.js
build_plugin git-that-shit          index.js
build_plugin stranger-danger        plugin/index.js

# ---------------------------------------------------------------------------
# Lab inspector plugin — loaded last in every config to record, at runtime,
# which plugins are active and which tools were actually registered.
# ---------------------------------------------------------------------------
log "building lab inspector"
IPKG="$OUT/lab-inspector"
rm -rf "$IPKG"
mkdir -p "$IPKG"
cp /src/inspector/index.ts "$IPKG/index.ts"
cat > "$IPKG/package.json" <<JSON
{
  "name": "@opencode-lab/inspector",
  "version": "0.0.0-lab",
  "private": true,
  "type": "module",
  "main": "index.ts",
  "dependencies": {
    "@opencode/plugin": "$SDK"
  }
}
JSON
( cd "$IPKG" && npm install --no-audit --no-fund )
echo "OK: $IPKG"

log "built packages"
ls -1 "$OUT"

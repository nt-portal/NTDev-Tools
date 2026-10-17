#!/usr/bin/env bash
# Uji runtime NT DevTools: memuat styles.js -> icons-data.js -> beautify.js ->
# contentScript.js di dalam JSDOM dengan tiruan API ekstensi Firefox, lalu
# memeriksa #mdt-root, 8 tab, ikon SVG, pesan runtime, hook konsol, REPL,
# jaringan, dan panel. Keluar dengan kode 1 bila ada yang gagal.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
WORK="${TMPDIR:-/tmp}/ntdev-runtime-test"
mkdir -p "$WORK"
[ -d "$WORK/node_modules/jsdom" ] || (cd "$WORK" && npm init -y >/dev/null 2>&1 && npm i jsdom --no-audit --no-fund --loglevel=error >/dev/null 2>&1)
cp "$DIR/runtime-harness.js" "$WORK/harness.js"
cd "$WORK" && node harness.js

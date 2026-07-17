#!/usr/bin/env bash
# Copies onnxruntime-web WASM files into public/ort/ so they are served
# locally (no CDN dependency, works offline, no CORS issues).
# Run after `npm install` and before `npm run build`.

set -e
SRC="$(dirname "$0")/../node_modules/onnxruntime-web/dist"
DST="$(dirname "$0")/../public/ort"

mkdir -p "$DST"
cp "$SRC"/*.wasm "$DST/"
echo "✓ Copied $(ls "$DST"/*.wasm | wc -l) WASM files to public/ort/"

#!/usr/bin/env bash
# Download a fal MCP result locally + log to manifest (dollars, not credits).
# usage: scripts/fal_pull.sh <url> <project> <model> <label> [cost_usd] [request_id]
set -euo pipefail
URL="$1"; PROJECT="${2:-misc}"; MODEL="${3:-unknown}"; LABEL="${4:-asset}"; COST="${5:-0}"; REQID="${6:-}"
DATE=$(date +%F); TIME=$(date +%H%M%S)
DIR="assets/$PROJECT/$DATE"; mkdir -p "$DIR"
EXT="${URL##*.}"; EXT="${EXT%%\?*}"; case "$EXT" in mp4|webm|mov|png|jpg|jpeg|webp|wav|mp3) ;; *) EXT="mp4";; esac
MODEL_SLUG=$(echo "$MODEL" | sed 's|fal-ai/||; s|/|-|g')
FILE="$DIR/${TIME}_${MODEL_SLUG}_${LABEL}.${EXT}"
curl -fsSL "$URL" -o "$FILE"
printf '{"ts":"%s","project":"%s","model":"%s","label":"%s","cost_usd":%s,"file":"%s","url":"%s","request_id":"%s"}\n' \
  "$(date -Iseconds)" "$PROJECT" "$MODEL" "$LABEL" "$COST" "$FILE" "$URL" "$REQID" >> assets/manifest.jsonl
echo "saved → $FILE"

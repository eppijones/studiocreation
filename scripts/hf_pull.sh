#!/usr/bin/env bash
# Download a Higgsfield result locally + log to manifest.
# usage: scripts/hf_pull.sh <url> <project> <model> <label> [cost_credits]
set -euo pipefail
URL="$1"; PROJECT="${2:-misc}"; MODEL="${3:-unknown}"; LABEL="${4:-asset}"; COST="${5:-0}"
DATE=$(date +%F); TIME=$(date +%H%M%S)
DIR="assets/$PROJECT/$DATE"; mkdir -p "$DIR"
EXT="${URL##*.}"; EXT="${EXT%%\?*}"; case "$EXT" in mp4|webm|mov|png|jpg|jpeg|webp|wav|mp3) ;; *) EXT="mp4";; esac
FILE="$DIR/${TIME}_${MODEL}_${LABEL}.${EXT}"
curl -fsSL "$URL" -o "$FILE"
printf '{"ts":"%s","project":"%s","model":"%s","label":"%s","cost_credits":%s,"file":"%s","url":"%s"}\n' \
  "$(date -Iseconds)" "$PROJECT" "$MODEL" "$LABEL" "$COST" "$FILE" "$URL" >> assets/manifest.jsonl
echo "saved → $FILE"
python3 "$(dirname "$0")/gallery.py" >/dev/null 2>&1 || true

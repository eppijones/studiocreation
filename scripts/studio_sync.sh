#!/usr/bin/env bash
# Mirror cloud assets (Vercel Blob via the app API) down to local File Law
# folders + assets/manifest.jsonl. Idempotent — tracks the last synced asset id.
#
# usage: scripts/studio_sync.sh         pull cloud assets -> local archive
#        scripts/studio_sync.sh push    upload local manifest rows the DB hasn't seen
# env:   STUDIO_URL (default https://studiocreation.vercel.app)
#        STUDIO_PASSWORD (read from .env if present)
set -euo pipefail
cd "$(dirname "$0")/.."

STUDIO_URL="${STUDIO_URL:-https://studiocreation.vercel.app}"
if [ -z "${STUDIO_PASSWORD:-}" ] && [ -f .env ]; then
  STUDIO_PASSWORD=$(grep '^STUDIO_PASSWORD=' .env | cut -d= -f2- || true)
fi
[ -n "${STUDIO_PASSWORD:-}" ] || { echo "STUDIO_PASSWORD not set"; exit 1; }

STATE_FILE="assets/.sync_state"
AFTER_ID=$(cat "$STATE_FILE" 2>/dev/null || echo 0)
COOKIES=$(mktemp)
trap 'rm -f "$COOKIES"' EXIT

curl -fsS -c "$COOKIES" -X POST "$STUDIO_URL/api/auth" \
  -H 'Content-Type: application/json' \
  -d "{\"password\":\"$STUDIO_PASSWORD\",\"operator\":\"sync\"}" >/dev/null

if [ "${1:-pull}" = "push" ]; then
  # Upload local manifest rows (MCP/Higgsfield work) into the cloud ledger.
  [ -f assets/manifest.jsonl ] || { echo "no manifest to push"; exit 0; }
  curl -fsS -b "$COOKIES" -X POST "$STUDIO_URL/api/import/manifest" \
    -H 'Content-Type: application/x-ndjson' \
    --data-binary @assets/manifest.jsonl
  echo
  echo "push complete"
  exit 0
fi

ASSETS_JSON=$(curl -fsS -b "$COOKIES" "$STUDIO_URL/api/assets?after_id=$AFTER_ID")

# \x1f (unit separator) keeps empty fields intact — tab is IFS whitespace and collapses them.
echo "$ASSETS_JSON" | python3 -c '
import json, sys
assets = json.load(sys.stdin)["assets"]
for a in sorted(assets, key=lambda x: x["id"]):
    print("\x1f".join(str(a.get(k) or "") for k in
          ("id","blob_url","project","model","label","created_at","est_usd","actual_usd","request_id","content_type")))
' | while IFS=$'\x1f' read -r ID URL PROJECT MODEL LABEL CREATED EST ACTUAL REQID CTYPE; do
  DATE=$(echo "$CREATED" | cut -dT -f1)
  TIME=$(echo "$CREATED" | cut -dT -f2 | cut -d. -f1 | tr -d :)
  case "$CTYPE" in
    *png) EXT=png ;; *jpeg|*jpg) EXT=jpg ;; *webp) EXT=webp ;;
    *mp4) EXT=mp4 ;; *webm) EXT=webm ;; *) EXT="${URL##*.}"; EXT="${EXT%%\?*}" ;;
  esac
  MODEL_SLUG=$(echo "$MODEL" | sed 's|fal-ai/||; s|/|-|g')
  DIR="assets/$PROJECT/$DATE"
  FILE="$DIR/${TIME}_${MODEL_SLUG}_${LABEL}.${EXT}"
  mkdir -p "$DIR"
  if [ ! -f "$FILE" ]; then
    curl -fsSL "$URL" -o "$FILE"
    COST="${ACTUAL:-$EST}"; COST="${COST:-0}"
    printf '{"ts":"%s","project":"%s","model":"%s","label":"%s","cost_usd":%s,"file":"%s","url":"%s","request_id":"%s"}\n' \
      "$CREATED" "$PROJECT" "$MODEL" "$LABEL" "$COST" "$FILE" "$URL" "$REQID" >> assets/manifest.jsonl
    echo "synced → $FILE"
  fi
  echo "$ID" > "$STATE_FILE"
done

echo "sync complete (last id: $(cat "$STATE_FILE" 2>/dev/null || echo 0))"

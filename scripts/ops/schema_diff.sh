#!/bin/bash
set -euo pipefail

SNAP_DIR="ops/schema"
TODAY="$SNAP_DIR/schema_public_$(date +%Y%m%d).txt"

mkdir -p "$SNAP_DIR"

if [[ -z "${NETTMARK_DB_READONLY_URL:-}" ]]; then
  echo "Missing NETTMARK_DB_READONLY_URL. Run: source .secrets/ops.env"
  exit 1
fi

psql "$NETTMARK_DB_READONLY_URL" -v ON_ERROR_STOP=1 -c "\dn+ public" > "$TODAY"
psql "$NETTMARK_DB_READONLY_URL" -v ON_ERROR_STOP=1 -c "\dt+ public.*" >> "$TODAY"

LAST="$(ls -1t "$SNAP_DIR"/schema_public_*.txt 2>/dev/null | sed -n '2p' || true)"

echo "=============================="
echo "SCHEMA SNAPSHOT"
echo "=============================="
echo "Wrote: $TODAY"
echo ""

if [[ -z "$LAST" ]]; then
  echo "No previous snapshot to diff against yet."
  exit 0
fi

echo "=============================="
echo "SCHEMA DIFF vs previous"
echo "=============================="
echo "Prev: $LAST"
echo ""

diff -u "$LAST" "$TODAY" || true

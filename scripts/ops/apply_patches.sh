#!/usr/bin/env bash
set -euo pipefail

QUEUE_DIR="ops/patches/queue"
APPLIED_DIR="ops/patches/applied"
FAILED_DIR="ops/patches/failed"

mkdir -p "$QUEUE_DIR" "$APPLIED_DIR" "$FAILED_DIR"

shopt -s nullglob
PATCHES=("$QUEUE_DIR"/*.patch)

if [[ ${#PATCHES[@]} -eq 0 ]]; then
  echo "No patches in $QUEUE_DIR"
  exit 0
fi

echo "Applying ${#PATCHES[@]} patch(es)..."

for p in "${PATCHES[@]}"; do
  base="$(basename "$p")"
  echo ""
  echo "==> $base"

  # Dry run first (won't change anything)
  if ! git apply --check "$p"; then
    echo "Patch FAILED check: $base"
    mv "$p" "$FAILED_DIR/$base"
    exit 2
  fi

  # Apply for real
  git apply "$p"
  mv "$p" "$APPLIED_DIR/$base"
  echo "Applied: $base"
done

echo ""
echo "All patches applied."


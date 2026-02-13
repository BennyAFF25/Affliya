#!/usr/bin/env bash
set -euo pipefail

TICKET_ID="${1:-}"
if [[ -z "$TICKET_ID" ]]; then
  echo "Usage: ./scripts/ops/execute_ticket.sh TICKET-123"
  exit 1
fi

TICKET_DIR="ops/tickets/${TICKET_ID}"
APPROVAL_FILE="${TICKET_DIR}/APPROVED"
PATCH_DIR="${TICKET_DIR}/patches"
QUEUE_DIR="ops/patches/queue"

if [[ ! -d "$TICKET_DIR" ]]; then
  echo "REFUSING: Ticket folder not found: $TICKET_DIR"
  exit 2
fi

if [[ ! -f "$APPROVAL_FILE" ]]; then
  echo "REFUSING: No approval file found: $APPROVAL_FILE"
  exit 3
fi

if [[ ! -d "$PATCH_DIR" ]]; then
  echo "REFUSING: Ticket patches folder not found: $PATCH_DIR"
  exit 4
fi

mkdir -p "$QUEUE_DIR"

echo "=============================="
echo "EXECUTE TICKET: $TICKET_ID"
echo "=============================="

echo ""
echo "--- git status (pre) ---"
git status --porcelain || true

echo ""
echo "--- staging ticket patches into queue ---"
shopt -s nullglob
PATCHES=( "$PATCH_DIR"/*.patch )
shopt -u nullglob

if [[ ${#PATCHES[@]} -eq 0 ]]; then
  echo "REFUSING: No .patch files found in: $PATCH_DIR"
  exit 5
fi

# Copy ticket patches into global queue with ticket prefix to keep ordering obvious
for p in "${PATCHES[@]}"; do
  base="$(basename "$p")"
  cp "$p" "${QUEUE_DIR}/${TICKET_ID}__${base}"
  echo "Queued: ${TICKET_ID}__${base}"
done

echo ""
echo "--- applying patches ---"
./scripts/ops/apply_patches.sh

echo ""
echo "--- verify (build only) ---"
yarn -s build

# Optional: commit changes automatically if anything changed
echo ""
echo "--- git status (post) ---"
CHANGES="$(git status --porcelain || true)"
if [[ -n "$CHANGES" ]]; then
  echo "$CHANGES"
  echo ""
  echo "--- committing ---"
  git add -A
  git commit -m "ops(ticket): ${TICKET_ID}" || true
else
  echo "No changes detected after applying patches."
fi

# Optional brief
if [[ -x ./scripts/ops/daily_brief.sh ]]; then
  echo ""
  echo "--- daily brief ---"
  ./scripts/ops/daily_brief.sh || true
fi

echo ""
echo "DONE: $TICKET_ID"

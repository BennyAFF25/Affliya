#!/usr/bin/env bash

set -e

LATEST=$(ls -t ops/context/context_*.txt 2>/dev/null | head -n1)
PREVIOUS=$(ls -t ops/context/context_*.txt 2>/dev/null | sed -n '2p')

echo "=============================="
echo "NETTMARK CONTEXT DIFF"
echo "=============================="

if [ -z "$LATEST" ]; then
  echo "No context files found."
  exit 1
fi

if [ -z "$PREVIOUS" ]; then
  echo "No previous context snapshot to compare."
  exit 0
fi

echo "Comparing:"
echo "  NEW: $LATEST"
echo "  OLD: $PREVIOUS"
echo ""

diff -u "$PREVIOUS" "$LATEST" || true

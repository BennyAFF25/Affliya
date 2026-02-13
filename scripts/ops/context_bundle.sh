#!/usr/bin/env bash
set -euo pipefail

echo "=============================="
echo "NETTMARK CONTEXT BUNDLE"
echo "=============================="

echo
echo "--- Repo status ---"
git status -sb || true

echo
echo "--- Current branch + last 5 commits ---"
git rev-parse --abbrev-ref HEAD || true
git --no-pager log -5 --oneline || true

echo
echo "--- Schema snapshot (today) ---"
./scripts/ops/schema_diff.sh || true

echo
echo "--- Blockers report ---"
./scripts/ops/run_blockers_report.sh || true

echo
echo "--- Tables list (public) ---"
psql "$NETTMARK_DB_READONLY_URL" -c "\dt public.*" || true

echo
echo "=============================="
echo "END CONTEXT"
echo "=============================="

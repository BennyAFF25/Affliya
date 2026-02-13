#!/usr/bin/env bash
set -euo pipefail

echo "=============================="
echo "NETTMARK DAILY BRIEF"
echo "=============================="
echo ""

# 1) Repo status
echo "--- Repo status ---"
git status -sb || true
echo ""

echo "--- Recent commits ---"
git --no-pager log -n 5 --oneline 2>/dev/null || true
echo ""

# 2) Blockers report (noisy ok)
if [[ -x "./scripts/ops/run_blockers_report.sh" ]]; then
  echo "--- Blockers report ---"
  set +e
  ./scripts/ops/run_blockers_report.sh
  blockers_exit=$?
  set -e
  echo "blockers_exit_code=$blockers_exit"
  echo ""
else
  echo "--- Blockers report ---"
  echo "Missing: scripts/ops/run_blockers_report.sh"
  echo ""
  blockers_exit=0
fi

# 3) Schema snapshot
if [[ -x "./scripts/ops/schema_diff.sh" ]]; then
  echo "--- Schema snapshot ---"
  ./scripts/ops/schema_diff.sh || true
  echo ""
fi

# 4) Local build/typecheck (fast signal)
echo "--- Local checks ---"
if [[ -f "package.json" ]]; then
  if command -v yarn >/dev/null 2>&1; then
    echo "Running: yarn -s typecheck (if available)"
    yarn -s typecheck 2>/dev/null || echo "typecheck script missing or failed (review manually)"
  else
    echo "Yarn not found - skipping"
  fi
else
  echo "No package.json - skipping"
fi
echo ""

# 5) Human summary
echo "=============================="
echo "SUMMARY (human-style)"
echo "=============================="

if [[ "${blockers_exit:-0}" -ne 0 ]]; then
  echo "- Action now: Review blockers output. If IDs are old + not recurring, treat as historic and move on."
else
  echo "- Action now: No blockers detected."
fi

echo "- Watchlist: Any new schema diff, any typecheck/build failures."
echo "- Ignore: Anything dated months ago unless it’s recurring."

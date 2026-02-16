#!/usr/bin/env bash
set -euo pipefail

cmd="${1:-status}"

current_branch() {
  git branch --show-current 2>/dev/null || echo ""
}

repo_root() {
  git rev-parse --show-toplevel 2>/dev/null || echo ""
}

ensure_git_repo() {
  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "❌ Not inside a git repository."
    exit 1
  fi
}

status_report() {
  ensure_git_repo
  echo "=== BOT GUARD STATUS ==="
  echo "Repo: $(repo_root)"
  echo "Branch: $(current_branch)"
  echo

  echo "Changed files (staged + unstaged):"
  git status --porcelain || true
  echo

  local count
  count="$(git status --porcelain | wc -l | tr -d ' ')"
  echo "Change count: ${count}"
  if [[ "${count}" -gt 10 ]]; then
    echo "⚠️  WARNING: More than 10 changed files. This is high-risk for automated edits."
  fi
}

require_not_main() {
  ensure_git_repo
  local b
  b="$(current_branch)"
  if [[ "${b}" == "main" || "${b}" == "master" || -z "${b}" ]]; then
    echo "❌ Refusing to proceed on branch '${b}'. Create a bot branch first."
    echo "   Suggested: git checkout -b bot/<ticket-name>"
    exit 2
  fi
}

start_ticket() {
  ensure_git_repo
  local name="${1:-}"
  if [[ -z "${name}" ]]; then
    echo "❌ Missing ticket name."
    echo "   Usage: ops/bot/guard.sh start <ticket-name>"
    exit 1
  fi
  # normalize: spaces -> dashes
  name="${name// /-}"
  local branch="bot/${name}"
  git checkout -b "${branch}"
  echo "✅ Created and switched to ${branch}"
  status_report
}

case "${cmd}" in
  status)
    status_report
    ;;
  require-not-main)
    require_not_main
    echo "✅ OK: not on main"
    ;;
  start)
    start_ticket "${2:-}"
    ;;
  *)
    echo "Unknown command: ${cmd}"
    echo "Commands:"
    echo "  status"
    echo "  require-not-main"
    echo "  start <ticket-name>"
    exit 1
    ;;
esac

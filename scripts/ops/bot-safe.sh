#!/usr/bin/env bash
set -euo pipefail

# Bot-safe helper for repo operations
# - Avoids zsh glob issues with [] by always using bash here
# - Ensures required tools exist (rg)
# - Gives simple, repeatable commands for the bot

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "❌ Missing required tool: $1"
    echo "   Fix: brew install $1"
    exit 1
  fi
}

need rg

cmd="${1:-help}"
shift || true

case "$cmd" in
  find)
    # Usage: ./scripts/ops/bot-safe.sh find "<pattern>" [path]
    pattern="${1:-}"
    scope="${2:-app}"
    if [[ -z "$pattern" ]]; then
      echo "Usage: $0 find \"<pattern>\" [path]"
      exit 1
    fi
    rg -n --hidden --glob '!.next/*' --glob '!node_modules/*' "$pattern" "$scope"
    ;;

  show)
    # Usage: ./scripts/ops/bot-safe.sh show "<path>" [start] [end]
    file="${1:-}"
    start="${2:-1}"
    end="${3:-200}"
    if [[ -z "$file" ]]; then
      echo "Usage: $0 show \"<path>\" [start] [end]"
      exit 1
    fi
    sed -n "${start},${end}p" "$file"
    ;;

  ls)
    # Usage: ./scripts/ops/bot-safe.sh ls "<path>"
    target="${1:-.}"
    ls -la "$target"
    ;;

  *)
    echo "bot-safe commands:"
    echo "  find \"<pattern>\" [path]      # ripgrep search"
    echo "  show \"<file>\" [start] [end]  # print file lines"
    echo "  ls \"<path>\"                  # list"
    echo
    echo "Examples:"
    echo "  $0 find \"MarketingHeader\" app"
    echo "  $0 show \"app/affiliate/dashboard/promote/[offerId]/page.tsx\" 1 220"
    ;;
esac

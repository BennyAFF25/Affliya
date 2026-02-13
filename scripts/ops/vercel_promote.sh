#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <deployment-url>"
  echo "Example: $0 https://affliya-xxxxx-bens-projects-28b82cca.vercel.app"
  exit 1
fi

DEPLOYMENT_URL="$1"

echo "⚠️  You are about to PROMOTE this deployment to PRODUCTION:"
echo "   $DEPLOYMENT_URL"
echo
read -r -p "Type PROMOTE to continue: " CONFIRM
if [ "$CONFIRM" != "PROMOTE" ]; then
  echo "Canceled."
  exit 1
fi

npx vercel promote "$DEPLOYMENT_URL"

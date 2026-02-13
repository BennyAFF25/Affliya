#!/usr/bin/env bash
set -euo pipefail

# Read-only helper for Vercel observability.
# Requires VERCEL_TOKEN + VERCEL_TEAM_ID(optional) + VERCEL_PROJECT_ID(optional)

: "${VERCEL_TOKEN:?missing VERCEL_TOKEN}"

BASE="https://api.vercel.com"
auth_header=(-H "Authorization: Bearer ${VERCEL_TOKEN}")

query_team=()
if [[ -n "${VERCEL_TEAM_ID:-}" ]]; then
  query_team=("teamId=${VERCEL_TEAM_ID}")
fi

hdr() { printf "\n== %s ==\n" "$1"; }

hdr "Vercel user"
curl -sS "${auth_header[@]}" "${BASE}/v2/user" | jq '{user:{id,username,email}}'

if [[ -n "${VERCEL_PROJECT_ID:-}" ]]; then
  hdr "Recent deployments for project"
  qs=""
  if [[ ${#query_team[@]} -gt 0 ]]; then qs="?${query_team[0]}"; fi
  curl -sS "${auth_header[@]}" "${BASE}/v6/deployments${qs}&projectId=${VERCEL_PROJECT_ID}&limit=10" \
    | jq '{deployments:(.deployments // [])|map({uid,name,state,created,ready})}'
else
  hdr "Tip"
  echo "Set VERCEL_PROJECT_ID to pull deployments for a specific project."
fi

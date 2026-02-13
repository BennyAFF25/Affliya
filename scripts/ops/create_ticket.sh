#!/usr/bin/env bash
set -euo pipefail

TS="$(date +%Y%m%d_%H%M%S)"
ID="TICKET-${TS}"
DIR="ops/tickets/${ID}"

mkdir -p "${DIR}/patches"
echo "# ${ID}" > "${DIR}/plan.md"
echo "" >> "${DIR}/plan.md"
echo "Created: $(date -Is)" >> "${DIR}/plan.md"

echo "${ID}"
echo "${DIR}"

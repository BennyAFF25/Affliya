#!/usr/bin/env bash
set -euo pipefail
ID="${1:-}"
[ -z "$ID" ] && { echo "Usage: approve_ticket.sh TICKET-..."; exit 1; }
touch "ops/tickets/${ID}/APPROVED"
echo "Approved: ${ID}"

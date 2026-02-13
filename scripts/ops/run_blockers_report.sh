#!/usr/bin/env bash
set -euo pipefail

if [ -z "${NETTMARK_DB_READONLY_URL:-}" ]; then
  echo "NETTMARK_DB_READONLY_URL not set"
  exit 1
fi

echo "=============================="
echo "NETTMARK BLOCKERS REPORT"
echo "=============================="

BLOCKERS=0

run_check () {
  local title="$1"
  local query="$2"

  echo ""
  echo "--- $title ---"
  RESULT=$(psql "$NETTMARK_DB_READONLY_URL" -Atc "$query")
  if [ -n "$RESULT" ]; then
    echo "$RESULT"
    BLOCKERS=1
  else
    echo "OK"
  fi
}

# 1️⃣ Wallets negative
run_check "Negative Wallet Balances" "
select email, balance
from wallets
where balance < 0;
"

# 2️⃣ Conversions missing affiliate
run_check "Conversions Missing Affiliate ID" "
select id
from conversions
where affiliate_id is null;
"

# 3️⃣ Conversions missing offer
run_check "Conversions Missing Offer ID" "
select id
from conversions
where offer_id is null;
"

# 4️⃣ Live ads missing Meta campaign
run_check "Live Ads Missing Meta Campaign ID" "
select id
from live_ads
where meta_campaign_id is null;
"

# 5️⃣ Live ads spend mismatch
run_check "Live Ads Spend Mismatch" "
select id, spend, spend_transferred
from live_ads
where spend < spend_transferred;
"

# 6️⃣ Wallet deductions missing ad reference
run_check "Wallet Deductions Missing Ad ID" "
select id
from wallet_deductions
where ad_id is null;
"

run_check "Wallet Deductions Missing Ad ID (last 30d)" "
select id
from wallet_deductions
where ad_id is null
  and created_at >= now() - interval '30 days';
"

echo ""
if [ "$BLOCKERS" -eq 1 ]; then
  echo "⚠️  BLOCKERS DETECTED"
  exit 2
else
  echo "✅ No core blockers detected"
  exit 0
fi

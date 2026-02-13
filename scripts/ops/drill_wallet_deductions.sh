#!/usr/bin/env bash
set -euo pipefail

if [ -z "${NETTMARK_DB_READONLY_URL:-}" ]; then
  echo "NETTMARK_DB_READONLY_URL not set"
  exit 1
fi

echo "=============================="
echo "DRILLDOWN: wallet_deductions missing ad_id"
echo "=============================="

psql "$NETTMARK_DB_READONLY_URL" -c "
select
  id,
  affiliate_email,
  business_email,
  offer_id,
  ad_id,
  amount,
  description,
  created_at
from wallet_deductions
where ad_id is null
order by created_at desc
limit 50;
"

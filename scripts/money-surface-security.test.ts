import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const settleRoute = readFileSync("app/api/ad-spend/settle/route.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20261009102639_restrict_financial_rpcs_to_service_role.sql",
  "utf8",
);

assert.match(settleRoute, /CRON_SECRET/);
assert.match(settleRoute, /x-cron-secret/);
assert.match(settleRoute, /Authorization|authorization/);
assert.match(settleRoute, /UNAUTHORIZED/);

for (const fn of [
  "credit_wallet_topup",
  "record_wallet_refund",
  "settle_live_ad_spend",
  "create_wallet_payouts_for_conversion",
]) {
  assert.match(migration, new RegExp(`revoke all on function public\\.${fn}`));
}
assert.match(migration, /to service_role/);

console.log("money surface security tests passed");

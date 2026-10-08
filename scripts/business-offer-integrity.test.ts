import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

function read(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

function run() {
  const createOffer = read("app/business/my-business/create-offer/page.tsx");
  assert.match(createOffer, /candidateOfferIdRef/);
  assert.match(createOffer, /\.upsert\(\[newOffer\], \{ onConflict: "id" \}\)/);
  assert.match(createOffer, /Publishing…/);

  const onboarding = read("app/onboarding/for-business/page.tsx");
  assert.match(onboarding, /commission_value:[\s\S]{0,160}Number\.EPSILON/);
  assert.doesNotMatch(
    onboarding,
    /commission_value:\s*Math\.round\(\(priceValue \* commissionValue\) \/ 100\)/,
  );

  const tracking = read("app/business/setup-tracking/SetupTrackingContent.tsx");
  assert.match(tracking, /normalizeSiteHost/);
  assert.match(tracking, /<option value="Custom\/Other">Custom\/Other<\/option>/);
  assert.doesNotMatch(tracking, /<option value="Custom site">/);

  const dashboard = read("app/business/my-business/page.tsx");
  assert.match(
    dashboard,
    /href="\/business\/my-business\/edit-offer"[\s\S]{0,180}>Manage offers<\/Link>/,
  );

  const migration = read(
    "supabase/migrations/20261008062000_offer_commission_decimal.sql",
  );
  assert.match(
    migration,
    /alter column commission_value type numeric\(12,2\)/i,
  );

  console.log("business offer integrity tests passed");
}

run();

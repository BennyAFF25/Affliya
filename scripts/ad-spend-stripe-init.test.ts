import * as assert from "node:assert/strict";

async function main() {
  const previousKey = process.env.STRIPE_SECRET_KEY;
  try {
    // Preview builds import API routes before the Stripe key may be configured.
    delete process.env.STRIPE_SECRET_KEY;
    const settlements = await import("../utils/adSpend/settlements");
    assert.equal(typeof settlements.settleAdSpendLedger, "function");
    assert.equal(typeof settlements.processAdSpendTransferBatches, "function");

    // Runtime operations must still reject missing credentials: never use
    // a dummy key or silently suppress a real payout configuration error.
    const readiness = await settlements.getTransferReadiness("acct_not_real");
    assert.equal(readiness.ok, false);
    assert.match(readiness.error || "", /Missing STRIPE_SECRET_KEY/);
    console.log("ad-spend Stripe lazy initialization tests passed");
  } finally {
    if (previousKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousKey;
  }
}

void main().catch(error => { console.error(error); process.exitCode = 1; });

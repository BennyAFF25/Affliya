/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import Module from "node:module";

let offerCurrency: string | null = "AUD";
let proposalCurrency: string | null = "AUD";
let accountCurrency: string | null = "AUD";
let writes: Array<{ table: string; values: any }> = [];
const db: any = {
  auth: { getUser: async () => ({ data: { user: { email: "business@test" } } }) },
  from(table: string) {
    let mutation: any;
    const row = () => table === "offers" ? { id: "offer", business_email: "business@test", currency: offerCurrency }
      : table === "ad_ideas" ? { id: "idea", offer_id: "offer", affiliate_email: "affiliate@test", business_email: "business@test", currency: proposalCurrency, status: "pending" }
      : table === "meta_connections" ? { ad_account_currency: accountCurrency }
      : table === "live_ads" ? { id: "live", ad_idea_id: "idea", offer_id: "offer", affiliate_email: "affiliate@test", business_email: "business@test", spend: 20, spend_transferred: 5 }
      : table === "ad_spend_settlements" ? [{ id: "settlement", live_ad_id: "live", business_email: "business@test", amount: 15 }] : null;
    const q: any = {
      select: () => q, eq: () => q, in: () => q, lte: () => q, order: () => q, limit: () => q,
      update: (values: any) => { mutation = values; writes.push({ table, values }); return q; },
      insert: () => { throw new Error("Unexpected insert"); },
      maybeSingle: async () => ({ data: row(), error: null }),
      then: (resolve: any, reject: any) => Promise.resolve({ data: mutation ? [] : row(), error: null }).then(resolve, reject),
    }; return q;
  },
};
const loader = Module as unknown as { _load: (name: string, parent: unknown, main: boolean) => any };
const original = loader._load;
loader._load = function(name, parent, main) {
  if (name.endsWith("offerReadiness")) return { resolveOfferPaidReadiness: async () => ({ resolvedMeta: { pageId: "page", adAccountId: "account" } }) };
  if (name.endsWith("businessSubscriptions")) return { createServerSupabaseClient: () => db };
  if (name === "@supabase/auth-helpers-nextjs") return { createRouteHandlerClient: () => db };
  if (name === "next/headers") return { cookies: () => ({}) };
  if (name.endsWith("/stripe")) return {
    createStripeClient: () => ({ transfers: { create: () => { throw new Error("Unexpected transfer"); } } }),
    getPlatformBalanceSnapshot: async () => ({ available: 100, pending: 0 }),
  };
  if (name.includes("meta/callback/upload-video/route")) return { POST: () => { throw new Error("Unexpected Meta launch"); } };
  return original.call(this, name, parent, main);
};
async function run() {
  globalThis.fetch = async () => { throw new Error("External calls prohibited in tests"); };
  const { checkPaidCurrency, guardPaidCurrency, PAID_CURRENCY_BLOCK_MESSAGE } = require("../utils/currency/paidCurrencyGuard");
  assert.equal(checkPaidCurrency("AUD", "AUD", "AUD").allowed, true);
  assert.equal(checkPaidCurrency(null, "AUD", "AUD").allowed, true);
  for (const currency of ["USD", "GBP", "CAD", "", null]) {
    assert.equal(checkPaidCurrency(null, currency, "AUD").allowed, false);
    assert.equal(checkPaidCurrency("AUD", "AUD", currency).allowed, false);
  }
  assert.equal(checkPaidCurrency("", "AUD", "AUD").allowed, true);
  const { settleAdSpendLedger, processAdSpendTransferBatches } = require("../utils/adSpend/settlements");
  for (const currency of ["USD", "GBP", "CAD"]) {
    offerCurrency = currency; proposalCurrency = null;
    assert.equal((await guardPaidCurrency({ supabase: db, liveAdId: "live" })).allowed, false);
    writes = [];
    const settled = await settleAdSpendLedger({ supabase: db, liveAdId: "live" });
    assert.equal(settled.chargedAmount, 0);
    assert.equal(settled.transferredAfter, 5);
    assert.equal(settled.error, "PAID_CURRENCY_BLOCKED");
    assert.equal(writes.length, 0);
    const reimbursement = await processAdSpendTransferBatches({ supabase: db });
    assert.equal(reimbursement.processedSettlementCount, 0);
    assert.ok(writes.every(w => w.table === "ad_spend_settlements" && w.values.status === "transfer_blocked"));
    assert.ok(writes[0].values.transfer_error_message.includes("Currency mismatch"));
  }
  offerCurrency = "AUD"; proposalCurrency = null;
  assert.equal((await guardPaidCurrency({ supabase: db, liveAdId: "live" })).allowed, true);
  const { markLaunchFundCampaignWentLive, redeemLaunchFundForSettlement } = require("../utils/launchFund");
  const { getAffiliateCampaignFundingReadiness } = require("../utils/paidCampaignLaunchReadiness");
  for (const unsupported of [null, "USD", "GBP", "CAD"]) {
    accountCurrency = unsupported;
    writes = [];
    const funding = await getAffiliateCampaignFundingReadiness({ supabase: db, offerId: "offer", affiliateEmail: "affiliate@test", adIdea: { currency: null, budget_amount: 2000 } });
    assert.equal(funding.ready, false);
    assert.equal(funding.currencyBlock, unsupported ? `Currency mismatch: offer AUD, ad account ${unsupported}` : PAID_CURRENCY_BLOCK_MESSAGE);
    assert.equal((await markLaunchFundCampaignWentLive({ supabase: db, liveAdId: "live", offerId: "offer", affiliateEmail: "affiliate@test" })).marked, false);
    assert.equal((await redeemLaunchFundForSettlement({ supabase: db, liveAdId: "live", amount: 10, allocationId: "allocation" })).redeemed, false);
    assert.equal((await settleAdSpendLedger({ supabase: db, liveAdId: "live" })).chargedAmount, 0);
    assert.equal(writes.length, 0);
    assert.equal((await processAdSpendTransferBatches({ supabase: db })).processedSettlementCount, 0);
    assert.ok(writes.every(w => w.values.status === "transfer_blocked"));
  }
  accountCurrency = null;
  assert.equal((await guardPaidCurrency({ supabase: db, offerId: "offer", adIdea: { currency: null } })).allowed, false);
  const { POST } = require("../app/api/business/ad-ideas/launch/route");
  // Existing-launch lookup must be empty in launch test.
  const oldFrom = db.from;
  db.from = (table: string) => table === "live_ads" ? { select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return this; }, maybeSingle: async () => ({ data: null }) } : oldFrom(table);
  writes = [];
  const response = await POST(new Request("https://nettmark.test/api/business/ad-ideas/launch", { method: "POST", body: JSON.stringify({ adIdeaId: "idea" }) }));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).message, PAID_CURRENCY_BLOCK_MESSAGE);
  assert.equal(writes.length, 0);
  console.log("Segment 1 currency containment mocked guard, settlement, reimbursement and launch tests passed");
}
void run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { loader._load = original; });

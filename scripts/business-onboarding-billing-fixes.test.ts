/* eslint-disable @typescript-eslint/no-explicit-any -- Query/Stripe test doubles model varied SDK responses. */
import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { resolveRuntimeCampaign } from "../utils/tracking/campaignIdentity";
import { COUNTRIES, normaliseCountry } from "../utils/countries";
import { businessCardSetupMessage } from "../utils/businessCardSetup";
import { isOrganicCaptionTooLong } from "../utils/organicCaption";

const requireMocked = createRequire(__filename);
type Row = Record<string, any>;
let tables: Record<string, Row[]>;
let failures: Record<string, boolean>;
let user: Row | null;
let calls: string[];
let createdAccount: Row | null;
let linkedDuringInsert = false;
let intentCustomer = "cus_business";
let webhookEvent: Row;
let invalidSignature = false;
let charges: Row[] = [];
let transfers: Row[] = [];
let transferFails = false;
const db = {
  auth: { getUser: async () => ({ data: { user }, error: null }) },
  from(table: string) {
    let matched = [...(tables[table] || [])];
    let action = "select";
    let values: Row | Row[] = {};
    let result: any;
    const execute = () => {
      if (result) return result;
      calls.push(`${table}:${action}`);
      if (failures[`${table}:${action}`]) return result = { data: null, error: { message: "fixture failure", code: "fixture" } };
      if (action === "insert" || action === "upsert") {
        if (table === "live_campaigns") linkedDuringInsert = tables.organic_posts[0].status === "approved" && !!tables.organic_posts[0].campaign_id;
        const inserts = (Array.isArray(values) ? values : [values]).map(row => ({ id: "inserted", ...row }));
        if (action !== "upsert" && inserts.some(row => tables[table]?.some(existing => existing.id === row.id))) return result = { data: null, error: { code: "23505" } };
        (tables[table] ||= []).push(...inserts);
        matched = inserts;
      }
      if (action === "update") matched.forEach(row => Object.assign(row, values));
      if (action === "delete") tables[table] = (tables[table] || []).filter(row => !matched.includes(row));
      return result = { data: matched, error: null };
    };
    const query: any = {
      select: () => query,
      eq: (key: string, value: unknown) => { matched = matched.filter(row => row[key] === value); return query; },
      in: (key: string, values: unknown[]) => { matched = matched.filter(row => values.includes(row[key])); return query; },
      ilike: (key: string, value: string) => { matched = matched.filter(row => String(row[key]).toLowerCase() === value.toLowerCase()); return query; },
      is: (key: string, value: unknown) => { matched = matched.filter(row => (row[key] ?? null) === value); return query; },
      limit: () => query, order: () => query,
      insert: (value: Row | Row[]) => { action = "insert"; values = value; return query; },
      upsert: (value: Row) => { action = "upsert"; values = value; return query; },
      update: (value: Row) => { action = "update"; values = value; return query; },
      delete: () => { action = "delete"; return query; },
      maybeSingle: async () => { const response = execute(); return { ...response, data: response.data?.[0] || null }; },
      single: async () => { const response = execute(); return { ...response, data: response.data?.[0] || null }; },
      then: (resolve: any) => Promise.resolve(execute()).then(resolve),
    };
    return query;
  },
};
const stripe = {
  webhooks: { constructEvent: () => { if (invalidSignature) throw new Error("fixture signature rejected"); return webhookEvent; } },
  accounts: {
    create: async (input: Row) => { createdAccount = input; return { id: "acct_new" }; },
    retrieve: async () => { calls.push("stripe:retrieve"); return { id: "acct_existing", capabilities: { transfers: "active" } }; },
  },
  accountLinks: { create: async () => ({ url: "https://stripe.invalid/onboarding" }) },
  paymentMethods: { list: async () => ({ data: [{ id: "pm_fixture" }] }) },
  paymentIntents: {
    create: async (input: Row) => { charges.push(input); return { id: "pi_fixture", status: "succeeded", latest_charge: null }; },
    retrieve: async () => ({ id: "pi_fixture", status: "succeeded", latest_charge: null }),
  },
  transfers: {
    create: async (input: Row) => { if (transferFails) throw new Error("fixture transfer failed"); transfers.push(input); return { id: "tr_fixture" }; },
  },
  setupIntents: { retrieve: async () => ({ customer: intentCustomer }) },
};
const loader = Module as unknown as { _load: (name: string, parent: unknown, isMain: boolean) => any };
const originalLoad = loader._load;
const originalFetch = globalThis.fetch;
loader._load = function(name, parent, isMain) {
  if (name === "@supabase/supabase-js") return { createClient: () => db };
  if (name === "@supabase/auth-helpers-nextjs") return { createRouteHandlerClient: () => db };
  if (name === "next/headers") return { cookies: () => ({}) };
  if (name.endsWith("/utils/stripe")) return { createStripeClient: () => stripe, buildStripeMetadata: (input: unknown) => input, buildNettmarkStripeMetadata: (_: unknown, input: unknown) => input };
  if (name.endsWith("/businessSubscriptions")) return { createServerSupabaseClient: () => db };
  if (name.endsWith("/criticalRouteAuthServer")) return { protectCriticalRoute: (_: unknown, work: unknown) => work };
  if (name.endsWith("/approvals/enforcement")) return {
    assertAffiliateOfferApproved: async () => ({ ok: true }), assertOfferTrackingReady: async () => ({ ok: true }),
  };
  if (name.endsWith("/businessPaymentReadiness")) throw new Error("Organic approval must not load payment readiness");
  return originalLoad.call(this, name, parent, isMain);
};
globalThis.fetch = async () => { throw new Error("Network prohibited in regression tests"); };
function reset() {
  tables = {
    business_profiles: [{ id: "business", business_email: "brand@test.invalid", country: null, stripe_customer_id: "cus_business" }],
    offers: [{ id: "offer", business_email: "brand@test.invalid" }],
    organic_posts: [{ id: "post", offer_id: "offer", business_email: "brand@test.invalid", affiliate_email: "affiliate@test.invalid", status: "pending", campaign_id: null, caption: "A caption" }],
  };
  user = { id: "user", email: "brand@test.invalid" };
  charges = []; transfers = []; transferFails = false;
  failures = {}; calls = []; createdAccount = null; linkedDuringInsert = false; intentCustomer = "cus_business";
}
const request = (input: Row, auth = true) => new Request("https://test.invalid/api", {
  method: "POST", headers: { "content-type": "application/json", ...(auth ? { authorization: "Bearer fixture" } : {}) }, body: JSON.stringify(input),
});
async function run() {
  try {
    process.env.STRIPE_SECRET_KEY = "sk_test_fixture";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://db.invalid";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture";
    assert.equal(COUNTRIES.length, 249);
    assert.equal(new Set(COUNTRIES.map(row => row.code)).size, 249);
    for (const name of ["GB", "UK", "United Kingdom", " England ", "Scotland", "Wales", "Great Britain"]) assert.equal(normaliseCountry(name), "GB");
    for (const name of ["USA", "United States", "us"]) assert.equal(normaliseCountry(name), "US");
    assert.equal(normaliseCountry("unknown"), null);
    assert.equal(isOrganicCaptionTooLong("a".repeat(500)), false);
    assert.equal(isOrganicCaptionTooLong("a".repeat(501)), true);
    assert.match(businessCardSetupMessage({ decline_code: "expired_card" }), /expired/);
    assert.match(businessCardSetupMessage({ code: "currency_not_supported" }), /currency/);
    assert.ok(!businessCardSetupMessage({ message: "private data" }).includes("private"));

    const connect = requireMocked("../app/api/stripe/create-account/route");
    reset();
    const response = await connect.POST(request({ email: user!.email }));
    assert.equal(response.status, 400); assert.equal((await response.json()).code, "BUSINESS_COUNTRY_REQUIRED");
    assert.equal(createdAccount, null); assert.equal(calls.some(call => call.endsWith(":update")), false);
    reset();
    assert.equal((await connect.POST(request({ email: user!.email, country: "UK" }))).status, 400);
    assert.equal(createdAccount, null);
    reset();
    assert.equal((await connect.POST(request({ email: user!.email, country: "US" }))).status, 200);
    assert.equal((createdAccount as Row | null)?.country, "US"); assert.equal(tables.business_profiles[0].country, "US");
    reset(); tables.business_profiles[0].country = "AU";
    assert.equal((await connect.POST(request({ email: user!.email, country: "US" }))).status,200);
    assert.equal(tables.business_profiles[0].country,"US");
    reset(); tables.business_profiles[0].country = "United Kingdom";
    await connect.POST(request({ email: user!.email })); assert.equal((createdAccount as Row | null)?.country, "GB");
    assert.equal(tables.business_profiles[0].country, "United Kingdom");
    reset(); tables.business_profiles[0].stripe_account_id = "acct_existing";
    assert.equal((await connect.POST(request({ email: user!.email, country: "invalid" }))).status, 200);
    assert.equal(createdAccount, null); assert.ok(calls.includes("stripe:retrieve"));

    reset();
    assert.equal((await connect.POST(request({ email: user!.email, country: "AU" }))).status,200);
    assert.equal((createdAccount as Row | null)?.country,"AU");
    const organic = requireMocked("../app/api/business/organic-campaigns/route");
    const approval = { submissionId: "post", offerId: "offer", businessEmail: "brand@test.invalid", affiliateEmail: "affiliate@test.invalid" };
    reset(); assert.equal((await organic.POST(request(approval, false))).status, 401);
    reset(); failures["live_campaigns:insert"] = true;
    assert.equal((await organic.POST(request(approval))).status, 500); assert.equal(tables.organic_posts[0].status, "pending");
    reset(); failures["organic_posts:update"] = true;
    assert.equal((await organic.POST(request(approval))).status, 500); assert.equal(tables.live_campaigns.length, 1); assert.equal(tables.organic_posts[0].status, "pending");
    reset();
    assert.equal((await organic.POST(request(approval))).status, 200);
    assert.equal(linkedDuringInsert, false); assert.equal(tables.organic_posts[0].status, "approved"); assert.equal(tables.organic_posts[0].campaign_id, "post");
    assert.equal((await organic.POST(request(approval))).status, 200); assert.equal(tables.live_campaigns.length, 1);
    reset();
    const concurrent = await Promise.all([organic.POST(request(approval)), organic.POST(request(approval))]);
    assert.ok(concurrent.every(result => result.status === 200)); assert.equal(tables.live_campaigns.length, 1);
    reset(); failures["organic_posts:update"] = true; failures["live_campaigns:delete"] = true;
    assert.equal((await organic.POST(request(approval))).status, 500);
    assert.equal(tables.organic_posts[0].status, "pending"); assert.equal(tables.live_campaigns.length, 1);
    failures = {};
    assert.equal((await organic.POST(request(approval))).status, 200); assert.equal(tables.live_campaigns.length, 1);
    reset(); tables.organic_posts[0].status = "approved";
    assert.equal((await organic.POST(request(approval))).status, 200); assert.equal(tables.organic_posts[0].campaign_id, "post");
    reset(); tables.organic_posts[0].caption = "a".repeat(501);
    assert.equal((await organic.POST(request(approval))).status, 400); assert.equal(tables.live_campaigns, undefined);
    reset(); tables.organic_posts[0].business_email = "other@test.invalid";
    assert.equal((await organic.POST(request(approval))).status, 403);
    reset(); tables.live_campaigns = [{ id: "post", type: "organic", offer_id: "offer", business_email: "brand@test.invalid", affiliate_email: "affiliate@test.invalid" }];
    assert.equal((await organic.POST(request(approval))).status, 200); assert.equal(tables.live_campaigns.length, 1);

    // Exercise actual conversion attribution, commission creation and payout handlers.
    // Business country/account currency must not affect an AUD offer's commission.
    const conversion = requireMocked("../app/api/process-conversion/route");
    const payoutRoute = requireMocked("../app/api/run-payout/route");
    for (const country of ["AU", "US"]) {
      for (const currency of ["AUD", "USD", "GBP"]) {
        reset();
        Object.assign(tables.business_profiles[0], { country, stripe_account_id: `acct_business_${country}`, default_currency: country === "AU" ? "aud" : "usd" });
        tables.offers[0] = { ...tables.offers[0], currency, commission: 10, conversion_scope: "store_wide" };
        tables.live_campaigns = [{ id: "11111111-1111-4111-8111-111111111111", offer_id: "offer", business_email: "brand@test.invalid", affiliate_email: "affiliate@test.invalid" }];
        tables.campaign_tracking_events = [{ id: "event", event_type: "conversion", campaign_id: "11111111-1111-4111-8111-111111111111", offer_id: "offer", amount: 100, currency, created_at: "2026-01-01T00:00:00Z" }];
        tables.affiliate_profiles = [{ email: "affiliate@test.invalid", stripe_account_id: "acct_affiliate_AU" }];
        const attribution = await resolveRuntimeCampaign(db as never, { campaignId: tables.campaign_tracking_events[0].campaign_id });
        assert.equal(attribution?.affiliateEmail,"affiliate@test.invalid"); assert.equal(attribution?.offerId,"offer");
        let response = await conversion.POST(request({event_id:"event"}));
        assert.equal(response.status,200); assert.equal(tables.wallet_payouts.length,1);
        const liability = tables.wallet_payouts[0];
        assert.equal(liability.amount,10); assert.equal(liability.currency,currency);
        assert.equal(liability.status,currency === "AUD" ? "pending" : "blocked_currency");
        response = await conversion.POST(request({event_id:"event"}));
        assert.equal(response.status,200); assert.equal(tables.wallet_payouts.length,1);
        if (currency === "AUD") {
          const maturity = liability.available_at;
          liability.available_at = "2099-01-01T00:00:00Z";
          assert.equal((await payoutRoute.POST(request({payout_id:liability.id}))).status,400);
          assert.equal(charges.length,0); liability.available_at = maturity;
          tables.business_profiles[0].stripe_customer_id = null;
          assert.equal((await payoutRoute.POST(request({payout_id:liability.id}))).status,400);
          assert.equal(charges.length,0); tables.business_profiles[0].stripe_customer_id = "cus_business";
          transferFails = true;
          assert.equal((await payoutRoute.POST(request({payout_id:liability.id}))).status,409);
          assert.equal(charges.length,1); assert.equal(transfers.length,0);
          transferFails = false;
        }
        response = await payoutRoute.POST(request({payout_id:liability.id}));
        if (currency === "AUD") {
          assert.equal(response.status,200); assert.equal(liability.status,"completed");
          assert.equal(charges.length,1); assert.equal(charges[0].customer,"cus_business"); assert.equal(charges[0].currency,"aud");
          assert.equal(transfers.length,1); assert.equal(transfers[0].destination,"acct_affiliate_AU"); assert.equal(transfers[0].amount,1000);
          assert.equal(transfers[0].currency,"aud");
          assert.equal((await payoutRoute.POST(request({payout_id:liability.id}))).status,200);
          assert.equal(charges.length,1); assert.equal(transfers.length,1);
        } else {
          assert.equal(response.status,409); assert.equal(charges.length,0); assert.equal(transfers.length,0);
        }
      }
    }
    reset(); tables.organic_posts[0].campaign_id = "random-column-default"; tables.organic_posts[0].status="approved";
    assert.equal((await organic.POST(request(approval))).status,200); assert.equal(tables.organic_posts[0].campaign_id,"post");

    const submit = requireMocked("../app/api/affiliate/organic-posts/create/route");
    reset();
    assert.equal((await submit.POST(request({ caption: "a".repeat(501) }))).status, 400);
    assert.equal(calls.some(call => call === "organic_posts:insert"), false);

    const failure = requireMocked("../app/api/stripe/setup-intent-failure/route");
    reset(); user = null;
    assert.equal((await failure.POST(request({ code: "card_declined" }))).status, 401);
    reset(); tables.business_profiles = [];
    assert.equal((await failure.POST(request({ code: "card_declined" }))).status, 403);
    reset(); intentCustomer = "cus_other";
    assert.equal((await failure.POST(request({ code: "card_declined", setup_intent: "seti_fixture" }))).status, 403);
    assert.equal(Boolean(tables.money_flow_audit_log), false);
    reset();
    assert.equal((await failure.POST(request({ code: "card_declined", decline_code: "do_not_honor", type: "card_error", setup_intent: "seti_fixture", message: "private card info", card_number: "private" }))).status, 200);
    assert.equal(tables.money_flow_audit_log.length, 1);
    const audit = tables.money_flow_audit_log[0];
    assert.equal(audit.event_type, "business_card_setup_failed"); assert.equal(audit.source_route, "app/api/stripe/setup-intent-failure/route.ts");
    assert.equal(audit.business_id, "business"); assert.equal(audit.metadata.decline_code, "do_not_honor");
    assert.ok(!JSON.stringify(audit).includes("private"));
    reset(); failures["money_flow_audit_log:insert"] = true;
    assert.equal((await failure.POST(request({ code: "card_declined" }))).status, 500);
    reset(); user = { id: "affiliate", email: "affiliate@test.invalid" };
    const paid = requireMocked("../app/api/affiliate/ad-ideas/create/route");
    const offerId = "11111111-1111-4111-8111-111111111111";
    tables.profiles = [{ id: user.id, role: "affiliate" }];
    tables.offers = [{ id: offerId, business_email: "brand@test.invalid", currency: "AUD" }];
    tables.affiliate_requests = [{ id: "access", offer_id: offerId, affiliate_email: user.email, status: "approved" }];
    let paidResponse = await paid.POST(request({ offer_id: offerId, headline: "Headline", caption: "Caption", currency: "AUD" }));
    assert.equal(paidResponse.status, 409); assert.equal((await paidResponse.json()).error, "META_ACCESS_REQUEST_REQUIRED");
    tables.product_events = [{ id: "request", offer_id: offerId, actor_email: user.email, event_type: "paid_promotion_meta_requested" }];
    paidResponse = await paid.POST(request({ offer_id: offerId, headline: "Headline", caption: "Caption", currency: "AUD" }));
    assert.notEqual((await paidResponse.json()).error, "META_ACCESS_REQUEST_REQUIRED");
    // Offer with connected Meta Page + ad account: no separate request needed.
    tables.product_events = []; tables.offers[0].meta_page_id = "page"; tables.offers[0].meta_ad_account_id = "act_1";
    paidResponse = await paid.POST(request({ offer_id: offerId, headline: "Headline", caption: "Caption", currency: "AUD" }));
    assert.notEqual((await paidResponse.json()).error, "META_ACCESS_REQUEST_REQUIRED");

    reset();
    process.env.STRIPE_WEBHOOK_SECRET = "fixture";
    webhookEvent = { type: "setup_intent.setup_failed", data: { object: {
      id: "seti_fixture", customer: "cus_business", last_setup_error: { code: "card_declined", decline_code: "insufficient_funds", type: "card_error", message: "private info" },
    } } };
    const webhook = requireMocked("../app/api/stripe/webhook/route");
    assert.equal((await webhook.POST(request({}))).status, 200);
    assert.equal(tables.money_flow_audit_log.length, 1);
    assert.equal(tables.money_flow_audit_log[0].metadata.decline_code, "insufficient_funds");
    assert.ok(!JSON.stringify(tables.money_flow_audit_log).includes("private info"));
    reset(); failures["money_flow_audit_log:insert"] = true;
    assert.equal((await webhook.POST(request({}))).status, 500, "Audit failure asks Stripe to retry");
    reset(); invalidSignature = true;
    assert.equal((await webhook.POST(request({}))).status, 400);
    assert.equal(Boolean(tables.money_flow_audit_log), false);
    console.log("Business onboarding/billing mocked route regressions passed");
  } finally { loader._load = originalLoad; globalThis.fetch = originalFetch; }
}
void run().catch(error => { console.error(error); process.exitCode = 1; });

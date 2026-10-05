import * as assert from "node:assert/strict";
import Module from "node:module";
import * as helpers from "../utils/businessSubscriptions";
import { BUSINESS_FUNNEL_ROLLOUT_AT } from "../utils/businessOnboardingFunnel";
type Row = Record<string, any>;
const id = "11111111-1111-4111-8111-111111111110", offerId = "22222222-2222-4222-8222-222222222222";
let user: { id: string; email: string } | null;
let tables: Record<string, Row[]>, writes: Array<{ table: string; value: unknown }>, errors: Record<string, any>;
let sessionsCreated = 0, customersEnsured = 0, historical: Row[] = [], session: Row;
const database = {
  auth: { getUser: async () => ({ data: { user }, error: null }) },
  from(table: string) {
    let rows = [...(tables[table] || [])], mutation = false;
    const builder = {
      select: () => builder,
      eq: (key: string, value: unknown) => { rows = rows.filter(row => row[key] === value); return builder; },
      contains: (key: string, value: Row) => { rows = rows.filter(row => Object.entries(value).every(([k,v]) => row[key]?.[k] === v)); return builder; },
      order: () => builder, limit: (n: number) => { rows = rows.slice(0,n); return builder; },
      insert: (value: unknown) => { mutation = true; writes.push({ table, value }); return builder; },
      update: (value: unknown) => { mutation = true; writes.push({ table, value }); return builder; },
      maybeSingle: async () => ({ data: rows[0] || null, error: errors[table] || null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: mutation ? null : rows, error: errors[table] || null }).then(resolve),
    }; return builder;
  },
};
const stripe = {
  prices: { retrieve: async () => ({ id: "price_test", active: true, type: "recurring", unit_amount: 7200, currency: "aud", billing_scheme: "per_unit", tax_behavior: "inclusive", recurring: { usage_type: "licensed", interval: "month", interval_count: 1 } }) },
  customers: { search: async () => ({ data: [], has_more: false }) },
  subscriptions: { list: async () => ({ data: historical, has_more: false }) },
  checkout: { sessions: { retrieve: async () => session, create: async (body: Row) => { sessionsCreated++; assert.equal(body.payment_method_collection, "always"); assert.match(body.success_url, /\/business\/choose-plan\?subscription=checkout_returned&session_id=/); assert.equal(body.subscription_data.trial_period_days, helpers.BUSINESS_GROWTH_TRIAL_DAYS); assert.equal(body.metadata.business_onboarding_funnel, "trial_first_v1"); return { id: "cs_test", url: "https://checkout.stripe.test/session" }; } } },
};
function reset() {
  user = { id, email: "business@example.test" }; writes = []; errors = {}; historical = []; sessionsCreated = 0; customersEnsured = 0;
  tables = { profiles: [{ id, email: user.email, role: "business", created_at: BUSINESS_FUNNEL_ROLLOUT_AT }],
    business_profiles: [{ id, business_email: user.email }],
    business_entitlements: [{ business_id: id, business_email: user.email, billing_status: "free", is_grandfathered: false, growth_trial_used: false, billing_entry_mode: "plan_choice" }],
    offers: [{ id: offerId, business_email: user.email, participation_mode: "open" }], product_events: [] };
  session = { id: "cs_test", mode: "subscription", status: "complete", payment_status: "paid", subscription: "sub_test", metadata: { business_id: id, user_id: id, nettmark_action: "business_subscription" } };
}
const loader = Module as unknown as { _load: (id: string, parent: unknown, isMain: boolean) => unknown };
const originalLoad = loader._load;
const env = { ...process.env };
loader._load = function (name, parent, isMain) {
  if (name === "@supabase/auth-helpers-nextjs") return { createRouteHandlerClient: () => database };
  if (name === "next/headers") return { cookies: () => ({}) };
  if (name.includes("utils/businessSubscriptions")) return {
    ...helpers, createServerSupabaseClient: () => database,
    createBusinessSubscriptionStripeClient: () => stripe,
    ensureSubscriptionCustomer: async () => { customersEnsured++; return "cus_test"; },
    findExistingLiveSubscription: async () => null,
  };
  return originalLoad.call(this, name, parent, isMain);
};
async function main() {
  Object.assign(process.env, { BUSINESS_SUBSCRIPTION_CHECKOUT_ENABLED: "true", STRIPE_NETTMARK_BUSINESS_MONTHLY_PRICE_ID: "price_test" });
  try {
    const eligibility = require("../app/api/business-subscription/trial-eligibility/route");
    const checkout = require("../app/api/business-subscription/create-checkout-session/route");
    const returned = require("../app/api/business-subscription/get-session/route");
    const free = require("../app/api/business-subscription/choose-free/route");
    const completion = require("../app/api/profile/onboarding-complete/route");
    const post = (body: Row = {}) => new Request("https://nettmark.test/api", { method: "POST", body: JSON.stringify(body) });
    const get = (query = "") => new Request("https://nettmark.test/api?" + query);
    reset();
    const initial = await eligibility.GET(get("businessId=" + id));
    assert.equal(initial.status, 200);
    const context = await initial.json();
    assert.equal(context.treatment, true); assert.equal(context.price.amount, 7200); assert.match(context.price.formatted, /72/);
    assert.deepEqual(writes, []); assert.equal(customersEnsured, 0); assert.equal(sessionsCreated, 0);
    reset(); tables.profiles[0].created_at = "2026-01-01T00:00:00Z";
    assert.equal((await (await eligibility.GET(get("businessId=" + id))).json()).treatment, false);
    reset(); tables.business_entitlements[0].billing_entry_mode = "legacy_deferred";
    assert.equal((await (await eligibility.GET(get("businessId=" + id))).json()).treatment, false);
    reset(); tables.product_events = [{ id: "free", actor_email: user!.email, event_type: "plan_free_clicked", meta: { choice_confirmed: true } }];
    assert.equal((await (await eligibility.GET(get("businessId=" + id))).json()).treatment, false);
    reset(); user = null;
    assert.equal((await eligibility.GET(get("businessId=" + id))).status, 401);
    assert.equal((await returned.GET(get("session_id=cs_test"))).status, 401);
    reset();
    assert.equal((await checkout.POST(post({ businessId: id, requireTrial: true, returnTo: "/business/choose-plan", intendedAction: "start_growth_trial" }))).status, 200);
    assert.equal(sessionsCreated, 1);
    reset(); tables.business_entitlements[0].growth_trial_used = true;
    assert.equal((await checkout.POST(post({ businessId: id, requireTrial: true }))).status, 409);
    assert.equal(sessionsCreated, 0); assert.equal(customersEnsured, 0);
    reset(); tables.business_entitlements[0].is_grandfathered = true;
    assert.equal((await (await checkout.POST(post({ businessId: id }))).json()).status, "grandfathered");
    assert.equal(sessionsCreated, 0);
    reset(); historical = [{ metadata: { nettmark_action: "business_subscription" } }];
    // Preflight found no customer, but authoritative checkout history detects the prior subscription.
    assert.equal((await checkout.POST(post({ businessId: id, requireTrial: true }))).status, 409);
    assert.equal(sessionsCreated, 0);
    reset(); session.metadata.user_id = "someone_else";
    assert.equal((await returned.GET(get("session_id=cs_test"))).status, 403); assert.deepEqual(writes, []);
    reset(); tables.business_profiles[0].business_email = "someone_else@example.test";
    assert.equal((await returned.GET(get("session_id=cs_test"))).status, 403);
    assert.equal((await free.POST(post({ businessId: id }))).status, 403);
    reset(); session.status = "open";
    const open = await returned.GET(get("session_id=cs_test")); assert.equal(open.headers.get("set-cookie"), null);
    reset();
    const valid = await returned.GET(get("session_id=cs_test"));
    assert.equal((await valid.json()).entitlementUpdated, false); assert.ok(valid.headers.get("set-cookie")); assert.deepEqual(writes, []);
    reset(); tables.business_entitlements[0].billing_status = "subscription_active";
    assert.equal((await free.POST(post({ businessId: id }))).status, 200);
    assert.ok(writes.some(w => w.table === "product_events"));
    assert.ok(!writes.some(w => w.table === "business_entitlements")); assert.equal(sessionsCreated, 0);
    reset(); tables.offers = [];
    assert.equal((await completion.POST(post({ offerId }))).status, 409); assert.deepEqual(writes, []);
    reset(); tables.offers[0].business_email = "someone_else@example.test";
    assert.equal((await completion.POST(post({ offerId }))).status, 409);
    reset();
    assert.equal((await completion.POST(post({ offerId }))).status, 200);
    assert.equal((await completion.POST(post({ offerId }))).status, 200);
    assert.ok(!writes.some(w => w.table === "offers"), "Completion retries never insert another offer");
    reset(); errors.product_events = { message: "telemetry unavailable" };
    assert.equal((await completion.POST(post({ offerId }))).status, 200, "Telemetry failure cannot block saved offers");
    console.log("Business continuation ownership, checkout and retry tests passed");
  } finally {
    loader._load = originalLoad;
    for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
    Object.assign(process.env, env);
  }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });

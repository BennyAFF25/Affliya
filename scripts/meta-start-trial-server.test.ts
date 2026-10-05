import * as assert from "node:assert/strict";
import Module from "node:module";
import type { SupabaseClient } from "@supabase/supabase-js";
type Row = Record<string, unknown>;
const now = Math.floor(Date.now() / 1000);
const userId = "11111111-1111-4111-8111-111111111111";
const businessId = "22222222-2222-4222-8222-222222222222";
const subscription = {
  id: "sub_fixture", customer: "cus_fixture", created: now, livemode: true, status: "trialing",
  trial_start: now, trial_end: now + 14 * 86400,
  metadata: { business_id: businessId, user_id: userId, business_email: "owner@brand.com", nettmark_platform: "nettmark", nettmark_action: "business_subscription" },
  items: { data: [{ price: { id: "price_fixture" }, quantity: 1 }] },
};
const event = { id: "evt_fixture", livemode: true, type: "customer.subscription.created", data: { object: subscription } };
let tables: Record<string, Row[]>;
let requestCount = 0, shouldFail = false, insertFails = false, claimFails = false;
const database = {
  from(table: string) {
    let rows = [...(tables[table] || [])];
    const builder = {
      select: () => builder,
      eq: (key: string, value: unknown) => { rows = rows.filter(row => row[key] === value); return builder; },
      lte: () => builder, order: () => builder, limit: () => builder,
      maybeSingle: async () => ({ data: rows[0] || null, error: null }),
      upsert: (row: Row) => {
        if (!tables[table]) tables[table] = [];
        if (!insertFails && !tables[table].some(item => item.business_id === row.business_id)) tables[table].push({ ...row, status: "pending", attempts: 0 });
        return Promise.resolve({ error: insertFails ? { message: "fixture" } : null });
      },
      update: (value: Row) => {
        const mutation = {
          eq: (key: string, match: unknown) => { rows = rows.filter(row => row[key] === match); return mutation; },
          then: (resolve: (result: unknown) => unknown) => { rows.forEach(row => Object.assign(row, value)); return Promise.resolve({ error: null }).then(resolve); },
        };
        return mutation;
      },
    };
    return builder;
  },
  rpc: async () => {
    if (claimFails) return { data: null, error: { message: "fixture" } };
    const rows = (tables.meta_start_trial_delivery || []).filter(row => row.status === "pending" && Number(row.next_attempt_at || 0) <= Date.now());
    rows.forEach(row => { row.status = "sending"; row.attempts = Number(row.attempts) + 1; row.lease_token = "lease_" + row.attempts; });
    return { data: rows.map(row => ({ ...row })), error: null };
  },
} as unknown as SupabaseClient;
const loader = Module as unknown as { _load: (id: string, parent: unknown, isMain: boolean) => unknown };
const originalLoad = loader._load;
const originalFetch = global.fetch;
const env = { ...process.env };
loader._load = function(name, parent, isMain) {
  if (name.includes("../businessSubscriptions")) return {
    BUSINESS_GROWTH_TRIAL_DAYS: 14, getBusinessSubscriptionPriceId: () => "price_fixture",
  };
  return originalLoad.call(this, name, parent, isMain);
};
function reset() {
  requestCount = 0; shouldFail = false; insertFails = false; claimFails = false;
  tables = {
    business_entitlements: [{ business_id: businessId, business_email: "owner@brand.com", stripe_subscription_id: "sub_fixture", is_grandfathered: false }],
    profiles: [{ id: userId, email: "owner@brand.com", role: "business" }],
    business_subscription_gate_events: [], meta_start_trial_delivery: [],
  };
  process.env.VERCEL_ENV = "production"; process.env.META_CAPI_ACCESS_TOKEN = "fixture-secret";
}
async function run() {
  const server = require("../utils/marketing/startTrialServer");
  global.fetch = async () => { requestCount++; return shouldFail ? new Response("", { status: 500 }) : Response.json({ events_received: 1 }); };
  reset();
  await server.recordConfirmedGrowthTrial({ supabase: database, event });
  await server.recordConfirmedGrowthTrial({ supabase: database, event });
  assert.equal(tables.meta_start_trial_delivery.length, 1);
  await Promise.all([server.deliverPendingGrowthTrials(database), server.deliverPendingGrowthTrials(database)]);
  assert.equal(requestCount, 1); assert.equal(tables.meta_start_trial_delivery[0].status, "sent");
  await server.recordConfirmedGrowthTrial({ supabase: database, event });
  await server.deliverPendingGrowthTrials(database);
  assert.equal(requestCount, 1);
  reset(); shouldFail = true;
  await server.recordConfirmedGrowthTrial({ supabase: database, event });
  const stableId = tables.meta_start_trial_delivery[0].event_id;
  await server.deliverPendingGrowthTrials(database);
  assert.equal(tables.meta_start_trial_delivery[0].status, "pending");
  assert.equal(tables.meta_start_trial_delivery[0].last_error, "meta_http_500");
  shouldFail = false; tables.meta_start_trial_delivery[0].next_attempt_at = 0;
  await server.deliverPendingGrowthTrials(database);
  assert.equal(tables.meta_start_trial_delivery[0].event_id, stableId);
  assert.equal(tables.meta_start_trial_delivery[0].status, "sent");
  for (const mode of ["preview", "development"]) {
    reset(); process.env.VERCEL_ENV = mode;
    await server.recordConfirmedGrowthTrial({ supabase: database, event });
    await server.deliverPendingGrowthTrials(database);
    assert.equal(tables.meta_start_trial_delivery.length, 0); assert.equal(requestCount, 0);
  }
  reset(); delete process.env.META_CAPI_ACCESS_TOKEN;
  await server.recordConfirmedGrowthTrial({ supabase: database, event });
  assert.equal(tables.meta_start_trial_delivery.length, 0);
  reset(); tables.business_entitlements[0].stripe_subscription_id = "unconfirmed";
  await server.recordConfirmedGrowthTrial({ supabase: database, event });
  assert.equal(tables.meta_start_trial_delivery.length, 0);
  reset(); tables.profiles[0].role = "affiliate";
  await server.recordConfirmedGrowthTrial({ supabase: database, event });
  assert.equal(tables.meta_start_trial_delivery.length, 0);
  reset();
  await server.recordConfirmedGrowthTrial({ supabase: database, event: { ...event, livemode: false } });
  await server.recordConfirmedGrowthTrial({ supabase: database, event: { ...event, type: "checkout.session.expired" } });
  assert.equal(tables.meta_start_trial_delivery.length, 0);
  reset(); insertFails = true;
  await assert.doesNotReject(server.recordConfirmedGrowthTrial({ supabase: database, event }));
  assert.equal(tables.meta_start_trial_delivery.length, 0);
  reset(); claimFails = true;
  await assert.doesNotReject(server.deliverPendingGrowthTrials(database));
  console.log("Meta StartTrial server persistence, retries, race and production guards passed");
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  loader._load = originalLoad; global.fetch = originalFetch;
  for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
  Object.assign(process.env, env);
});

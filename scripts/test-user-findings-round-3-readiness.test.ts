import assert from "node:assert/strict";
import Module from "node:module";
type Row = Record<string, unknown>;
let user: { email: string } | null = { email: "owner@example.test" };
let rows: Record<string, Row[]> = {};
let auditUnavailable = false;
let funding = 15;
const database = {
  auth: { getUser: async () => ({ data: { user }, error: null }) },
  from(table: string) {
    let matched = rows[table] || [];
    const result = () => ({ data: matched, error: table === "money_flow_audit_log" && auditUnavailable ? { message: "Unavailable" } : null });
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { matched = matched.filter(row => row[key] === value); return query; },
      order: () => query, limit: () => query,
      maybeSingle: async () => ({ ...result(), data: matched[0] || null }),
      then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return query;
  },
};
const loader = Module as unknown as { _load: (name: string, parent: unknown, isMain: boolean) => unknown };
const original = loader._load;
loader._load = function(name, parent, isMain) {
  if (name === "@supabase/auth-helpers-nextjs") return { createRouteHandlerClient: () => database };
  if (name === "next/headers") return { cookies: () => ({}) };
  if (name.includes("businessSubscriptions")) return { createServerSupabaseClient: () => database };
  if (name.includes("wallet/spendableBalance")) return { getSpendableWalletBalance: async () => 2.53 };
  if (name.includes("adSpend/settlements")) return {
    getAdSpendFundingSnapshot: async () => ({ availableBalance: funding }),
    getAdSpendSettlementConfig: () => ({ walletBuffer: 10 }),
  };
  return original.call(this, name, parent, isMain);
};
async function run() {
  try {
    const pause = require("../app/api/affiliate/campaign-pause-notices/route") as { GET: () => Promise<Response> };
    const readiness = require("../app/api/affiliate/offers/[offerId]/reach-readiness/route") as { GET: (request: Request, ctx: unknown) => Promise<Response> };
    const campaign = { id: "owned", affiliate_email: user!.email, status: "paused", billing_state: "PAUSED", spend: 12.47, spend_transferred: 0, billing_paused_at: "2026-10-14T00:00:00Z" };
    rows.live_ads = [campaign, { ...campaign, id: "foreign", affiliate_email: "other@example.test" }];
    let payload = await (await pause.GET()).json();
    assert.deepEqual(payload.notices, { owned: { confirmed: false, walletLeft: 2.53 } });
    rows.money_flow_audit_log = [{ affiliate_email: user!.email, live_ad_id: "owned", event_type: "campaign_pause_reason", reason_code: "LOW_FUNDS", created_at: "2026-10-14T00:00:01Z" }];
    funding = 100;
    payload = await (await pause.GET()).json();
    assert.equal(payload.notices.owned.confirmed, true, "Top-up does not erase confirmed pause cause");
    assert.equal(payload.notices.owned.needsFunds, false, "Recovered funding changes guidance without erasing pause history");
    rows.money_flow_audit_log[0].reason_code = "MANUAL_PAUSE";
    funding = 15;
    payload = await (await pause.GET()).json();
    assert.deepEqual(payload.notices, {}, "Recorded manual pauses must not be labeled low-funds pauses");
    auditUnavailable = true;
    payload = await (await pause.GET()).json();
    assert.equal(payload.notices.owned.confirmed, false, "Absent audit table safely falls back to current funding evidence");
    rows.live_ads[0].billing_state = "TERMINATED_BY_BUSINESS";
    payload = await (await pause.GET()).json();
    assert.deepEqual(payload.notices, {}, "Business termination cannot recommend a resume");
    const getReady = () => readiness.GET(new Request("https://www.nettmark.com"), { params: Promise.resolve({ offerId: "offer" }) });
    rows.offers = [{ id: "offer", business_email: "brand@example.test", meta_page_id: "page", meta_ad_account_id: "act_123" }];
    rows.meta_connections = [{ business_email: "brand@example.test", page_id: "page", ad_account_id: "456", access_token: "fixture-private" }];
    assert.deepEqual(await (await getReady()).json(), { ready: false }, "Wrong selected account must not enable reach");
    rows.meta_connections[0].ad_account_id = "123";
    assert.deepEqual(await (await getReady()).json(), { ready: true }, "Only readiness is serialized, never the token");
    rows.meta_connections = [];
    assert.deepEqual(await (await getReady()).json(), { ready: false }, "Stale asset IDs without a saved connection must skip reach");
    user = null;
    assert.equal((await pause.GET()).status, 401);
    assert.equal((await getReady()).status, 401);
    console.log("Round 3 readiness routes: ownership, auth, missing audit, manual pause, subsidy funding and disconnected Meta passed");
  } finally { loader._load = original; }
}
void run().catch(error => { console.error(error); process.exitCode = 1; });

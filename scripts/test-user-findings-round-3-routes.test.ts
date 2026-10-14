import assert from "node:assert/strict";
import Module from "node:module";
import { NextRequest } from "next/server";
const owner = "owner@example.test";
let userEmail: string | null = owner;
let clicks = 0, shopHits = 0;
const campaignId = "66f13993-0000-4000-8000-000000000000";
const db = {
  auth: { getUser: async () => ({ data: { user: userEmail ? { email: userEmail } : null }, error: null }) },
  rpc: async () => { shopHits++; return { error: null }; },
  from(table: string) {
    const row = table === "live_campaigns" ? { id: campaignId, offer_id: "offer", status: "active", affiliate_email: owner }
      : table === "offers" ? { website: "https://merchant.example.test/product" }
      : table === "profiles" ? { id: "11111111-1111-4111-8111-111111111111", email: owner } : null;
    const q = {
      select: () => q, eq: () => q,
      maybeSingle: async () => ({ data: row, error: null }),
      single: async () => ({ data: row, error: null }),
      insert: async () => { assert.equal(table, "clicks"); clicks++; return { error: null }; },
    };
    return q;
  },
};
const loader = Module as unknown as { _load: (name: string, parent: unknown, isMain: boolean) => unknown };
const original = loader._load;
loader._load = function(name, parent, isMain) {
  if (name === "@supabase/supabase-js") return { createClient: () => db };
  if (name === "@supabase/auth-helpers-nextjs") return { createRouteHandlerClient: () => db };
  if (name === "next/headers") return { cookies: () => ({}) };
  if (name.includes("approvals/enforcement")) return { assertAffiliateOfferApproved: async () => ({ ok: true }) };
  return original.call(this, name, parent, isMain);
};
async function run() {
  try {
    const route = require("../app/go/[ref]/route") as { GET: (req: NextRequest, ctx: unknown) => Promise<Response> };
    const visit = (preview: boolean) => route.GET(new NextRequest(`https://www.nettmark.com/go/${campaignId}${preview ? "?preview=1" : ""}`, { headers: { "user-agent": "Mozilla/5.0" } }), { params: Promise.resolve({ ref: campaignId }) });
    let response = await visit(true);
    assert.equal(response.status, 307);
    assert.equal(clicks, 0); assert.equal(shopHits, 0);
    assert.equal(response.headers.get("set-cookie"), null);
    assert.equal(response.headers.get("location"), "https://merchant.example.test/product");
    userEmail = null;
    response = await visit(true);
    assert.equal(clicks, 1); assert.equal(shopHits, 1);
    assert.ok(response.headers.get("location")?.includes("nm_aff="));
    userEmail = "other@example.test";
    await visit(true);
    assert.equal(clicks, 2);
    userEmail = owner;
    await visit(false);
    assert.equal(clicks, 3, "Public copied URL remains tracked, including an owner without a preview request");
    console.log("Round 3 mocked redirect route: owner preview and public flag abuse passed");
  } finally { loader._load = original; }
}
void run().catch(error => { console.error(error); process.exitCode = 1; });

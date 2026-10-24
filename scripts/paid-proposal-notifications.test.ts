import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeOfferMetaReady } from "../utils/offerMetaReadiness";
import Module, { createRequire } from "node:module";
import { notifyPaidProposal } from "../utils/affiliate/paidProposalNotification";

const requireMocked = createRequire(__filename);
let ready = false, html = "", lookupFailure = false, insertFailure = false, thrownFailure = false;
let notifications: any[] = [];
const user = { id: "affiliate", email: "affiliate@example.test" };
const db = {
  auth: { getUser: async () => ({ data: { user } }) },
  from(table: string) {
    const filters: Record<string, unknown> = {};
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters[key] = value; return query; },
      maybeSingle: async () => ({ data: table === "ad_ideas"
        ? { id: "idea", offer_id: "offer", affiliate_email: user.email, business_email: "brand@example.test", status: "pending" }
        : { id: "offer", title: "Offer", business_email: "brand@example.test", meta_page_id: ready ? "page" : null, meta_ad_account_id: ready ? "account" : null } }),
      limit: async () => {
        if (thrownFailure) throw new Error("offline");
        assert.equal(table, "notifications");
        return { data: notifications.filter(row => Object.entries(filters).every(([key, value]) => row[key] === value)), error: lookupFailure ? { message: "lookup failed" } : null };
      },
      insert: async (rows: any[]) => {
        assert.equal(table, "notifications");
        if (!insertFailure) notifications.push(...rows);
        return { error: insertFailure ? { message: "insert failed" } : null };
      },
    };
    return query;
  },
};
const loader = Module as any;
const original = loader._load;
loader._load = function(name: string, ...args: any[]) {
  if (name === "@supabase/auth-helpers-nextjs") return { createRouteHandlerClient: () => db };
  if (name === "next/headers") return { cookies: () => ({}) };
  if (name.endsWith("utils/businessSubscriptions")) return { createServerSupabaseClient: () => db };
  if (name.endsWith("utils/profileIdentity")) return { getAffiliateUsername: async () => "affiliate-name" };
  if (name === "resend") return { Resend: class { emails = { send: async (args: any) => { html = args.html; } }; } };
  return original.call(this, name, ...args);
};
async function main() {
  const priorKey = process.env.RESEND_API_KEY;
  const priorWarn = console.warn;
  let warnings = 0;
  console.warn = () => { warnings++; };
  try {
    const { POST } = requireMocked("../app/api/affiliate/ad-ideas/notify-submitted/route");
    const { PendingProposalRow } = requireMocked("../app/affiliate/dashboard/manage-campaigns/PendingProposalRow");
    const React = requireMocked("react");
    const { renderToStaticMarkup } = requireMocked("react-dom/server");
    const page = readFileSync("app/affiliate/dashboard/manage-campaigns/page.tsx", "utf8");
    assert.match(page, /select\("id,title,business_email,meta_page_id,meta_ad_account_id"\)/);
    assert.match(page, /computeOfferMetaReady\(offer\)\.metaReady/);
    assert.match(page, /metaReady: metaById\[row.offerId\]/);
    for (const [pageId, accountId] of [[null, null], ["page", null], [null, "account"], ["page", "account"]]) {
      assert.equal(computeOfferMetaReady({ business_email: "brand@example.test", meta_page_id: pageId, meta_ad_account_id: accountId }).metaReady, Boolean(pageId && accountId));
    }
    for (ready of [false, true]) {
      process.env.RESEND_API_KEY = "test";
      const response = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ adIdeaId: "idea" }) }));
      assert.equal(response.status, 200);
      assert.equal(html.includes("To approve and launch, connect your Facebook Page and Ad Account"), !ready);
      assert.ok(html.includes(ready ? "Review campaign" : "Review &amp; connect Meta"));
      assert.ok(html.includes("https://www.nettmark.com/business/my-business/ad-ideas?proposal=idea"));
      const card = renderToStaticMarkup(React.createElement(PendingProposalRow, { proposal: {
        id: "idea", offerId: "offer", offerTitle: "Offer", kind: "paid", state: "funding_required", metaReady: ready,
        growthReady: true, funding: { ready: false, requiredAmount: 10, deficit: 10 },
      } }));
      assert.equal(card.includes("The business has enabled paid promotion"), ready);
      assert.equal(card.includes("Paid proposals open · the brand still needs to connect Meta before this can launch"), !ready);
    }
    assert.equal(notifications.length, 1, "route retries dedupe the proposal");
    assert.deepEqual(Object.keys(notifications[0]).sort(), ["body", "link_url", "title", "user_email"]);
    const row = { ...notifications[0], link_url: "/business/my-business/ad-ideas?proposal=another" };
    await notifyPaidProposal(db as any, row);
    await notifyPaidProposal(db as any, row);
    assert.equal(notifications.length, 2, "a different proposal gets its own notification");
    notifications = [];
    delete process.env.RESEND_API_KEY;
    assert.equal((await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ adIdeaId: "idea" }) }))).status, 200);
    assert.equal(notifications.length, 1, "inbox notification does not require email configuration");
    notifications = [];
    for (const failure of ["lookup", "insert", "throw"]) {
      lookupFailure = failure === "lookup"; insertFailure = failure === "insert"; thrownFailure = failure === "throw";
      await assert.doesNotReject(() => notifyPaidProposal(db as any, row));
      assert.equal(notifications.length, 0);
    }
    assert.ok(warnings >= 3);
    console.log("Paid proposal email readiness, card copy, notification dedupe and failure handling passed");
  } finally {
    loader._load = original; console.warn = priorWarn;
    if (priorKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = priorKey;
  }
}
void main();

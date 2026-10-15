import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
const loadMockedModule = createRequire(__filename);
import { readFileSync } from 'node:fs';
import { formatAUD } from '../utils/currency';

let email: string | null = 'affiliate@test.invalid';
let failFunding = false, failEntitlement = false;
let entitlements = 0, fundingReads = 0, walletReads = 0, adminReads = 0;
let offerReads = 0, connectionReads = 0;
const proposals = Array.from({ length: 14 }, (_, i) => ({
  id: String(i), offer_id: i < 12 ? 'offer-a' : 'offer-b',
  affiliate_email: email, business_email: 'business@test.invalid', status: 'pending',
  budget_amount: i === 11 ? 2000 : 1000,
}));
const db = {
  auth: { getUser: async () => ({ data: { user: email ? { email } : null }, error: null }) },
  from(table: string) {
    adminReads++;
    if (table === "offers") offerReads++;
    if (table === "meta_connections") connectionReads++;
    const query = {
      select: () => query,
      eq: (column: string, value: string) => {
        if (table === 'ad_ideas') assert.equal(value, column === 'affiliate_email' ? email : 'pending');
        return query;
      },
      order: () => query, in: () => query,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({
        data: table === 'ad_ideas' ? proposals : table === 'meta_connections' ? [] : [{ id: 'offer-a', title: 'Brand', currency: 'AUD', business_email: 'business@test.invalid' }, { id: 'offer-b', title: 'Other', currency: 'AUD', business_email: 'business@test.invalid' }], error: null,
      }).then(resolve),
    };
    return query;
  },
};
const loader = Module as unknown as { _load: (name: string, parent: unknown, isMain: boolean) => unknown };
const original = loader._load;
loader._load = function(name, parent, isMain) {
  if (name === '@supabase/auth-helpers-nextjs') return { createRouteHandlerClient: () => db };
  if (name === 'next/headers') return { cookies: () => ({}) };
  if (name.endsWith('utils/businessSubscriptions')) return { createServerSupabaseClient: () => db };
  if (name.endsWith('utils/businessEntitlements')) return { getBusinessEntitlement: async () => {
    entitlements++;
    // All distinct funding checks must start without waiting for entitlement.
    await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(fundingReads, 3);
    if (failEntitlement) throw new Error('Mock entitlement unavailable');
    return { canLaunchCampaign: true };
  } };
  if (name.endsWith('utils/wallet/balance')) return { getWalletBalanceSnapshot: async () => { walletReads++; return { availableBalance: 15 }; } };
  if (name.endsWith('utils/paidCampaignLaunchReadiness')) return {
    getCampaignRequiredFundingDollars: (idea: { budget_amount: number }) => idea.budget_amount / 100,
    validatePaidCampaignTiming: () => ({ ok: true }),
    getAffiliateCampaignFundingReadiness: async (params: { affiliateEmail: string; offerId: string; adIdea: { budget_amount: number }; currencyReadiness: { allowed: boolean; message: string | null }; walletSnapshot: Promise<{ availableBalance: number }> }) => {
      fundingReads++;
      assert.equal(params.currencyReadiness.allowed, true, "Missing connection is ordinary readiness for AUD");
      assert.equal(params.currencyReadiness.message, null);
      assert.equal(params.affiliateEmail, email);
      const wallet = await params.walletSnapshot;
      if (failFunding) throw new Error('Mock funding unavailable');
      const requiredAmount = params.adIdea.budget_amount / 100;
      return { ready: wallet.availableBalance >= requiredAmount, requiredAmount, deficit: Math.max(0, requiredAmount - wallet.availableBalance) };
    },
  };
  return original.call(this, name, parent, isMain);
};
globalThis.fetch = async () => { throw new Error('No network permitted'); };
async function run() {
  try {
    const { GET } = loadMockedModule('../app/api/affiliate/pending-paid-proposals/route') as { GET: () => Promise<Response> };
    const check = async () => {
      entitlements = fundingReads = walletReads = offerReads = connectionReads = 0;
      const response = await GET();
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.proposals.length, proposals.length);
      assert.equal(offerReads, 1);
      assert.equal(connectionReads, 1, "Currency connection reads remain batched");
      assert.equal(entitlements, 1);
      assert.equal(fundingReads, 3, 'Shared offer/budget reads deduplicated; different budgets/offers independent');
      assert.equal(walletReads, 1);
      return body.proposals;
    };
    let rows = await check();
    assert.equal(rows[0].state, 'funded_waiting_for_business');
    assert.equal(rows[11].state, 'funding_required');
    assert.equal(rows[11].funding.requiredAmount, 20);
    await check(); // Caches must not survive requests.
    const originals = [...proposals];
    proposals.push(...originals.flatMap((row, i) => Array.from({ length: 9 }, (_, j) => ({ ...row, id: `extra-${i}-${j}` }))));
    await check(); // 140 proposals still use one offer query and one connection query.
    proposals.splice(14);
    failFunding = true;
    rows = await check();
    assert.ok(rows.every((row: { state: string }) => row.state === 'funding_unavailable'));
    failFunding = false; failEntitlement = true;
    rows = await check();
    assert.ok(rows.every((row: { state: string }) => row.state === 'waiting_for_business'));
    email = null;
    const before = adminReads;
    assert.equal((await GET()).status, 401);
    assert.equal(adminReads, before, 'Unauthenticated requests cannot use admin reads');
    const page = readFileSync('app/affiliate/dashboard/manage-campaigns/page.tsx', 'utf8');
    assert.equal((page.match(/fetch\("\/api\/affiliate\/pending-paid-proposals"/g) || []).length, 1);
    assert.match(page, /state: "loading" as const/);
    assert.equal(formatAUD(12.47), 'A$12.47');
    assert.equal(formatAUD(null), 'A$0.00');
    console.log('14-card batching, ownership filter, auth, concurrent reads, request isolation and failure states passed');
  } finally { loader._load = original; }
}
void run().catch(error => { console.error(error); process.exitCode = 1; });

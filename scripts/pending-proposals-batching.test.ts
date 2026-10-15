import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const requireMocked = createRequire(__filename);
let count = 1, email: string | null = 'affiliate@test.invalid', failure = '', missingEntitlements = false, currency = 'AUD', committed = false;
const reads: Record<string, number> = {};
let rpcReads = 0;
const proposals = () => Array.from({ length: count }, (_, i) => ({ id: `${i}`, offer_id: `offer-${i}`, business_email: `brand-${i}@test.invalid`, currency, budget_amount: i === 0 ? 2000 : 1000 }));
const db = {
  auth: { getUser: async () => ({ data: { user: email ? { email } : null } }) },
  rpc: async (name: string) => { assert.equal(name, 'expire_affiliate_launch_fund_allocations'); rpcReads++; },
  from(table: string) {
    reads[table] = (reads[table] || 0) + 1;
    const query = {
      select: () => query, eq: (key: string, value: unknown) => {
        if (table === 'ad_ideas') assert.equal(value, key === 'affiliate_email' ? email : 'pending');
        return query;
      }, in: () => query, gt: () => query, order: () => query,
      then(resolve: (value: unknown) => unknown) {
        const rows = proposals();
        const data = table === 'ad_ideas' ? rows : table === 'offers' ? rows.map(row => ({ id: row.offer_id, business_email: row.business_email, currency: 'AUD' }))
          : table === 'business_entitlements' ? missingEntitlements ? [] : rows.map(row => ({ business_email: row.business_email, billing_status: 'subscription_active' }))
          : table === 'business_profiles' ? rows.map(row => ({ id: row.business_email, business_email: row.business_email }))
          : table === 'wallet_topups' ? [{ credited_amount: 15, status: 'succeeded' }]
          : table === 'business_activation_subsidies' ? [{ offer_id: 'offer-0', subsidy_amount: 3, consumed_amount: 1 }]
          : table === 'affiliate_launch_fund_allocations' ? [{ allocated_for_offer_id: 'offer-0', amount: 2, allocated_for_campaign_id: committed ? 'live' : null }, { allocated_for_offer_id: 'offer-0', amount: 99 }]
          : [];
        return Promise.resolve({ data, error: failure === table ? { message: 'mock failure' } : null }).then(resolve);
      },
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
  return original.call(this, name, parent, isMain);
};
globalThis.fetch = async () => { throw new Error('No network permitted'); };
async function checkClientFetchCount() {
  const React = requireMocked('react');
  const previousLoader = loader._load;
  const previousFetch = globalThis.fetch;
  let stateIndex = 0, effectIndex = 0, refIndex = 0, cardCount = 1;
  let states: unknown[] = [], refs: { current: unknown }[] = [];
  let effects: { deps: unknown[]; callback: () => unknown; pending: boolean }[] = [];
  const fetches: string[] = [];
  let offerQueries: string[][] = [];
  const clientDb = {
    auth: { getSession: async () => ({ data: { session: { user: { email: 'affiliate@test.invalid' } } } }) },
    from(table: string) {
      const query = {
        select: () => query, eq: () => query, order: () => query, range: () => query, abortSignal: () => query,
        in: (_key: string, ids: string[]) => { offerQueries.push(ids); return query; },
        then(resolve: (value: unknown) => unknown) {
          const data = table === 'ad_ideas' ? Array.from({length: cardCount}, (_, i) => ({id: String(i), offer_id: `offer-${i}`, status:'pending'}))
            : table === 'offers' ? offerQueries[0].map(id => ({id, title: `Title ${id}`})) : [];
          return Promise.resolve({data, error:null}).then(resolve);
        },
      };
      return query;
    },
  };
  loader._load = function(name, parent, isMain) {
    if (name === 'react') return { ...React,
      useState: (initial: unknown) => {
        const index = stateIndex++;
        if (!(index in states)) states[index] = initial;
        return [states[index], (value: unknown) => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
      },
      useRef: (initial: unknown) => { const index = refIndex++; return refs[index] ??= { current: initial }; },
      useMemo: (fn: () => unknown) => fn(),
      useEffect: (callback: () => unknown, deps: unknown[]) => {
        const index = effectIndex++, previous = effects[index];
        effects[index] = { deps, callback, pending: !previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i])) };
      },
    };
    if (name.includes('supabase/pages-client')) return { supabase: clientDb };
    if (name.includes('wallet/spendableBalance')) return { getSpendableWalletBalance: async () => 15 };
    if (name.includes('ManageCampaignsWorkspace')) return { __esModule: true, default: () => null };
    return previousLoader.call(this, name, parent, isMain);
  };
  globalThis.fetch = async input => {
    fetches.push(String(input));
    return Response.json({ ok: true, campaigns: [{id:'organic', offer_id:'offer-0'}], proposals: Array.from({ length: cardCount }, (_, i) => ({ id: String(i), state: 'waiting_for_business' })) });
  };
  try {
    const Page = requireMocked('../app/affiliate/dashboard/manage-campaigns/page').default;
    for (cardCount of [1, 11, 14, 140]) {
      states = []; refs = []; effects = []; fetches.length = 0; offerQueries = [];
      const render = () => { stateIndex = effectIndex = refIndex = 0; return Page(); };
      render();
      // Run the initial load effect; browser focus/poll effects are intentionally outside this local harness.
      assert.equal(effects[1].pending, true);
      const cleanup = effects[1].callback() as () => void;
      await new Promise(resolve => setImmediate(resolve));
      const tree = render();
      assert.equal(tree.props.pendingCount, cardCount);
      assert.equal(offerQueries.length, 1, 'Submission and live campaign titles use one offers query');
      assert.equal(offerQueries[0].length, cardCount, 'Shared campaign offer is deduplicated');
      assert.equal(tree.props.campaigns[0].display_title, 'Title offer-0');
      assert.equal(tree.props.pendingContent[0].props.proposal.offerTitle, 'Title offer-0');
      assert.equal(effects[1].pending, false, 'State updates must not retrigger the load effect');
      assert.equal(fetches.filter(url => url === '/api/affiliate/pending-paid-proposals').length, 1);
      assert.equal(fetches.length, 3, 'Initial HTTP fetch count remains constant');
      cleanup();
    }
    console.log('Client load: one enrichment fetch and three total fetches and one offers title query at 1/11/14/140 cards; state rerender does not refetch');
  } finally { loader._load = previousLoader; globalThis.fetch = previousFetch; }
}

async function run() {
  try {
    const { GET } = requireMocked('../app/api/affiliate/pending-paid-proposals/route');
    const check = async () => {
      Object.keys(reads).forEach(key => delete reads[key]); rpcReads = 0;
      const response = await GET(); assert.equal(response.status, 200);
      const body = await response.json(); assert.equal(body.proposals.length, count);
      assert.equal(rpcReads, 1);
      for (const table of ['ad_ideas', 'offers', 'meta_connections', 'business_entitlements', 'wallet_topups', 'wallet_deductions', 'wallet_refunds', 'business_activation_subsidies', 'affiliate_launch_fund_allocations']) assert.equal(reads[table], 1, table);
      return body.proposals;
    };
    let rows = await check(); assert.equal(rows[0].funding.deficit, 1);
    committed = true; rows = await check(); assert.equal(rows[0].funding.deficit, 3, 'Committed earliest allocation cannot fall through to a newer uncommitted one'); committed = false;
    count = 14; await check(); count = 140; rows = await check();
    assert.equal(rows[139].state, 'funded_waiting_for_business');
    missingEntitlements = true; rows = await check(); assert.equal(reads.business_profiles, 1); assert.equal(rows[0].state, 'waiting_for_business'); missingEntitlements = false;
    failure = 'affiliate_launch_fund_allocations'; rows = await check(); assert.equal(rows[0].funding.deficit, 3);
    failure = 'business_activation_subsidies'; rows = await check(); assert.ok(rows.every((row: { state: string }) => row.state === 'funding_unavailable'));
    currency = 'USD'; rows = await check(); assert.ok(rows.every((row: { state: string }) => row.state === 'currency_blocked'), 'Currency blocking takes precedence even when funding data fails'); currency = 'AUD';
    failure = 'wallet_topups'; rows = await check(); assert.ok(rows.every((row: { state: string }) => row.state === 'funding_unavailable'));
    failure = 'business_entitlements'; rows = await check(); assert.ok(rows.every((row: { state: string }) => row.state === 'waiting_for_business'));
    email = null; const before = JSON.stringify(reads); assert.equal((await GET()).status, 401); assert.equal(JSON.stringify(reads), before);
    const page = readFileSync('app/affiliate/dashboard/manage-campaigns/page.tsx', 'utf8');
    assert.equal((page.match(/fetch\("\/api\/affiliate\/pending-paid-proposals"/g) || []).length, 1);
    assert.doesNotMatch(readFileSync('app/affiliate/dashboard/manage-campaigns/PendingProposalRow.tsx', 'utf8'), /\bfetch\s*\(/);
    await checkClientFetchCount();
    console.log('Constant real helper query/RPC counts for 1/14/140 distinct offers, businesses and budgets; funding selection, fallback, failures, auth and single client fetch source passed');
  } finally { loader._load = original; }
}
void run().catch(error => { console.error(error); process.exitCode = 1; });

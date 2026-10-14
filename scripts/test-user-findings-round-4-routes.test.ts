import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
const loadMockedModule = createRequire(__filename);
import { campaignStatusDetail } from '../utils/wallet/campaignStatus';
import { nextDayBudget } from '../utils/adSpend/fundingCoverage';

type Row = Record<string, unknown>;
let rows: Record<string, Row[]> = {};
let balance = 25;
let metaFailure = false;
let localFailure = false;
let extendedFailure = false;
let auditFailure = false;
let fundingFailure = false;
let insightsWithoutPause = false;
let settlementSuccess = false;
let settlementThreshold = 100;
const calls: { url: string; method: string }[] = [];
const db = { auth: { getUser: async () => ({ data: { user: { email: 'affiliate@test.invalid' } }, error: null }) }, from(table: string) {
  let matched = rows[table] || [];
  let mutation: Row | null = null;
  let insertion: Row | null = null;
  const result = () => {
    const error = localFailure && mutation || extendedFailure && mutation?.billing_state || auditFailure && insertion
      ? { message: 'fixture failure' } : null;
    if (!error && mutation) matched.forEach(row => Object.assign(row, mutation));
    if (!error && insertion) (rows[table] ||= []).push({ ...insertion, created_at: new Date().toISOString() });
    return { data: matched, error };
  };
  const query = {
    select: () => query, update: (value: Row) => { mutation = value; return query; },
    insert: (value: Row) => { insertion = value; return query; },
    eq: (key: string, value: unknown) => { matched = matched.filter(row => row[key] === value); return query; },
    in: (key: string, values: unknown[]) => { matched = matched.filter(row => values.includes(row[key])); return query; },
    not: (key: string) => { matched = matched.filter(row => row[key] != null); return query; },
    order: () => { matched = [...matched].reverse(); return query; }, limit: () => query,
    single: async () => ({ ...result(), data: matched[0] || null }),
    maybeSingle: async () => ({ ...result(), data: matched[0] || null }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
  };
  return query;
} };
const loader = Module as unknown as { _load: (name: string, parent: unknown, isMain: boolean) => unknown };
const originalLoad = loader._load;
const originalFetch = globalThis.fetch;
loader._load = function(name, parent, isMain) {
  if (name === '@supabase/supabase-js') return { createClient: () => db };
  if (name === '@supabase/auth-helpers-nextjs') return { createRouteHandlerClient: () => db };
  if (name === 'next/headers') return { cookies: () => ({}) };
  if (name.includes('businessSubscriptions')) return { createServerSupabaseClient: () => db };
  if (name.includes('wallet/spendableBalance')) return { getSpendableWalletBalance: async () => Math.max(0, balance - 12.47) };
  if (name.includes('adSpend/settlements')) return {
    getAdSpendFundingSnapshot: async () => { if (fundingFailure) throw new Error('mock wallet unavailable'); return { availableBalance: balance }; },
    getAdSpendSettlementConfig: () => ({ walletBuffer: 10, thresholdAmount: settlementThreshold }),
  };
  return originalLoad.call(this, name, parent, isMain);
};
let insights: { POST: (req: Request) => Promise<Response> };
globalThis.fetch = async (input, init) => {
  const url = String(input);
  calls.push({ url, method: init?.method || 'GET' });
  if (url.endsWith('/api/meta/ad-insights')) return insightsWithoutPause ? Response.json({ success: true, results: [{ ok: true, spend: 12.47 }] }) : insights.POST(new Request(url, init));
  if (url.includes('graph.facebook.com') && url.includes('/insights?')) return Response.json({ data: [{ spend: '12.47', clicks: '4', actions: [] }] });
  if (url.includes('graph.facebook.com') && init?.method === 'POST') {
    assert.equal(String(init.body), 'status=PAUSED', 'Only protective pause writes allowed');
    return Response.json(metaFailure ? { error: { message: 'mock rejected' } } : { success: true }, { status: metaFailure ? 400 : 200 });
  }
  if (url.endsWith('/api/ad-spend/settle') && settlementSuccess) {
    rows.live_ads[0].spend_transferred = 12.47; balance -= 12.47;
    return Response.json({ success: true, unpaidAfter: 0, transferredAfter: 12.47, chargedAmount: 12.47 });
  }
  if (url.endsWith('/api/ad-spend/process-transfer-batches')) return Response.json({ success: true });
  if (url.endsWith('/api/ad-spend/settle')) return Response.json({ success: false, error: 'mock settlement unavailable' }, { status: 503 });
  throw new Error('Unexpected outbound request blocked: ' + url);
};
function reset() {
  insightsWithoutPause = settlementSuccess = false; settlementThreshold = 100;
  balance = 25; fundingFailure = false; metaFailure = localFailure = extendedFailure = auditFailure = false; calls.length = 0;
  rows = { live_ads: [{ id: 'ad', ad_idea_id: 'idea', status: 'live', offer_id: 'offer', affiliate_email: 'affiliate@test.invalid', business_email: 'brand@test.invalid', meta_ad_id: 'meta', spend: 12.47, spend_transferred: 0 }],
    ad_ideas: [{ id: 'idea', budget_type: 'DAILY', budget_amount: 2000 }],
    meta_connections: [{ business_email: 'brand@test.invalid', access_token: 'mock-token' }] };
}
async function run() {
  try {
    insights = loadMockedModule('../app/api/meta/ad-insights/route');
    const cron = loadMockedModule('../app/api/meta/sync-active-ads/route') as { GET: (req: Request) => Promise<Response> };
    const notices = loadMockedModule('../app/api/affiliate/campaign-pause-notices/route') as { GET: () => Promise<Response> };
    const request = (auth = true, dry = false) => new Request('https://test.invalid/api/meta/sync-active-ads' + (dry ? '?dryRun=true' : ''), { headers: auth ? { authorization: 'Bearer mock-secret' } : {} });
    process.env.CRON_SECRET = 'mock-secret';
    reset();
    assert.equal((await cron.GET(request(false))).status, 401);
    assert.equal(calls.length, 0);
    delete process.env.CRON_SECRET;
    assert.equal((await cron.GET(request())).status, 500);
    process.env.CRON_SECRET = 'mock-secret';
    reset();
    let payload = await (await cron.GET(request(true, true))).json();
    assert.equal(payload.results[0].wouldPause, true, '25 - 12.47 cannot cover next day 20 even though fixed buffer 10 could');
    assert.equal(calls.length, 0, 'Dry run has no Meta or settlement calls');
    payload = await (await cron.GET(request())).json();
    assert.equal(payload.autoPaused, 1);
    assert.equal(rows.live_ads[0].status, 'paused');
    assert.equal(rows.live_ads[0].billing_state, 'PAUSED');
    assert.ok(rows.money_flow_audit_log.some(row => row.event_type === 'campaign_pause_reason' && row.reason_code === 'LOW_FUNDS'));
    assert.equal(calls.filter(call => call.method === 'POST' && call.url.includes('graph.facebook.com')).length, 1, 'Cron does not duplicate the insights pause');
    const notice = (await (await notices.GET()).json()).notices.ad;
    assert.equal(notice.confirmed, true);
    assert.match(campaignStatusDetail(rows.live_ads[0], notice), /wallet funds ran low/);
    calls.length = 0;
    await cron.GET(request());
    assert.equal(calls.length, 0, 'Paused ad excluded on retry');
    reset(); insightsWithoutPause = true;
    payload = await (await cron.GET(request())).json();
    assert.equal(payload.autoPaused, 1, 'Cron independently enforces next-day coverage');
    assert.ok(rows.money_flow_audit_log.some(row => row.reason_code === 'LOW_FUNDS'));
    reset(); settlementSuccess = true; settlementThreshold = 10; balance = 32.47;
    payload = await (await cron.GET(request())).json();
    assert.equal(payload.autoPaused, 0, 'Post-settlement snapshot deducts spend exactly once');
    assert.equal(balance, 20);
    assert.equal(rows.live_ads[0].spend_transferred, 12.47);
    reset(); balance = 32.47;
    payload = await (await cron.GET(request())).json();
    assert.equal(payload.autoPaused, 0, 'Exact pending plus budget boundary is covered');
    reset(); balance = 40;
    rows.live_ads.push({ id: 'other', affiliate_email: 'affiliate@test.invalid', spend: 15, spend_transferred: 0, status: 'stopped' });
    payload = await (await cron.GET(request())).json();
    assert.equal(payload.autoPaused, 1, 'Other campaign pending liabilities share the wallet');
    reset(); balance = 40;
    rows.live_ads.push({ id: 'other', ad_idea_id: 'idea', affiliate_email: 'affiliate@test.invalid', spend: 0, spend_transferred: 0, status: 'live' });
    payload = await (await cron.GET(request())).json();
    assert.equal(payload.autoPaused, 1, 'Concurrent live campaigns cannot each claim the same next-day funds');
    reset(); metaFailure = true;
    payload = await (await cron.GET(request())).json();
    assert.equal(payload.autoPaused, 0);
    assert.equal(payload.results[0].ok, false);
    assert.equal(rows.live_ads[0].status, 'live');
    assert.ok(!rows.money_flow_audit_log?.some(row => row.reason_code === 'LOW_FUNDS'));
    reset(); fundingFailure = true;
    payload = await (await cron.GET(request())).json();
    assert.equal(payload.results[0].ok, false);
    assert.equal(rows.live_ads[0].status, 'live', 'Wallet read failure must not fabricate a low-funds reason');
    reset(); localFailure = true;
    payload = await (await cron.GET(request())).json();
    assert.equal(payload.results[0].ok, false, 'Meta-only pause exposes failed local recording');
    assert.equal(rows.live_ads[0].status, 'live');
    reset(); extendedFailure = true;
    payload = await (await cron.GET(request())).json();
    assert.equal(rows.live_ads[0].status, 'paused', 'Missing optional billing columns falls back to status');
    assert.ok(rows.money_flow_audit_log.some(row => row.reason_code === 'LOW_FUNDS'));
    reset(); auditFailure = true;
    await cron.GET(request());
    assert.equal(rows.live_ads[0].status, 'paused', 'Audit failure must not prevent protective pause');
    const fallback = (await (await notices.GET()).json()).notices.ad;
    assert.equal(fallback.confirmed, false, 'No fabricated recorded reason');
    assert.equal(nextDayBudget({ budget_amount: 10000, budget_type: 'LIFETIME' }, 12.47), 87.53);
    assert.equal(nextDayBudget({ daily_budget: 1500 }), 15, 'Legacy budget mirrors Meta minor units');
    console.log('Round 4 mocked cron/insights/pause notices and failure regressions passed');
  } finally { globalThis.fetch = originalFetch; loader._load = originalLoad; }
}
void run().catch(error => { console.error(error); process.exitCode = 1; });

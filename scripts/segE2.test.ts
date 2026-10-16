/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import assert from 'node:assert/strict';
import Module from 'node:module';
import fs from 'node:fs';
const loader = Module as any, originalLoad = loader._load;
let transferred = 0, fail = false, releases = 0, charges = 0;
const events: string[] = [];
const ad: any = { id: 'ad', ad_idea_id: 'idea', offer_id: 'offer', affiliate_email: 'a', business_email: 'b',
  meta_ad_id: 'meta', status: 'paused', spend: 3, spend_transferred: 0 };
const db: any = {
  async rpc(name: string, args: any) {
    events.push(name);
    if (name === 'release_launch_hold') { releases++; return { error: null }; }
    assert.equal(name, 'settle_live_ad_spend');
    if (fail) return { error: { message: 'injected failure' } };
    if (args.p_expected_previous !== transferred) return { data: { applied: false, transferred_after: transferred }, error: null };
    charges++; transferred += args.p_original_amount;
    return { data: { applied: true, transferred_after: transferred }, error: null };
  },
  from(table: string) {
    let mutation: any, listing = false;
    const row = () => table === 'live_ads' ? { ...ad, spend_transferred: transferred }
      : table === 'offers' ? { currency: 'AUD', business_email: 'b' }
      : table === 'ad_ideas' ? { offer_id: 'offer', currency: 'AUD' }
      : table === 'meta_connections' ? { access_token: 'mock', ad_account_currency: 'AUD' }
      : table === 'wallet_topups' ? [{ amount_net: 100, status: 'succeeded' }]
      : table === 'wallet_deductions' || table === 'wallet_refunds' ? [] : null;
    const result = () => ({ data: listing ? [row()] : row(), error: null });
    const q: any = { select: () => q, eq: () => q, in: () => q, lte: () => q, order: () => q, limit: () => q,
      or: (filter: string) => { assert.match(filter,/paused/); assert.match(filter,/TERMINATED_BY_BUSINESS/); listing = true; return q; },
      update: (values: any) => { mutation = values; events.push('local-update'); return q; },
      insert: () => q, single: async () => result(), maybeSingle: async () => result(),
      then: (resolve: any, reject: any) => Promise.resolve(mutation ? { data: null, error: null } : result()).then(resolve,reject) };
    return q;
  },
};
loader._load = function(name: string, ...args: any[]) {
  if (name === '@supabase/supabase-js') return { createClient: () => db };
  if (name.endsWith('offerReadiness')) return { resolveOfferPaidReadiness: async () => ({ resolvedMeta: { pageId: 'p', adAccountId: 'a' } }) };
  if (name.endsWith('moneyFlowAudit')) return { tryWriteMoneyFlowAudit: async () => {} };
  return originalLoad.call(this,name,...args);
};
async function run() {
  const { settleAdSpendLedger, settleStoppedAdSpend, settlementExclusionReason } = require('../utils/adSpend/settlements');
  const result = await settleAdSpendLedger({ supabase: db, liveAdId: 'ad', force: true, chunkAmount: 1 });
  assert.equal(result.chargedAmount,3,'force ignores chunk and low-spend trigger');
  assert.equal(charges,1);
  assert.equal((await settleStoppedAdSpend({supabase:db,liveAdId:'ad',status:'paused',adIdeaId:'idea'})).chargedAmount,0);
  assert.equal(charges,1); assert.equal(releases,0,'pause retains hold');
  await settleStoppedAdSpend({supabase:db,liveAdId:'ad',status:'stopped',adIdeaId:'idea'});
  assert.equal(releases,1);
  transferred = 0; fail = true;
  const control = require('../app/api/meta/control-ad/route');
  globalThis.fetch = async () => { events.push('meta-pause'); return new Response(JSON.stringify({success:true})); };
  const response = await control.POST(new Request('http://local/api/meta/control-ad', {method:'POST',body:JSON.stringify({liveAdId:'ad',action:'PAUSE'})}));
  const body = await response.json();
  assert.equal(body.success,true); assert.equal(body.newStatus,'paused'); assert.ok(body.settlementError);
  assert.ok(events.indexOf('meta-pause') < events.lastIndexOf('settle_live_ad_spend'));
  assert.ok(events.indexOf('local-update') < events.lastIndexOf('settle_live_ad_spend'));
  const attempts = events.filter(e => e === 'settle_live_ad_spend').length;
  globalThis.fetch = async () => new Response(JSON.stringify({error:'mock rejection'}),{status:500});
  const rejected = await control.POST(new Request('http://local/api/meta/control-ad',{method:'POST',body:JSON.stringify({liveAdId:'ad',action:'ARCHIVE'})}));
  assert.equal(rejected.status,500);
  assert.equal(events.filter(e => e === 'settle_live_ad_spend').length,attempts,'failed Meta control never settles');
  ad.meta_ad_id = null;
  fail = false; process.env.CRON_SECRET = 'mock';
  const sync = require('../app/api/meta/sync-active-ads/route');
  globalThis.fetch = async (url: any) => { assert.match(String(url),/process-transfer-batches/,'stopped recovery needs no Meta calls'); return new Response('{}'); };
  for (const status of ['paused','archived','stopped','active']) {
    process.env.SETTLEMENT_STRANDED_ALLOW_IDS = status === 'active' ? ' ad , other ' : ''; 
    ad.billing_state = status === 'active' ? 'TERMINATED_BY_BUSINESS' : null;
    ad.status = status; transferred = 0;
    const res = await sync.GET(new Request('http://local/api/meta/sync-active-ads',{headers:{authorization:'Bearer mock'}}));
    const json = await res.json();
    assert.equal(json.results[0].settlement.chargedAmount,3);
    assert.equal(transferred,3);
  }
  delete process.env.SETTLEMENT_STRANDED_ALLOW_IDS;
  ad.billing_state = 'TERMINATED_BY_BUSINESS'; ad.status = 'stopped'; transferred = 0;
  const before = events.length;
  let json = await (await sync.GET(new Request('http://local/api/meta/sync-active-ads', {headers:{authorization:'Bearer mock'}}))).json();
  assert.equal(json.results[0].settlement.attempted,false);
  assert.equal(json.results[0].settlement.message,'BUSINESS_TERMINATED_MANUAL_REVIEW');
  assert.equal(events.length,before,'manual review does not charge or release holds');
  process.env.SETTLEMENT_EXCLUDED_META_CAMPAIGN_IDS = ' extra-campaign, , another ';
  process.env.SETTLEMENT_STRANDED_ALLOW_IDS = 'ad';
  assert.equal(settlementExclusionReason({...ad,meta_campaign_id:'extra-campaign'},'test'), 'PROTECTED_META_CAMPAIGN');
  assert.equal(settlementExclusionReason({...ad,meta_campaign_id:'another'},'test'), 'PROTECTED_META_CAMPAIGN');
  ad.meta_campaign_id = '120251784604850679';
  for (const force of [false,true]) {
    const result = await settleAdSpendLedger({supabase:db,liveAdId:'ad',force});
    assert.equal(result.skipped,'PROTECTED_META_CAMPAIGN');
    assert.equal(result.chargedAmount,0);
  }
  ad.spend = 0;
  await settleStoppedAdSpend({supabase:db,liveAdId:'ad',status:'archived',adIdeaId:'idea'});
  ad.spend = 3;
  for (const status of ['active','paused','archived','stopped']) {
    ad.status = status; ad.billing_state = null;
    json = await (await sync.GET(new Request('http://local/api/meta/sync-active-ads', {headers:{authorization:'Bearer mock'}}))).json();
    assert.equal(json.results[0].settlement.message,'PROTECTED_META_CAMPAIGN');
    assert.equal(json.results[0].settlement.attempted,false);
  }
  assert.equal(events.length,before,'protected worker and ledger paths have no mutations');
  ad.meta_ad_id = 'meta';
  globalThis.fetch = async () => new Response(JSON.stringify({success:true}));
  for (const action of ['PAUSE','ARCHIVE']) {
    const attemptsBefore = events.filter(e => e === 'settle_live_ad_spend' || e === 'release_launch_hold').length;
    const body = await (await control.POST(new Request('http://local/api/meta/control-ad', {method:'POST',body:JSON.stringify({liveAdId:'ad',action})}))).json();
    assert.equal(body.settlementSkipped,true);
    assert.equal(events.filter(e => e === 'settle_live_ad_spend' || e === 'release_launch_hold').length,attemptsBefore);
  }
  delete process.env.SETTLEMENT_EXCLUDED_META_CAMPAIGN_IDS;
  delete process.env.SETTLEMENT_STRANDED_ALLOW_IDS;
  const migration = fs.readFileSync('supabase/migrations/20261016240000_segE2_hold_lifecycle.sql','utf8');
  assert.doesNotMatch(migration,/IN \('paused'/); assert.match(migration,/NEW.spend_transferred/);
  const original = fs.readFileSync('supabase/migrations/20261016190000_segA_atomic_launch_holds.sql','utf8');
  const undo = fs.readFileSync('supabase/undo/20261016240000_segE2_hold_lifecycle.undo.sql','utf8');
  assert.ok(undo.includes(original.slice(original.indexOf('CREATE FUNCTION public.segA_hold_lifecycle()'),original.indexOf('CREATE TRIGGER segA_deduction_hold')).replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION')));
  console.log('E2 force flush, repeat no-op, pause failure, worker recovery and hold lifecycle passed');
}
void run().catch(e => { console.error(e); process.exitCode=1; }).finally(() => {loader._load=originalLoad;});

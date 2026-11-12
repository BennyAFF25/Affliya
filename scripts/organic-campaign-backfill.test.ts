/* eslint-disable @typescript-eslint/no-explicit-any -- In-memory Supabase test adapter. */
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { approveOrganicPost } from '../utils/organicCampaignApproval';
import { loadProposalDetails } from '../utils/affiliate/proposalDetails';
import { hasOrganicCampaign } from '../utils/organicCampaignIdentity';
import { backfillPosts, parseBackfillArgs, PRIMARY_POST_IDS, OLDER_POST_IDS } from './backfill-stuck-organic-campaigns';
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error('Network prohibited'); };
let tables: Record<string, any[]>, writes: number, failLink = false, duplicateRace = false;
function reset() {
  writes = 0; failLink = false; duplicateRace = false;
  tables = { organic_posts: [{ id: PRIMARY_POST_IDS[0], campaign_id: 'random-default', status: 'approved', offer_id: 'offer', business_email: 'brand', affiliate_email: 'affiliate', caption: 'Caption' }],
    offers: [{ id: 'offer', business_email: 'brand', site_host: null, meta_pixel_id: null, currency: 'USD' }],
    live_campaigns: [], affiliate_requests: [{ offer_id: 'offer', affiliate_email: 'affiliate', status: 'approved' }],
    business_onboarding_progress: [], campaign_tracking_events: [] };
}
const db = { from(table: string) {
  let rows = tables[table] || [], action = 'select', value: any;
  const run = () => {
    if (action !== 'select') writes++;
    if (action === 'insert') {
      if (table === 'live_campaigns' && duplicateRace) {
        tables[table].push(value); return { error: { code: '23505' }, data: null };
      }
      tables[table].push(value); rows = [value];
    }
    if (action === 'update') {
      if (failLink) return { error: { code: 'fixture' }, data: null };
      rows.forEach(row => Object.assign(row, value));
    }
    return { data: rows, error: null };
  };
  const q: any = { select: () => q, eq: (k: string, v: unknown) => { rows = rows.filter(r => r[k] === v); return q; },
    is: (k: string, v: unknown) => { rows = rows.filter(r => (r[k] ?? null) === v); return q; },
    in: (k: string, vs: unknown[]) => { rows = rows.filter(r => vs.includes(r[k])); return q; }, limit: () => q,
    insert: (v: any) => { value = v; action = 'insert'; return q; }, update: (v: any) => { value = v; action = 'update'; return q; },
    maybeSingle: async () => { const r = run(); return { ...r, data: r.data?.[0] || null }; },
    then: (resolve: any) => Promise.resolve(run()).then(resolve) };
  return q;
} } as unknown as SupabaseClient;
const approve = (dryRun = false) => approveOrganicPost(db, PRIMARY_POST_IDS[0], { dryRun });
async function run() {
  assert.throws(() => parseBackfillArgs([]));
  assert.throws(() => parseBackfillArgs(['--post-ids', OLDER_POST_IDS[0]]));
  assert.equal(parseBackfillArgs(['--post-ids', PRIMARY_POST_IDS.join(',')]).apply, false);
  assert.equal(parseBackfillArgs(['--include-older','--post-ids',OLDER_POST_IDS[0],'--apply']).apply,true);
  reset(); let result = await approve(true);
  assert.equal(result.success, false); if (!result.success) assert.equal(result.error, 'OFFER_TRACKING_NOT_READY'); assert.equal(writes,0);
  for (const readiness of ['site_host','meta_pixel_id','offer_progress','business_progress','test_pixel']) {
    reset();
    if (readiness === 'site_host' || readiness === 'meta_pixel_id') tables.offers[0][readiness] = 'configured';
    if (readiness === 'offer_progress') tables.business_onboarding_progress.push({ offer_id: 'offer', tracking_connected: true });
    if (readiness === 'business_progress') tables.business_onboarding_progress.push({ offer_id: null, business_email: 'brand', tracking_connected: true });
    if (readiness === 'test_pixel') tables.campaign_tracking_events.push({ id: 'test',offer_id: 'offer',event_type: 'test_pixel' });
    const plan = await backfillPosts(db, {ids:[PRIMARY_POST_IDS[0]],apply:false}); assert.equal(plan[0].success,true); assert.equal(writes,0);
    result = await approve(); assert.equal(result.success,true);
    if (result.success) { assert.equal(result.commissionStatus,'blocked_currency'); assert.equal(result.trackingLink,`https://www.nettmark.com/go/${PRIMARY_POST_IDS[0]}`); }
    const details = await loadProposalDetails(db, 'affiliate', 'organic', PRIMARY_POST_IDS[0]);
    assert.equal(details?.trackingUrl, `https://www.nettmark.com/go/${PRIMARY_POST_IDS[0]}`);
    assert.equal(tables.organic_posts[0].campaign_id,PRIMARY_POST_IDS[0]); assert.equal(tables.live_campaigns.length,1);
    assert.equal(hasOrganicCampaign(tables.organic_posts[0],tables.live_campaigns),true);
    assert.equal((await approve()).success,true); assert.equal(tables.live_campaigns.length,1);
  }
  reset(); tables.offers[0].site_host='Custom/Other';
  const applied = await backfillPosts(db, { ids:[PRIMARY_POST_IDS[0]], apply:true });
  assert.equal(applied[0].success,true); assert.equal(tables.live_campaigns.length,1);
  assert.equal((await backfillPosts(db, { ids:[PRIMARY_POST_IDS[0]], apply:true }))[0].success,true);
  assert.equal(tables.live_campaigns.length,1);
  reset(); tables.offers[0].site_host='Custom/Other'; tables.affiliate_requests=[];
  result=await approve(); assert.equal(result.success,false); assert.equal(writes,0);
  reset(); tables.offers[0].site_host='Custom/Other'; duplicateRace=true;
  assert.equal((await approve()).success,true); assert.equal(tables.live_campaigns.length,1);
  reset(); tables.offers[0].site_host='Custom/Other'; failLink=true;
  assert.equal((await approve()).success,false); assert.equal(tables.organic_posts[0].campaign_id,'random-default');
  assert.equal(tables.live_campaigns.length,1); failLink=false;
  assert.equal((await approve()).success,true); assert.equal(tables.live_campaigns.length,1);
  reset(); tables.offers[0].site_host='Custom/Other';
  tables.live_campaigns.push({id:PRIMARY_POST_IDS[0],type:'organic',offer_id:'other',business_email:'brand',affiliate_email:'affiliate'});
  assert.equal((await approve()).success,false); assert.equal(writes,0);
  reset(); tables.offers[0].site_host='Custom/Other';
  tables.live_campaigns.push({id:'legacy',type:'organic',offer_id:'offer',business_email:'brand',affiliate_email:'affiliate'});
  const legacy=await backfillPosts(db,{ids:[PRIMARY_POST_IDS[0]],apply:true}); assert.equal(legacy[0].success,false); assert.equal(writes,0);
  // Legacy approved post: campaign exists for the pair under an unrelated random id -> no duplicate, no writes.
  reset(); tables.offers[0].site_host = 'configured';
  tables.live_campaigns.push({ id: 'legacy-random', type: 'organic', offer_id: 'offer', business_email: 'brand', affiliate_email: 'affiliate' });
  result = await approve();
  assert.equal(result.success, true); if (result.success) { assert.equal(result.campaignId, 'legacy-random'); assert.equal((result as any).action, 'legacy_pair_existing'); }
  assert.equal(writes, 0); assert.equal(tables.live_campaigns.length, 1);
  assert.equal(hasOrganicCampaign(tables.organic_posts[0], tables.live_campaigns), true);
  // A pending post for the same pair still gets its own stable campaign.
  tables.organic_posts[0].status = 'pending';
  assert.equal(hasOrganicCampaign(tables.organic_posts[0], tables.live_campaigns), false);
  result = await approve(); assert.equal(result.success, true);
  if (result.success) assert.equal(result.campaignId, PRIMARY_POST_IDS[0]);
  console.log('Organic campaign/backfill regressions passed');
}
void run().finally(() => { globalThis.fetch=originalFetch; }).catch(e => { console.error(e); process.exitCode=1; });

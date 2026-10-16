import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module from 'node:module';
import { getAffiliateCampaignFundingReadiness } from '../utils/paidCampaignLaunchReadiness';
import { getLaunchWalletAvailable, reserveLaunchHold, releaseLaunchHold } from '../utils/wallet/launchHolds';

async function run() {
  const calls: Array<{ name: string; args: any }> = [];
  let rpcError = false;
  const client = { rpc: async (name: string, args: any) => {
    calls.push({ name, args });
    return { data: name === 'reserve_launch_hold' ? 'hold-id' : 12.53, error: rpcError ? { message: 'insufficient funding' } : null };
  } };
  assert.equal(await getLaunchWalletAvailable(client, 'affiliate@example.test'), 12.53);
  assert.equal(await reserveLaunchHold(client, 'affiliate@example.test', 15, 'idea'), 'hold-id');
  assert.deepEqual(calls[1].args, { p_affiliate_email: 'affiliate@example.test', p_currency: 'AUD', p_amount: 15, p_reference_type: 'ad_ideas', p_reference_id: 'idea' });
  rpcError = true;
  await assert.rejects(reserveLaunchHold(client, 'affiliate@example.test', 15, 'idea'), /insufficient funding/);
  await assert.rejects(getLaunchWalletAvailable(client, 'affiliate@example.test'), /insufficient funding/);
  const savedError = console.error;
  console.error = () => {};
  await releaseLaunchHold(client, 'idea'); // Best effort never masks launch failure.
  console.error = savedError;

  let walletAvailable = 10, reservedSources = 0;
  const readinessClient = { rpc: async (name: string) => ({ data: name === 'get_launch_source_reserved' ? reservedSources : walletAvailable, error: null }) };
  const fundingParams = { supabase: readinessClient, affiliateEmail: 'affiliate@example.test', offerId: 'offer',
    adIdea: { id: 'idea', budget_amount: 2000 },
    currencyReadiness: { allowed: true, campaignCurrency: 'AUD', metaAccountCurrency: 'AUD', reason: null, message: null },
    fundingSources: Promise.resolve({ activationSubsidyAvailable: 5, launchFundAvailable: 5 }) };
  assert.equal((await getAffiliateCampaignFundingReadiness(fundingParams)).ready, true, 'Same AUD wallet plus subsidy and launch fund requirement');
  reservedSources = 5;
  const unavailable = await getAffiliateCampaignFundingReadiness(fundingParams);
  assert.equal(unavailable.ready, false);
  assert.equal(unavailable.deficit, 5, 'Another campaign cannot reuse reserved promotional sources');
  reservedSources = 0; walletAvailable = 0;
  assert.equal((await getAffiliateCampaignFundingReadiness(fundingParams)).deficit, 10, 'Wallet holds reduce readiness without changing ledger display');

  const loader = Module as unknown as { _load: (name: string, parent: unknown, isMain: boolean) => unknown };
  const original = loader._load;
  const originalFetch = global.fetch;
  let currencyAllowed = true, fundingReady = true, reservationFails = false, metaFails = false;
  const events: string[] = [];
  const live = { id: 'live', offer_id: 'offer', ad_idea_id: 'idea', affiliate_email: 'affiliate@example.test', business_email: 'business@example.test', meta_ad_id: 'meta-ad' };
  const db = { from: (table: string) => {
    const query: any = {
      select: () => query, eq: () => query, order: () => query, limit: () => query, update: () => query,
      single: async () => ({ data: table === 'live_ads' ? live : { access_token: 'fixture-token' }, error: null }),
      maybeSingle: async () => ({ data: { id: 'idea', offer_id: 'offer', affiliate_email: live.affiliate_email }, error: null }),
      then: (resolve: any) => Promise.resolve({ error: null }).then(resolve),
    }; return query;
  } };
  loader._load = function(name, parent, isMain) {
    if (name === '@supabase/supabase-js') return { createClient: () => db };
    if (name.includes('moneyFlowAudit')) return { tryWriteMoneyFlowAudit: async () => {} };
    if (name.includes('paidCurrencyGuard')) return { guardPaidCurrency: async () => { events.push('currency'); return { allowed: currencyAllowed, message: 'AUD only' }; } };
    if (name.includes('paidCampaignLaunchReadiness')) return { getAffiliateCampaignFundingReadiness: async () => { events.push('readiness'); return { ready: fundingReady, requiredAmount: 15, deficit: 5 }; } };
    if (name.includes('wallet/launchHolds')) return {
      FUNDING_ERROR: 'AFFILIATE_CAMPAIGN_FUNDING_REQUIRED',
      reserveLaunchHold: async () => { events.push('reserve'); if (reservationFails) throw new Error('Affiliate campaign funding is short by $5.00.'); },
      releaseLaunchHold: async () => { events.push('release'); },
    };
    return original.call(this, name, parent, isMain);
  };
  global.fetch = (async () => { events.push('meta'); return Response.json(metaFails ? { error: 'failed' } : { success: true }, { status: metaFails ? 400 : 200 }); }) as typeof fetch;
  try {
    const { POST } = require('../app/api/meta/control-ad/route');
    const resume = () => POST(new Request('https://nettmark.test/api/meta/control-ad', { method: 'POST', body: JSON.stringify({ liveAdId: 'live', action: 'RESUME' }) }));
    currencyAllowed = false;
    assert.equal((await resume()).status, 409);
    assert.deepEqual(events.splice(0), ['currency']);
    currencyAllowed = true; fundingReady = false;
    assert.equal((await resume()).status, 409);
    assert.deepEqual(events.splice(0), ['currency', 'readiness']);
    fundingReady = true; reservationFails = true;
    assert.equal((await resume()).status, 409);
    assert.deepEqual(events.splice(0), ['currency', 'readiness', 'reserve']);
    reservationFails = false; metaFails = true;
    assert.equal((await resume()).status, 500);
    assert.deepEqual(events.splice(0), ['currency', 'readiness', 'reserve', 'meta', 'release']);
    metaFails = false;
    assert.equal((await resume()).status, 200);
    assert.deepEqual(events.splice(0), ['currency', 'readiness', 'reserve', 'meta']);
  } finally { loader._load = original; global.fetch = originalFetch; }

  const sql = readFileSync('supabase/migrations/20261016190000_segA_atomic_launch_holds.sql','utf8');
  assert.match(sql, /ON CONFLICT \(owner_email, currency\) DO NOTHING/);
  assert.match(sql, /currency = 'AUD' FOR UPDATE/);
  assert.match(sql, /IF existing.status = 'active' THEN[\s\S]*RETURN existing.id/);
  assert.match(sql, /wallet_required > available THEN[\s\S]*RAISE EXCEPTION 'Affiliate campaign funding is short/);
  assert.match(sql, /AFTER INSERT ON public.wallet_deductions/);
  assert.match(sql, /EXCEPTION WHEN OTHERS THEN RAISE WARNING/);
  assert.match(sql, /launch_hold_consumptions VALUES[\s\S]*ON CONFLICT DO NOTHING/);
  assert.match(sql, /coalesce\(launch_wallet_minor,amount_minor\)-amount/);
  assert.match(sql, /NEW.status = 'rejected'/);
  assert.match(sql, /'paused','stopped','archived'/);
  assert.match(sql, /FROM PUBLIC, anon, authenticated/);
  const upload = readFileSync('app/api/meta/callback/upload-video/route.ts','utf8');
  assert.ok(upload.indexOf('await reserveLaunchHold') < upload.indexOf('const createCampaignRes'));
  assert.ok(upload.indexOf('await reserveLaunchHold') < upload.indexOf('// Validate and upload IMAGE'));
  assert.ok(upload.indexOf('launchSucceeded = true') < upload.indexOf('await enqueueAffiliateWebhookEvent'));
  assert.match(upload, /finally \{\s*if \(heldReference && !launchSucceeded\) await releaseLaunchHold/);
  assert.match(readFileSync('utils/paidCampaignLaunchReadiness.ts','utf8'), /getLaunchWalletAvailable\(params.supabase/);
  console.log('Segment A holds: RPC failure handling, resume guard ordering, Meta failure cleanup and SQL lifecycle contracts passed');
}
void run().catch(error => { console.error(error); process.exitCode = 1; });

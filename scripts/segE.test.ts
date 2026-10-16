/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { paidLaunchCurrencies, checkPaidCurrency } from '../utils/currency/paidCurrencyGuard';
import { getAffiliateCampaignFundingReadiness } from '../utils/paidCampaignLaunchReadiness';
import { verifyMetaAccountCurrency } from '../utils/currency/verifyMetaAccountCurrency';
const read = (path: string) => readFileSync(path, 'utf8');
async function run() {
  const originalFlag = process.env.PAID_LAUNCH_CURRENCIES;
  globalThis.fetch = async () => { throw new Error('External calls forbidden in tests'); };
  try {
    process.env.PAID_LAUNCH_CURRENCIES = 'AUD';
    assert.deepEqual(paidLaunchCurrencies(), ['AUD']);
    assert.equal(checkPaidCurrency('USD','USD','USD').allowed,false);
    process.env.PAID_LAUNCH_CURRENCIES = 'AUD,USD,EUR, usd';
    assert.deepEqual(paidLaunchCurrencies(), ['AUD','USD']);
    assert.equal(checkPaidCurrency('USD','USD','USD').allowed,true);
    assert.equal(checkPaidCurrency('USD','USD','AUD').allowed,false);
    assert.equal(checkPaidCurrency('USD','USD',null).allowed,false);
    assert.equal(checkPaidCurrency('GBP','GBP','GBP').allowed,false);
    const rateQuery: any = { select: () => rateQuery, eq: () => rateQuery, lte: () => rateQuery,
      order: () => rateQuery, limit: () => rateQuery,
      then: (resolve: any) => Promise.resolve({ data: [{ rate: 1.5, source: 'frankfurter', rate_date: new Date().toISOString().slice(0,10) }], error: null }).then(resolve) };
    const funding = await getAffiliateCampaignFundingReadiness({
      supabase: { from: () => rateQuery }, affiliateEmail: 'a', offerId: 'offer', adIdea: { budget_amount: 2000 },
      currencyReadiness: checkPaidCurrency('USD','USD','USD'),
      walletSnapshot: Promise.resolve({availableBalance:30}),
      fundingSources: Promise.resolve({activationSubsidyAvailable:0,launchFundAvailable:0,reservationsApplied:true}),
    });
    assert.equal(funding.holdAudEstimate,31.2,'budget × rate × buffer');
    assert.equal(funding.deficit,1.2,'compare AUD funding to AUD hold, not USD budget');
    assert.equal(funding.ready,false);
    let persisted: any = null;
    const query: any = { eq: () => query, then: (resolve: any) => resolve({ error: null }) };
    const supabase = { from: (table: string) => {
      assert.equal(table,'meta_connections');
      return { update: (fields: any) => { persisted=fields; return query; } };
    } };
    const params = { supabase, businessEmail: 'b', pageId: 'p', adAccountId: 'act_123', token: 'mock-token', offerCurrency: 'USD' };
    const mockedFetch: typeof fetch = async (url, options) => {
      assert.equal(String(url),'https://graph.facebook.com/v21.0/act_123?fields=currency');
      assert.equal((options?.headers as any).Authorization,'Bearer mock-token');
      assert.equal(options?.cache,'no-store');
      return Response.json({currency:'USD'});
    };
    assert.equal(await verifyMetaAccountCurrency({ ...params, fetcher: mockedFetch }), 'USD');
    assert.deepEqual(persisted,{ad_account_currency:'USD'});
    persisted=null;
    await assert.rejects(verifyMetaAccountCurrency({ ...params, offerCurrency:'AUD', fetcher:mockedFetch }),/Currency mismatch/);
    assert.equal(persisted,null);
    await assert.rejects(verifyMetaAccountCurrency({ ...params, fetcher: async () => { throw new Error('offline'); } }),/Unable to verify live/);
    await assert.rejects(verifyMetaAccountCurrency({ ...params, fetcher: async () => Response.json({error:{message:'expired'}}, {status:401}) }),/Unable to verify live/);
    const migration = read('supabase/migrations/20261016230000_segE_atomic_settlement.sql');
    assert.match(migration,/SECURITY DEFINER SET search_path = public, pg_temp/);
    assert.match(migration,/FOR UPDATE/);
    assert.match(migration,/round\(unpaid_minor::numeric \*/);
    assert.match(migration,/CASE WHEN pending.unresolved THEN 0/);
    const originalHoldSQL = read('supabase/migrations/20261016190000_segA_atomic_launch_holds.sql');
    const originalFunction = originalHoldSQL.slice(originalHoldSQL.indexOf('CREATE FUNCTION public.launch_wallet_available_minor('),
      originalHoldSQL.indexOf('CREATE FUNCTION public.get_launch_wallet_available')).trim().replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION');
    assert.ok(read('supabase/undo/20261016230000_segE_atomic_settlement.undo.sql').includes(originalFunction),'Undo restores exact previous availability function');
    assert.match(migration,/FROM PUBLIC,anon,authenticated/);
    assert.match(migration,/TO service_role/);
    assert.match(migration,/PERFORM public.consume_launch_hold\(deduction_id\)/);
    assert.ok(!migration.includes('EXCEPTION WHEN OTHERS'), 'canonical writes must roll back');
    assert.ok(!migration.includes('shadow_ledger_sync_source'), 'shadow guard preserved');
    const payout = read('app/api/run-payout/route.ts');
    assert.ok(payout.indexOf('status: "blocked_currency"') < payout.indexOf('const amount ='));
    const conversion = read('app/api/process-conversion/route.ts');
    assert.match(conversion,/recordCurrency\(offer.currency, 'inferred'\)/);
    assert.equal(conversion.match(/status: payoutStatus/g)?.length,2,'one-off/upfront and recurring spread use currency block');
    assert.match(read('app/affiliate/layout.tsx'),/isLoading \|\| !userId/);
    console.log('Segment E flags, mocked live Meta checks, currency persistence, commission and RPC safety contracts passed');
  } finally {
    if (originalFlag === undefined) delete process.env.PAID_LAUNCH_CURRENCIES; else process.env.PAID_LAUNCH_CURRENCIES=originalFlag;
  }
}
void run().catch(error => { console.error(error); process.exitCode=1; });

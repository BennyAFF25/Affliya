/* eslint-disable @typescript-eslint/no-require-imports -- Load modules after installing isolated dependency mocks. */
/* eslint-disable @typescript-eslint/no-explicit-any -- Mocked query chains, no external services. */
import assert from 'node:assert/strict';
import Module from 'node:module';
const loader = Module as any, originalLoad = loader._load;
loader._load = function(name: string, ...args: any[]) {
  if (name.endsWith('offerReadiness')) return { resolveOfferPaidReadiness: async () => ({ resolvedMeta: { pageId: 'p', adAccountId: 'a' } }) };
  return originalLoad.call(this, name, ...args);
};
const { settleAdSpendLedger } = require('../utils/adSpend/settlements');
const { settlementAud } = require('../utils/adSpend/settlementFx');
const { checkPaidCurrency } = require('../utils/currency/paidCurrencyGuard');
let currency = 'USD', stale = false, mismatch = false, funding = 100;
let writes: any[] = [];
const db: any = { from(table: string) {
  let mutation: any;
  const row = () => table === 'live_ads' ? { id: 'ad', ad_idea_id: 'idea', offer_id: 'offer', affiliate_email: 'a', business_email: 'b', spend: 20, spend_transferred: 5 }
    : table === 'offers' ? { currency, business_email: 'b' }
    : table === 'ad_ideas' ? { offer_id: 'offer', currency }
    : table === 'meta_connections' ? { ad_account_currency: mismatch ? 'AUD' : currency }
    : table === 'fx_rates' ? [{ rate: 1.5, source: 'frankfurter', rate_date: stale ? '2020-01-01' : new Date().toISOString().slice(0,10) }]
    : table === 'wallet_topups' ? [{ amount_net: funding, status: 'succeeded' }]
    : table === 'wallet_deductions' || table === 'wallet_refunds' ? [] : null;
  const q: any = { select: () => q, eq: () => q, in: () => q, lte: () => q, order: () => q, limit: () => q,
    update: (values: any) => { mutation = values; writes.push({ table, values }); return q; },
    insert: (values: any) => { mutation = values; writes.push({ table, values }); return q; },
    maybeSingle: async () => ({ data: mutation ? { id: 'settlement' } : row(), error: null }),
    then: (resolve: any, reject: any) => Promise.resolve({ data: mutation ? [{ id: 'ad' }] : row(), error: null }).then(resolve,reject) };
  return q;
} };
async function run() {
  globalThis.fetch = async () => { throw new Error('offline; external calls prohibited'); };
  assert.equal(settlementAud(1,1.005),1.01);
  assert.equal(settlementAud(0.01,1.5),0.02);
  for (currency of ['USD','GBP','CAD','AUD']) {
    writes = [];
    const result = await settleAdSpendLedger({ supabase: db, liveAdId: 'ad' });
    assert.equal(result.chargedAmount, currency === 'AUD' ? 15 : 22.5);
    assert.equal(result.transferredAfter,20);
    for (const table of ['wallet_deductions','ad_spend_settlements']) {
      const payload = writes.find(w => w.table === table).values;
      assert.equal(payload.amount,result.chargedAmount);
      assert.equal(payload.currency,'AUD');
      assert.equal(payload.original_currency,currency === 'AUD' ? undefined : currency);
      assert.equal(payload.original_amount,currency === 'AUD' ? undefined : 15);
    }
    assert.equal(checkPaidCurrency(null,currency,currency).allowed,currency === 'AUD');
  }
  currency = 'USD'; funding = 10; writes = [];
  const partial = await settleAdSpendLedger({ supabase: db, liveAdId: 'ad' });
  assert.equal(partial.chargedAmount,9.99); assert.equal(partial.transferredAfter,11.66);
  for (const reason of ['stale','mismatch','unknown']) {
    stale = reason === 'stale'; mismatch = reason === 'mismatch'; currency = reason === 'unknown' ? '' : 'USD'; writes = [];
    const result = await settleAdSpendLedger({ supabase: db, liveAdId: 'ad' });
    assert.equal(result.error,'FX_SETTLEMENT_DEFERRED'); assert.equal(result.transferredAfter,5);
    assert.equal(result.chargedAmount,0); assert.equal(writes.length,0);
  }
  console.log('Segment D conversion, partial funding, AUD parity, launch containment and deferral passed');
}
void run().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => { loader._load = originalLoad; });

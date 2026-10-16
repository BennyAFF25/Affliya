import assert from 'node:assert/strict';
import Module from 'node:module';
import { readFileSync } from 'node:fs';
import { calculateWalletBalance } from '../utils/wallet/balance';
import { isDefinitiveStripeFailure, refundIdempotencyKey } from '../utils/stripeOperationFailure';

async function run() {
  for (const error of [{ type: 'StripeConnectionError' }, { statusCode: 500 }, new Error('timeout'), { type: 'StripeInvalidRequestError', statusCode: 409 }]) {
    assert.equal(isDefinitiveStripeFailure(error), false);
  }
  assert.equal(isDefinitiveStripeFailure({ type: 'StripeInvalidRequestError', statusCode: 400 }), true);
  assert.equal(refundIdempotencyKey('record'), 'wallet_refund:record');
  assert.equal(calculateWalletBalance({ topups: [{ credited_amount: 10, amount_refunded: 6, status: 'succeeded' }] }).availableBalance, 4);

  const loader = Module as any;
  const original = loader._load;
  let mode = 'success';
  let transfers: any[] = [];
  const rows = [1, 2].map(id => ({ id: String(id), amount: id * 3, business_email: 'b@test', business_id: 'b', live_ad_id: 'ad', settlement_key: String(id) }));
  const writes: any[] = [];
  const stripe = { accounts: { retrieve: async () => ({ capabilities: { transfers: 'active' }, payouts_enabled: true, details_submitted: true }) },
    transfers: { create: async (payload: any, options: any) => {
      transfers.push({ payload, options });
      if (mode === 'timeout') throw { type: 'StripeConnectionError' };
      if (mode === 'rejected') throw { type: 'StripeInvalidRequestError', statusCode: 400 };
      return { id: 'tr_test' };
    } } };
  loader._load = function(name: string, ...args: any[]) {
    if (name === '../stripe') return { createStripeClient: () => stripe, getPlatformBalanceSnapshot: async () => ({ available: 100, pending: 0 }), buildNettmarkStripeMetadata: (_: any, data: any) => data };
    if (name === '../currency/paidCurrencyGuard') return { guardPaidCurrency: async () => ({ allowed: true }) };
    return original.call(this, name, ...args);
  };
  const { processAdSpendTransferBatches } = require('../utils/adSpend/settlements');
  loader._load = original;
  function client() {
    return { from(table: string) {
      let values: any;
      const q: any = {};
      for (const name of ['select','eq','in','lte','limit','order']) q[name] = () => q;
      q.update = (v: any) => { values = v; writes.push(v); return q; };
      const result = () => {
        if (table === 'business_profiles') return { data: { stripe_account_id: 'acct_test' }, error: null };
        if (values?.status === 'transfer_processing') return { data: mode === 'lost' ? [] : [rows[1]], error: null };
        if (values?.status === 'transfer_succeeded' && mode === 'dbfail') return { data: null, error: { message: 'db unavailable' } };
        if (values) return { data: null, error: null };
        return { data: rows, error: null };
      };
      q.maybeSingle = async () => result();
      q.then = (resolve: any, reject: any) => Promise.resolve(result()).then(resolve, reject);
      return q;
    } } as any;
  }
  const log = console.error; console.error = () => {};
  try {
    for (mode of ['success','lost','timeout','rejected','dbfail']) {
      transfers = []; writes.length = 0;
      const result = await processAdSpendTransferBatches({ supabase: client() });
      if (mode === 'lost') { assert.equal(transfers.length, 0); continue; }
      assert.equal(transfers[0].payload.amount, 600, 'Only claimed row contributes, not selected total 900');
      assert.equal(transfers[0].options.idempotencyKey, `ad_spend_transfer_batch:${result.batches[0].batchKey}`);
      if (mode === 'timeout' || mode === 'dbfail') {
        assert.equal(result.batches[0].settlementStatus, 'transfer_processing');
        assert.equal(writes.some(w => w.status === 'transfer_failed'), false, 'Unknown/accepted batch must never requeue');
      }
      if (mode === 'rejected') assert.equal(writes.some(w => w.status === 'transfer_failed'), true);
    }
  } finally { console.error = log; }
  const refund = readFileSync('app/api/stripe/refund/route.ts','utf8');
  assert.equal((refund.match(/idempotencyKey: refundIdempotencyKey\(attemptId\)/g) || []).length, 4);
  assert.ok(refund.indexOf("rpc('claim_wallet_refund'") < refund.indexOf('await createStripeRefund('));
  assert.equal(refund.includes("rpc('record_wallet_refund'"), false, 'No unreserved fallback');
  console.log('Segment B regression checks passed');
}
run().catch(error => { console.error(error); process.exitCode = 1; });

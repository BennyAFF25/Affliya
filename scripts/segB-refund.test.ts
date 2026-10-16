import assert from 'node:assert/strict';
import Module from 'node:module';

async function run() {
  let mode = 'success', stripeId = 'ch_source';
  const calls: Array<{ name: string; args?: any }> = [];
  const db = {
    from() {
      const q: any = {};
      for (const method of ['select','eq','order']) q[method] = () => q;
      q.then = (resolve: any, reject: any) => Promise.resolve({ data: [{ id: 'topup', stripe_id: stripeId, credited_amount: 20, amount_refunded: 0 }], error: null }).then(resolve,reject);
      return q;
    },
    async rpc(name: string, args: any) {
      calls.push({ name, args });
      if (name === 'claim_wallet_refund') return mode === 'claimfail'
        ? { data: null, error: { message: 'insufficient funds' } }
        : { data: { claimed: mode !== 'duplicate', attempt: { id: 'attempt' } }, error: null };
      return { data: { status: args.p_status }, error: mode === 'dbfail' ? { message: 'database down' } : null };
    },
  };
  const loader = Module as any, original = loader._load;
  loader._load = function(name: string, ...args: any[]) {
    if (name === '@/../utils/supabase/server-client') return { __esModule: true, default: db };
    if (name === '@/../utils/moneyFlowAudit') return { tryWriteMoneyFlowAudit: async () => {} };
    if (name === '@/../utils/wallet/refundLock') return { getRefundLockState: async () => ({ locked: false }) };
    if (name === '@/../utils/wallet/balance') return { getWalletBalanceSnapshot: async () => ({ refundableBalance: 20 }) };
    if (name === '@/../utils/wallet/syncAffiliateWalletCache') return { syncAffiliateWalletCache: async () => {} };
    if (name === '@/../utils/stripe') return {
      buildNettmarkStripeMetadata: (_: any, value: any) => value,
      createStripeClient: () => ({
        charges: { list: async () => ({ data: [{ id: 'ch_source' }] }) },
        checkout: { sessions: { retrieve: async () => ({ payment_intent: 'pi_source' }) } },
        refunds: { create: async (payload: any, options: any) => {
          calls.push({ name: 'stripe', args: { payload, options } });
          if (mode === 'timeout') throw { type: 'StripeConnectionError' };
          if (mode === 'reject') throw { type: 'StripeInvalidRequestError', statusCode: 400 };
          return { id: 're_test', currency: 'aud', status: mode === 'pending' ? 'pending' : mode === 'failed' ? 'failed' : 'succeeded' };
        } },
      }),
    };
    return original.call(this,name,...args);
  };
  const { POST } = require('../app/api/stripe/refund/route');
  loader._load = original;
  const log = console.log, error = console.error; console.log = console.error = () => {};
  try {
    for (stripeId of ['ch_source','pi_source','cs_source']) {
      for (mode of ['success','pending','failed','timeout','reject','dbfail','claimfail','duplicate']) {
        calls.length = 0;
        await POST(new Request('http://local/api/stripe/refund', { method: 'POST', body: JSON.stringify({ email: 'a@test', refundAmount: 5 }) }));
        assert.equal(calls[0].name, 'claim_wallet_refund');
        if (mode === 'claimfail' || mode === 'duplicate') { assert.equal(calls.length,1); continue; }
        assert.equal(calls[1].name,'stripe');
        assert.equal(calls[1].args.options.idempotencyKey,'wallet_refund:attempt');
        assert.equal(calls[1].args.payload.amount,500);
        if (mode === 'timeout') assert.equal(calls.length,2, 'Ambiguous refund retains debit');
        else {
          assert.equal(calls[2].name,'finish_wallet_refund');
          assert.equal(calls[2].args.p_status, mode === 'reject' || mode === 'failed' ? 'failed' : mode === 'pending' ? 'pending' : 'succeeded');
          if (mode === 'dbfail') assert.equal(calls.length,3,'Post-Stripe failure must not release');
        }
      }
    }
  } finally { console.log = log; console.error = error; }
  console.log('Segment B refund route mocked tests passed');
}
run().catch(error => { console.error(error); process.exitCode=1; });

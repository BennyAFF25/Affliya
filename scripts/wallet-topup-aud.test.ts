/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import fs from 'node:fs';
const requireMocked = createRequire(__filename);
const loader = Module as unknown as { _load: (...args: any[]) => any };
const original = loader._load;
const originalFetch = globalThis.fetch;
let session: any;
let balanceTx: any;
let credits: any[] = [];
const created: any[] = [];
let flags: any[] = [];
let rpcResult: any = { data: { credited: true }, error: null };
let inserts: any[] = [];
let auditFailure = false;
const db = {
  auth: { getUser: async () => ({ data: { user: { id: 'user', email: 'test@example.invalid' } } }) },
  rpc: async (_name: string, payload: any) => { credits.push(payload); return rpcResult; },
  from: (table: string) => {
    const q: any = { select: () => q, eq: () => q,
      maybeSingle: async () => ({ data: table === 'affiliate_profiles' ? { stripe_account_id: 'acct_mock', stripe_onboarding_complete: true } : null }),
      insert: async (payload: any) => { inserts.push({ table, payload }); if (auditFailure && table === 'money_flow_audit_log') throw Error('mock audit failure'); return { error: null }; },
      upsert: async () => ({ error: null }) };
    return q;
  },
};
const stripe = {
  accounts: { retrieve: async () => ({ id: 'acct_mock' }) },
  checkout: { sessions: {
    create: async (params: any) => { created.push(params); return { id: 'cs_mock', url: 'https://checkout.invalid' }; },
    retrieve: async () => session,
  } },
  paymentIntents: { retrieve: async () => ({ latest_charge: { balance_transaction: balanceTx } }) },
  webhooks: { constructEvent: () => ({ type: 'checkout.session.completed', data: { object: session } }) },
};
loader._load = function(name, parent, isMain) {
  if (name === '@supabase/supabase-js') return { createClient: () => db };
  if (name === '@supabase/auth-helpers-nextjs') return { createRouteHandlerClient: () => db };
  if (name === 'next/headers') return { cookies: () => ({}) };
  if (name.includes('wallet/syncAffiliateWalletCache')) return { syncAffiliateWalletCache: async () => ({ availableBalance: 10 }) };
  if (name.endsWith('/utils/stripe')) return { createStripeClient: () => stripe,
    buildNettmarkStripeMetadata: (action: string, values: any) => Object.fromEntries(Object.entries({ nettmark_platform: 'nettmark', nettmark_action: action, ...values }).map(([k,v]) => [k,String(v)])) };
  return original.call(this, name, parent, isMain);
};
globalThis.fetch = async () => { throw Error('Network forbidden'); };
const originalError = console.error;
console.error = (...args) => { flags.push(args); };
function reset() {
  session = { id: 'cs_mock', currency: 'aud', amount_total: 1071, payment_status: 'paid', payment_intent: 'pi_mock', customer_email: 'test@example.invalid',
    metadata: { nettmark_action: 'wallet_topup', currency: 'aud', topup_amount: '10', gross_charge_amount: '10.71', nettmark_fee_amount: '0.22' } };
  balanceTx = { currency: 'aud', amount: 1071, fee: 49, net: 1022 };
  credits = []; flags = []; inserts = []; auditFailure = false; rpcResult = { data: { credited: true }, error: null };
}
async function main() {
  process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock';
  const create = requireMocked('../app/api/stripe/create-topup-session/route');
  const webhook = requireMocked('../app/api/stripe/webhook/route');
  const reconcile = requireMocked('../app/api/stripe/reconcile-topup/route');
  const request = (body: any) => new Request('http://localhost/mock', { method: 'POST', body: JSON.stringify(body) });
  for (const amount of [9.99, 0, -1]) {
    const response = await create.POST(request({ amount }));
    assert.equal(response.status, 400);
  }
  assert.equal(created.length, 0);
  assert.match((await (await create.POST(request({ amount: 9.99 }))).json()).error, /A\$10.00/);
  for (const currency of ['usd', 'gbp', null]) {
    assert.equal((await create.POST(request({ amount: 10, currency }))).status, 200);
    const params = created.at(-1);
    assert.equal(params.line_items[0].price_data.currency, 'aud');
    assert.deepEqual(params.adaptive_pricing, { enabled: false });
    assert.equal(params.metadata.currency, 'aud');
    assert.equal(params.payment_intent_data.metadata.currency, 'aud');
    assert.equal(params.metadata.topup_amount, '10');
  }
  for (const route of [webhook, reconcile]) {
    for (const fallback of [false, true]) {
      reset();
      if (fallback) rpcResult = { error: { code: 'PGRST202' } };
      const response = await route.POST(request({ session_id: session.id }));
      assert.equal(response.status, 200);
      assert.equal(credits[0].p_credited_amount, 10);
      assert.equal(credits[0].p_amount_net, 10);
      if (fallback) assert.equal(inserts.find(x => x.table === 'wallet_topups').payload.credited_amount, 10);
      assert.equal(flags.length, 0);
    }
    reset();
    rpcResult = { data: { credited: false }, error: null };
    assert.equal((await route.POST(request({ session_id: session.id }))).status, 200);
    assert.equal(inserts.length, 0, 'Duplicate RPC result does not insert top-ups');
    reset(); session.currency = 'usd'; auditFailure = true;
    assert.equal((await route.POST(request({ session_id: session.id }))).status, 200);
    assert.equal(credits.length, 0, 'Audit failure must not credit or cause endless retries');
    for (const mutate of [
      () => { session.currency = 'usd'; },
      () => { balanceTx.currency = 'usd'; },
      () => { session.amount_total = 1070; },
      () => { balanceTx.amount = 1070; },
      () => { delete session.metadata.topup_amount; },
      () => { session.metadata.topup_amount = 'NaN'; },
      () => { delete session.metadata.gross_charge_amount; },
      () => { session.metadata.currency = 'usd'; },
    ]) {
      reset(); mutate();
      assert.equal((await route.POST(request({ session_id: session.id }))).status, 200);
      assert.equal(credits.length, 0);
      assert.equal(inserts.filter(x => x.table !== 'money_flow_audit_log').length, 0);
      assert.equal(inserts.find(x => x.table === 'money_flow_audit_log').payload.event_type, 'wallet_topup_manual_review');
      assert.ok(flags.some(x => String(x[0]).includes('manual review')));
    }
  }
  const ui = fs.readFileSync('app/affiliate/wallet/page.tsx', 'utf8');
  assert.match(ui, /amountInDollars < MIN_WALLET_TOPUP_AUD/);
  assert.doesNotMatch(ui, /alert\(WALLET_TOPUP_MINIMUM_MESSAGE\)/);
  assert.match(ui, /if \(!Number.isFinite\(amountInDollars\) \|\| amountInDollars < MIN_WALLET_TOPUP_AUD\) \{\s*setTopupMinimumError\(true\);\s*return;/);
  assert.match(ui, /aria-describedby="wallet-topup-minimum" aria-invalid=\{topupMinimumError\}/);
  assert.match(ui, /id="wallet-topup-minimum" role=\{topupMinimumError \? "alert" : undefined\}/);
  assert.match(ui, /setTopupMinimumError\(!Number.isFinite\(parseFloat\(value\)\) \|\| parseFloat\(value\) < MIN_WALLET_TOPUP_AUD\)/);
  console.log('AUD top-up: mocked creation, minimum, both credit routes/RPC/fallback, review guards passed.');
}
void main().catch(error => { originalError(error); process.exitCode = 1; }).finally(() => {
  loader._load = original; globalThis.fetch = originalFetch; console.error = originalError;
});

/* eslint-disable @typescript-eslint/no-explicit-any -- Offline route fixtures model SDK query builders. */
import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { calculateBusinessPayoutCharge, calculateWalletTopupCharge, resolveBusinessFeeBps } from '../utils/feeAccounting';
import { aggregateFees } from '../utils/marketing/reporting';

async function run() {
  for (const flag of [undefined, 'false', 'TRUE', ' true', 'true ']) {
    assert.deepEqual(calculateBusinessPayoutCharge(100, { billingProvider: 'shopify' }, { SHOPIFY_BILLED_PLATFORM_FEE_ENABLED: flag }),
      { principalAmount: 100, feeBps: 0, feeAmount: 0, grossAmount: 100 });
  }
  assert.equal(resolveBusinessFeeBps('shopify', { SHOPIFY_BILLED_PLATFORM_FEE_ENABLED: 'true' }), 220);
  assert.equal(resolveBusinessFeeBps('stripe', {}), 220);
  assert.equal(resolveBusinessFeeBps('stripe', { NETTMARK_TRANSACTION_FEE_BPS: '350' }), 350);
  assert.equal(calculateBusinessPayoutCharge(100, { billingProvider: 'shopify' }, { SHOPIFY_BILLED_PLATFORM_FEE_ENABLED: 'true', NETTMARK_TRANSACTION_FEE_BPS: '350' }).grossAmount, 103.5);

  const savedEnv = { ...process.env };
  const loader = Module as unknown as { _load: (...args: any[]) => any };
  const original = loader._load;
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  let provider: string | null = 'shopify', providerError = false, snapshotError = false, transferError = false, loseResponse = false;
  let payout: any, intent: any;
  let creates: any[] = [], transfers: any[] = [], ledger: any[] = [], providerFilters: any[] = [];
  const db = { from(table: string) {
    let values: any;
    const filters: Array<[string, any]> = [], nulls: string[] = [];
    const result = () => {
      if (table === 'business_entitlements') { providerFilters.push(filters); return { data: provider ? { billing_provider: provider } : null, error: providerError ? { message: 'offline lookup failure' } : null }; }
      if (table === 'wallet_payouts' && values) {
        if (snapshotError && nulls.length) return { error: { message: 'snapshot unavailable' } };
        if (nulls.every(key => payout[key] == null)) Object.assign(payout, values);
      }
      return { data: table === 'wallet_payouts' ? { ...payout } : table === 'offers' ? { currency: 'AUD' } :
        table === 'business_profiles' ? { id: 'business', stripe_customer_id: 'cus_fixture' } :
        table === 'affiliate_profiles' ? { user_id: 'affiliate', stripe_account_id: 'acct_fixture' } : null, error: null };
    };
    const q: any = { select: () => q, limit: () => q, eq: (k: string, v: any) => { filters.push([k, v]); return q; },
      is: (k: string) => { nulls.push(k); return q; }, update: (v: any) => { values = v; return q; },
      maybeSingle: async () => result(), single: async () => result(), then: (resolve: any) => Promise.resolve(result()).then(resolve),
      upsert: async (v: any) => { ledger.push(v); return { error: null }; }, insert: async () => ({ error: null }) };
    return q;
  } };
  const stripe = {
    accounts: { retrieve: async () => ({ capabilities: { transfers: 'active' } }) },
    paymentMethods: { list: async () => ({ data: [{ id: 'pm_fixture' }] }) },
    paymentIntents: {
      retrieve: async () => intent,
      create: async (params: any, options: any) => {
        const previous = creates[0];
        if (previous) assert.deepEqual({ params, options }, previous, 'retry must use identical Stripe idempotency parameters after provider/flag changes');
        creates.push({ params, options });
        intent = { id: 'pi_fixture', status: 'succeeded', amount: params.amount, metadata: params.metadata, latest_charge: null };
        if (loseResponse) { loseResponse = false; throw Error('lost Stripe response'); }
        return intent;
      },
    },
    transfers: { create: async (params: any) => { transfers.push(params); if (transferError) throw Error('transfer failed'); return { id: 'tr_fixture' }; } },
  };
  loader._load = function(name, parent, isMain) {
    if (name.includes('supabase/pages-client')) return { supabase: db };
    if (name === '@supabase/supabase-js') return { createClient: () => db };
    if (name.endsWith('/utils/criticalRouteAuthServer')) return { protectCriticalRoute: (_kind: string, handler: any) => handler };
    if (name.endsWith('/utils/stripe')) return { createStripeClient: () => stripe, buildNettmarkStripeMetadata: (_action: string, values: any) => values };
    return original.call(this, name, parent, isMain);
  };
  globalThis.fetch = async () => { throw Error('network forbidden'); };
  console.error = () => {};
  process.env.STRIPE_SECRET_KEY = 'offline-fixture';
  delete process.env.NETTMARK_TRANSACTION_FEE_BPS;
  delete process.env.SHOPIFY_BILLED_PLATFORM_FEE_ENABLED;
  const reset = () => {
    payout = { id: 'payout', business_id: 'business', business_email: 'brand@fixture.invalid', affiliate_email: 'affiliate@fixture.invalid', offer_id: 'offer', amount: 100, status: 'pending', available_at: '2020-01-01', gross_charge_amount: null, nettmark_fee_amount: null };
    intent = null; creates = []; transfers = []; ledger = []; providerFilters = [];
    provider = 'shopify'; providerError = snapshotError = transferError = loseResponse = false;
    delete process.env.SHOPIFY_BILLED_PLATFORM_FEE_ENABLED;
    delete process.env.NETTMARK_TRANSACTION_FEE_BPS;
  };
  try {
    const route = createRequire(__filename)('../app/api/run-payout/route');
    const request = () => route.POST(new Request('http://offline.invalid/api/run-payout', { method: 'POST', body: JSON.stringify({ payout_id: 'payout' }) }));
    for (const [billing, flag, bps, expected] of [
      ['shopify', undefined, undefined, 100], ['stripe', undefined, undefined, 102.2],
      ['shopify', 'true', undefined, 102.2], ['stripe', undefined, '350', 103.5], [null, undefined, undefined, 102.2],
    ] as const) {
      reset(); provider = billing;
      if (flag) process.env.SHOPIFY_BILLED_PLATFORM_FEE_ENABLED = flag;
      if (bps) process.env.NETTMARK_TRANSACTION_FEE_BPS = bps;
      assert.equal((await request()).status, 200);
      assert.equal(creates[0].params.amount, Math.round(expected * 100));
      assert.equal(creates[0].params.metadata.nettmark_fee_amount, Math.round((expected - 100) * 100) / 100);
      assert.equal(payout.gross_charge_amount, expected);
      assert.equal(transfers[0].amount, 10000);
      assert.equal(ledger.length, expected === 100 ? 0 : 2);
      for (const row of ledger) {
        assert.equal(row.amount, payout.nettmark_fee_amount);
        assert.equal(row.gross_amount, expected);
      }
      assert.equal(aggregateFees(ledger.slice(-1)).total, payout.nettmark_fee_amount);
      assert.deepEqual(providerFilters[0], [['business_id', 'business']]);
    }
    reset(); providerError = true;
    assert.equal((await request()).status, 500); assert.equal(creates.length, 0); assert.equal(transfers.length, 0);
    reset(); snapshotError = true;
    assert.equal((await request()).status, 500); assert.equal(creates.length, 0);
    // A charged payout keeps its original fee even when provider and flag change.
    for (const initialProvider of ['shopify', 'stripe']) {
      reset(); provider = initialProvider; transferError = true;
      assert.equal((await request()).status, 409);
      const originalGross = payout.gross_charge_amount;
      provider = initialProvider === 'shopify' ? 'stripe' : 'shopify';
      process.env.SHOPIFY_BILLED_PLATFORM_FEE_ENABLED = 'true';
      transferError = false;
      assert.equal((await request()).status, 200);
      assert.equal(creates.length, 1); assert.equal(payout.gross_charge_amount, originalGross);
      if (originalGross === 100) assert.equal(ledger.length, 0);
      else assert.equal(ledger.at(-1).gross_amount, originalGross);
    }
    reset();
    const concurrent = await Promise.all([request(), request()]);
    assert.ok(concurrent.every(response => response.status === 200));
    assert.equal(payout.gross_charge_amount, 100);
    assert.ok(creates.every(call => call.params.amount === 10000));
    reset(); payout.gross_charge_amount = 102.2; payout.nettmark_fee_amount = 2.2;
    assert.equal((await request()).status, 200);
    assert.equal(creates[0].params.amount, 10220, 'existing snapshot wins over current Shopify waiver');
    reset(); payout.gross_charge_amount = 99; payout.nettmark_fee_amount = -1;
    assert.equal((await request()).status, 500); assert.equal(creates.length, 0);
    reset(); loseResponse = true;
    assert.equal((await request()).status, 500);
    assert.equal(payout.stripe_payment_intent_id, undefined);
    provider = 'stripe'; process.env.SHOPIFY_BILLED_PLATFORM_FEE_ENABLED = 'true';
    assert.equal((await request()).status, 200);
    assert.equal(creates.length, 2); assert.equal(payout.gross_charge_amount, 100);
    reset(); provider = 'shopify';
    payout.stripe_payment_intent_id = 'pi_existing';
    intent = { id: 'pi_existing', amount: 10220, status: 'succeeded', latest_charge: null };
    assert.equal((await request()).status, 200);
    assert.equal(creates.length, 0); assert.equal(payout.nettmark_fee_amount, 2.2);
    assert.equal(calculateWalletTopupCharge(100).feeAmount, 2.2, 'affiliate top-up fee is unchanged');
    const ui = fs.readFileSync('app/business/payouts/page.tsx', 'utf8');
    assert.doesNotMatch(ui, /principal \* 0\.022/);
    assert.match(ui, /r\.nettmark_fee_amount != null/);
    assert.match(ui, /nettmarkFee > 0 \? \(\s*<div>Nettmark fee:/);
    assert.match(ui, /setBusinessPayoutFeeBps\(summary.businessPayoutFeeBps\)/);
    // Render the actual table with an isolated export; production page exports stay unchanged.
    const uiPath = path.resolve('app/business/payouts/page.tsx');
    const fixtureModule: any = new Module(uiPath);
    fixtureModule.filename = uiPath;
    fixtureModule.paths = (Module as any)._nodeModulePaths(path.dirname(uiPath));
    fixtureModule._compile(ts.transpileModule(ui + '\nexport { Table };', {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText, uiPath);
    const render = (feeBps: number | null, row: any) => renderToStaticMarkup(React.createElement(fixtureModule.exports.Table, {
      rows: [{ ...payout, ...row }], offersById: {}, affiliateStripeByEmail: {},
      currencyFmt: new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }), businessPayoutFeeBps: feeBps,
    }));
    assert.doesNotMatch(render(0, { nettmark_fee_amount: null, gross_charge_amount: null }), /Nettmark fee:/);
    assert.match(render(0, { nettmark_fee_amount: null, gross_charge_amount: null }), /Business charged:.*100\.00/);
    assert.doesNotMatch(render(220, { nettmark_fee_amount: 0, gross_charge_amount: 100 }), /Nettmark fee:/);
    assert.doesNotMatch(render(220, { nettmark_fee_amount: null, gross_charge_amount: 100 }), /Nettmark fee:/);
    assert.match(render(0, { nettmark_fee_amount: 2.2, gross_charge_amount: 102.2 }), /Nettmark fee:.*2\.20/);
    assert.match(render(null, { nettmark_fee_amount: null, gross_charge_amount: null }), /Fee estimate unavailable/);
    console.log('Shopify payout fee waiver tests passed');
  } finally {
    loader._load = original; globalThis.fetch = originalFetch; console.error = originalError;
    process.env = savedEnv;
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });

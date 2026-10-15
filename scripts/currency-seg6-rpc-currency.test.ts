/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { recordCurrency } from '../utils/currency/recordCurrency';

function extracted(file: string, name: string, context: Record<string, any>) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  let found: ts.FunctionDeclaration | undefined;
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node;
    ts.forEachChild(node, visit);
  }
  visit(source); assert.ok(found);
  const js = ts.transpileModule(`${found.getText(source)}\nreturn ${name};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return new Function(...Object.keys(context), js)(...Object.values(context));
}
const migration = fs.readFileSync('supabase/migrations/20261015140000_currency_seg6_rpc_currency.sql', 'utf8');
const undo = fs.readFileSync('supabase/undo/20261015140000_currency_seg6_rpc_currency.undo.sql', 'utf8');
const validation = `  -- Currency metadata only; preserve all money and replay semantics below.
  IF p_currency IS NOT NULL AND p_currency !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'Invalid currency format' USING ERRCODE = '22023';
  END IF;
  IF p_currency IS NULL THEN
    p_currency_source := 'unresolved';
  ELSIF p_currency_source IS NULL OR p_currency_source NOT IN ('verified', 'inferred', 'unresolved') THEN
    RAISE EXCEPTION 'Invalid currency source' USING ERRCODE = '22023';
  END IF;
`;
const functions = [...migration.matchAll(/CREATE FUNCTION[\s\S]*?\$function\$\n;/g)].map(m => m[0]);
assert.equal(functions.length, 2);
const signatures = ['text,text,numeric,numeric,numeric,text,numeric,numeric,text,text', 'text,uuid,text,text,numeric,text,text,text'];
for (const [i, name] of ['credit_wallet_topup', 'record_wallet_refund'].entries()) {
  const live = fs.readFileSync(`/workspace/db-backups/20261015-213053-seg6/${i + 1}.sql`, 'utf8');
  const added = functions[i];
  assert.ok(added.includes(validation));
  assert.equal(added.split(validation).length, 2);
  const restored = added.replace(`CREATE FUNCTION public.${name}_with_currency`, `CREATE OR REPLACE FUNCTION public.${name}`)
    .replace(', p_currency text DEFAULT NULL::text, p_currency_source text DEFAULT NULL::text)', ')')
    .replace(validation, '').replace('    currency, currency_source,\n', '').replace('    p_currency, p_currency_source,\n', '');
  assert.equal(restored, live.slice(live.indexOf('CREATE OR REPLACE')).trim(), 'Exact live definition restored after currency-only additions');
  const sig = `public.${name}_with_currency(${signatures[i]})`;
  assert.ok(migration.includes(`REVOKE ALL ON FUNCTION ${sig} FROM PUBLIC, anon, authenticated;`));
  assert.ok(migration.includes(`GRANT EXECUTE ON FUNCTION ${sig} TO service_role;`));
}
assert.equal(undo, `BEGIN;\nDROP FUNCTION IF EXISTS public.credit_wallet_topup_with_currency(${signatures[0]});\nDROP FUNCTION IF EXISTS public.record_wallet_refund_with_currency(${signatures[1]});\nCOMMIT;\n`);
assert.ok(migration.startsWith('-- Additive copies of authoritative live exports; originals untouched.\nBEGIN;'));
assert.ok(migration.endsWith('COMMIT;\n'));
assert.doesNotMatch(migration, /CREATE OR REPLACE|DROP FUNCTION|ALTER FUNCTION/);

async function main() {
  for (const route of ['webhook', 'reconcile-topup', 'refund']) {
    const refund = route === 'refund';
    const name = refund ? 'record_wallet_refund' : 'credit_wallet_topup';
    const params = refund ? {
      email: 'a@test', topup: { id: 'topup', amount_net: 100, amount_refunded: 0 }, refundAmount: 10,
      stripeRefundId: 're_1', stripeChargeId: 'ch_1', stripeStatus: 'succeeded', currency: 'aud',
    } : { email: 'a@test', checkoutSessionId: 'cs_1', grossAmount: 104, fees: 2, creditedAmount: 100, nettmarkFeeAmount: 2, platformAcctId: 'acct_1', currency: 'aud' };
    const oldPayload = refund ? { p_affiliate_email: 'a@test', p_source_topup_id: 'topup', p_stripe_refund_id: 're_1', p_stripe_charge_id: 'ch_1', p_amount: 10, p_status: 'succeeded' } : {
      p_affiliate_email: 'a@test', p_checkout_session_id: 'cs_1', p_amount_gross: 104, p_stripe_fees: 2, p_amount_net: 100, p_platform_acct_id: 'acct_1', p_nettmark_fee_amount: 2, p_credited_amount: 100,
    };
    for (const code of [null, 'PGRST202', '42883', '23514', '42501', 'PGRST204', 'XX000', 'NETWORK']) {
      const calls: any[] = [];
      const db = {
        rpc: async (rpc: string, payload: any) => {
          calls.push({ rpc, payload });
          return { data: { credited: true, success: true, idempotent: false }, error: calls.length === 1 && code ? { code, message: 'ambiguous failure' } : null };
        },
        from: () => { throw Error('Unexpected direct write/backfill'); },
      };
      const context = { supabase: db, recordCurrency,
        isRpcMissing: (e: any) => e?.code === 'PGRST202',
        recordPlatformFeeLedger: async () => {}, syncAffiliateWalletCache: async () => ({ availableBalance: 100 }) };
      const fn = extracted(`app/api/stripe/${route}/route.ts`, refund ? 'recordWalletRefund' : 'creditWalletTopup', context);
      const missing = code === 'PGRST202' || code === '42883';
      if (code && !missing) await assert.rejects(fn(params));
      else await fn(params);
      assert.deepEqual(calls[0], { rpc: `${name}_with_currency`, payload: { ...oldPayload, p_currency: 'AUD', p_currency_source: 'verified' } });
      assert.equal(calls.length, missing ? 2 : 1, 'No second money write on ambiguous/nonmissing error');
      if (missing) assert.deepEqual(calls[1], { rpc: name, payload: oldPayload });
    }
    // If the old RPC fails after a missing-new-function response, preserve
    // its error path; never continue into direct bookkeeping on other errors.
    const callsAfterMissing: string[] = [];
    const failOld = extracted(`app/api/stripe/${route}/route.ts`, refund ? 'recordWalletRefund' : 'creditWalletTopup', {
      recordCurrency, isRpcMissing: (e: any) => e?.code === 'PGRST202',
      supabase: {
        rpc: async (rpc: string) => {
          callsAfterMissing.push(rpc);
          return { error: { code: callsAfterMissing.length === 1 ? 'PGRST202' : 'XX000', message: 'lost commit response' } };
        },
        from: () => { throw Error('Unexpected third write'); },
      },
    });
    await assert.rejects(failOld(params));
    assert.deepEqual(callsAfterMissing, [`${name}_with_currency`, name]);
    for (const currency of [null, 'malformed']) {
      const fn = extracted(`app/api/stripe/${route}/route.ts`, refund ? 'recordWalletRefund' : 'creditWalletTopup', {
        recordCurrency,
        supabase: { rpc: async (_: string, payload: any) => {
          assert.equal(payload.p_currency, null);
          assert.equal(payload.p_currency_source, 'unresolved');
          return { data: { credited: false, success: true, idempotent: true }, error: null };
        }, from: () => { throw Error('Unexpected replay backfill'); } },
        recordPlatformFeeLedger: async () => {}, syncAffiliateWalletCache: async () => ({}),
      });
      await fn({ ...params, currency });
    }
    // A rejected transport promise must also never trigger fallback.
    let attempts = 0;
    const fn = extracted(`app/api/stripe/${route}/route.ts`, refund ? 'recordWalletRefund' : 'creditWalletTopup', {
      recordCurrency, supabase: { rpc: async () => { attempts++; throw Error('lost response'); } },
    });
    await assert.rejects(fn(params), /lost response/); assert.equal(attempts, 1);
  }
  console.log('Currency Segment 6: PASS (live SQL equality, restricted grants/undo, mocked routes and safe fallback)');
}
main().catch(e => { console.error(e); process.exitCode = 1; });

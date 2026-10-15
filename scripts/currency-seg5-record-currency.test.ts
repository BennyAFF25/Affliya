/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { recordCurrency, recordCampaignCurrency, recordNewRowCurrency, withRecordedCurrency } from '../utils/currency/recordCurrency';

// Evaluate actual private write functions without importing route modules (which
// initialize Stripe/Supabase). All I/O below is supplied by these mocks.
function extracted(file: string, name: string, context: Record<string, any>) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  let found: ts.Node | undefined;
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(found, `${file}: ${name}`);
  const js = ts.transpileModule(`${found!.getText(source).replace(/^export /, '')}\nreturn ${name};`, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  return new Function(...Object.keys(context), js)(...Object.values(context));
}
function writeStatement(file: string, name: string, context: Record<string, any>) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  let found: ts.VariableStatement | undefined;
  function visit(node: ts.Node) {
    if (ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.name.getText(source).includes(name))) found = node;
    ts.forEachChild(node, visit);
  }
  visit(source); assert.ok(found, name);
  const js = ts.transpileModule(found!.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return new Function(...Object.keys(context), `return (async () => { ${js} })();`)(...Object.values(context));
}
const helpers = { recordCurrency, recordCampaignCurrency, recordNewRowCurrency, withRecordedCurrency };
const clean = (value: any): any => Array.isArray(value) ? value.map(clean) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'currency' && key !== 'currency_source').map(([k,v]) => [k, clean(v)])) : value;
function mockDB(rpcResult: any = { error: { code: 'PGRST202' } }, dataFor?: (table: string, kind: string, values: any) => any) {
  const writes: any[] = [], calls: any[] = [];
  let rejectMetadata = false;
  const db: any = {
    writes, calls,
    set rejectMetadata(value: boolean) { rejectMetadata = value; },
    rpc: async (name: string, payload: any) => { calls.push({ name, payload }); return rpcResult; },
    from(table: string) {
      let values: any, kind: string;
      const filters: any[] = [];
      const result = () => {
        if (kind) writes.push({ table, kind, values, filters });
        return { data: dataFor ? dataFor(table,kind,values) : kind === 'insert' ? { id: 'new-row' } : null,
          error: rejectMetadata && (Array.isArray(values) ? values[0]?.currency_source : values?.currency_source) ? { code: '23514', message: `${table}_currency_format_chk` } : null };
      };
      const q: any = {
        insert: (v: any) => { values = v; kind = 'insert'; return q; },
        upsert: () => Promise.resolve({ error:null }),
        update: (v: any) => { values = v; kind = 'update'; return q; },
        select: () => q, limit: () => q, order: () => q,
        eq: (k: string,v: any) => { filters.push(['eq',k,v]); return q; },
        is: (k: string,v: any) => { filters.push(['is',k,v]); return q; },
        maybeSingle: async () => result(), single: async () => result(),
        then: (resolve: any, reject: any) => Promise.resolve(result()).then(resolve,reject),
      }; return q;
    },
  }; return db;
}
async function main() {
  process.env.TZ = 'UTC';
  const warnings: any[] = [];
  const warn = console.warn;
  console.warn = (...args: any[]) => { warnings.push(args); };
  const fetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('External I/O forbidden'); };
  try {
    assert.deepEqual(recordCurrency(' usd ', 'verified'), { currency: 'USD', currency_source: 'verified' });
    assert.deepEqual(recordCurrency('XYZ', 'verified'), { currency: 'XYZ', currency_source: 'verified' });
    assert.deepEqual(recordCurrency('XYZ', 'inferred'), { currency: 'XYZ', currency_source: 'inferred' });
    for (const value of [null, undefined, 123, {}, 'A$', 'USDD', '', 'ÅUD']) {
      assert.deepEqual(recordCurrency(value, 'verified'), { currency: null, currency_source: 'unresolved' });
    }
    assert.deepEqual(recordCampaignCurrency({ metaAccountCurrency: 'USD', campaignCurrency: 'AUD' }), recordCurrency('USD','verified'));
    assert.deepEqual(recordCampaignCurrency({ metaAccountCurrency: '', campaignCurrency: 'GBP' }), recordCurrency('GBP','inferred'));

    const db = mockDB();
    await recordNewRowCurrency(db, 'wallet_refunds', 'fresh', recordCurrency('aud', 'verified'));
    assert.deepEqual(db.writes[0].filters, [['eq','id','fresh'],['is','currency',null]]);
    await recordNewRowCurrency(db, 'wallet_refunds', undefined, recordCurrency('aud','verified'));
    assert.equal(db.writes.length, 1);
    for (const fail of ['return', 'throw']) {
      const failing = { from: () => { if (fail === 'throw') throw Error('offline'); return { update: () => ({ eq: () => ({ is: async () => ({ error: Error('rejected') }) }) }) }; } };
      const count = warnings.length;
      await recordNewRowCurrency(failing, 'wallet_refunds','fresh',recordCurrency('AUD','verified'));
      assert.equal(warnings.length, count + 1);
    }
    let metadataAttempts = 0;
    const recovered = await withRecordedCurrency(recordCurrency('AUD','verified'), async fields => {
      metadataAttempts++;
      if (fields.currency_source) throw {code:'PGRST204',message:'currency column missing'};
      return {error:null};
    });
    assert.equal(recovered.error,null);
    assert.equal(metadataAttempts,2);
    let attempts = 0;
    const unrelated = { code: '23505', message: 'duplicate money row' };
    assert.equal((await withRecordedCurrency(recordCurrency('AUD','verified'), async () => { attempts++; return { error: unrelated }; })).error, unrelated);
    assert.equal(attempts,1);
    await assert.rejects(withRecordedCurrency(recordCurrency('AUD','verified'), async () => { throw Error('lost response'); }), /lost response/);

    const base = { email: 'affiliate@test', checkoutSessionId: 'cs_new', grossAmount: 103.55, fees: 1.35, creditedAmount: 100, nettmarkFeeAmount: 2.2, platformAcctId: 'acct_platform' };
    const expectedTopup = { affiliate_email: base.email, amount_gross: 103.55, stripe_fees: 1.35, amount_net: 100, credited_amount: 100, nettmark_fee_amount: 2.2, stripe_id: 'cs_new', status: 'succeeded', platform_acct_id: 'acct_platform' };
    for (const file of ['app/api/stripe/webhook/route.ts','app/api/stripe/reconcile-topup/route.ts']) {
      for (const rejected of [false,true]) {
        const mock = mockDB(); mock.rejectMetadata = rejected;
        const credit = extracted(file, 'creditWalletTopup', { ...helpers, supabase: mock, recordPlatformFeeLedger: async () => {}, syncAffiliateWalletCache: async () => ({ availableBalance:100 }) });
        await credit({ ...base, currency: 'usd' });
        assert.deepEqual(mock.writes[0].values, { ...expectedTopup, ...recordCurrency('USD','verified') });
        assert.deepEqual(clean(mock.writes.at(-1).values), expectedTopup);
        assert.equal(mock.writes.length, rejected ? 2 : 1);
        assert.equal(mock.calls[0].payload.p_amount_net, 100);
        assert.equal('currency' in mock.calls[0].payload, false, 'No direct row fields in RPC payload');
      }
      const mock = mockDB({ data: { credited: true, stripe_id: 'cs_new' }, error: null });
      await extracted(file, 'creditWalletTopup', { ...helpers, supabase: mock, recordPlatformFeeLedger: async () => {}, syncAffiliateWalletCache: async () => ({ availableBalance:100 }) })({ ...base, currency: 'aud' });
      assert.equal(mock.writes.length, 0, 'Atomic currency RPC requires no follow-up');
      assert.match(fs.readFileSync(file,'utf8'), /currency: session.currency/);
    }
    const refundParams = { email: 'affiliate@test', topup: { id:'topup', amount_net:100, amount_refunded:5 }, refundAmount:12.34, stripeRefundId:'re_new', stripeChargeId:'ch_new', stripeStatus:'succeeded', currency:'gbp' };
    const refundContext = (supabase: any) => ({ ...helpers, supabase, isRpcMissing: (e: any) => e?.code === 'PGRST202', getCreditedTopupAmount: () => 100 });
    const refunds = mockDB();
    await extracted('app/api/stripe/refund/route.ts','recordWalletRefund',refundContext(refunds))(refundParams);
    assert.deepEqual(refunds.writes[0].values, { affiliate_email:'affiliate@test', source_topup_id:'topup', stripe_refund_id:'re_new', stripe_charge_id:'ch_new', amount:12.34, status:'succeeded', ...recordCurrency('GBP','verified') });
    assert.equal(refunds.writes[1].values.amount_refunded,17.34);
    for (const data of [{ success:true, idempotent:true, refundId:'old' }, { success:true, idempotent:false }]) {
      const mock = mockDB({ data, error:null });
      await extracted('app/api/stripe/refund/route.ts','recordWalletRefund',refundContext(mock))(refundParams);
      assert.equal(mock.writes.length,0, 'No replay backfill or guessed ID');
    }
    const fresh = mockDB({ data:{ success:true, idempotent:false, refundId:'fresh' }, error:null });
    fresh.rejectMetadata = true;
    const result = await extracted('app/api/stripe/refund/route.ts','recordWalletRefund',refundContext(fresh))(refundParams);
    assert.equal(result.success,true,'Atomic currency RPC requires no follow-up');
    assert.match(fs.readFileSync('app/api/stripe/refund/route.ts','utf8'), /currency: refund.currency/);

    for (const mode of ['oneoff','upfront','spread']) {
      const mock = mockDB();
      const offer = { id:'offer', currency:'GBP', type:mode === 'oneoff' ? 'one_off':'recurring', payout_mode:mode === 'spread' ? 'spread':'upfront', recurring_term_months:3, recurring_monthly_commission_value:7 };
      const create = extracted('app/api/process-conversion/route.ts','createPayoutsForConversion',{ ...helpers, supabase:mock });
      await create({ event:{ id:'event', created_at:'2026-10-01T12:00:00.000Z' }, offer, affiliateEmail:'affiliate@test', businessEmail:'business@test', basePayoutAmount:10 });
      const payouts = mock.writes.filter((w: any) => w.table === 'wallet_payouts').flatMap((w: any) => Array.isArray(w.values) ? w.values : [w.values]);
      assert.equal(payouts.length,mode === 'spread' ? 3:1);
      payouts.forEach((row: any,i: number) => {
        assert.deepEqual({ currency:row.currency,currency_source:row.currency_source },recordCurrency('AUD','inferred'));
        const available = new Date('2026-10-15T12:00:00.000Z'); available.setMonth(available.getMonth()+i);
        assert.deepEqual(clean(row), { business_email:'business@test',affiliate_email:'affiliate@test',offer_id:'offer',amount:mode === 'oneoff' ? 10:mode === 'upfront' ? 21:7,status:'pending',source_event_id:'event',cycle_number:i+1,available_at:available.toISOString(),is_recurring:mode !== 'oneoff',recurring_instance_id:mode === 'oneoff' ? null:'new-row',recurring_term_months:mode === 'oneoff' ? null:3,recurring_payout_mode:mode === 'oneoff' ? null:offer.payout_mode,recurring_payout_interval:mode === 'oneoff' ? null:'monthly' });
      });
      if (mode !== 'oneoff') {
        const row = mock.writes.find((w: any) => w.table === 'recurring_commission_instances').values;
        assert.deepEqual({ currency:row.currency,currency_source:row.currency_source },recordCurrency('GBP','inferred'));
        assert.deepEqual(clean(row), {source_event_id:'event',offer_id:'offer',business_email:'business@test',affiliate_email:'affiliate@test',customer_reference:null,term_months:3,monthly_commission_amount:7,payout_mode:offer.payout_mode,payout_interval:'monthly',status:'active',current_cycle:0,next_payout_at:'2026-10-15T12:00:00.000Z'});
      }
    }
    // Refund provider branches preserve the exact amount and call sequence.
    for (const id of ['ch_original','pi_original','cs_original']) {
      const calls: any[] = [];
      const stripe = {
        refunds:{create:async (payload: any) => { calls.push(['refund',payload]); return {id:'re_new',currency:'gbp'}; }},
        charges:{list:async (payload: any) => { calls.push(['charges',payload]); return {data:[{id:'ch_original',currency:'gbp'}]}; }},
        checkout:{sessions:{retrieve:async (value: string) => { calls.push(['session',value]); return {payment_intent:'pi_original',currency:'gbp'}; }}},
      };
      const create = extracted('app/api/stripe/refund/route.ts','createStripeRefund',{stripe,buildNettmarkStripeMetadata:(_action: any,v: any)=>v});
      const result = await create({id:'topup',stripe_id:id},12.34,'affiliate@test');
      assert.equal(result.refund.currency,'gbp');
      assert.equal(calls.at(-1)[1].amount,1234);
      assert.equal(calls.at(-1)[1].charge,'ch_original');
      assert.equal(calls.length,id.startsWith('cs_') ? 3:id.startsWith('pi_') ? 2:1);
    }
    // Full settlement outcomes and all money payloads must match the original
    // execution with recording disabled, including subsidy and claim-race paths.
    for (const scenario of ['wallet','subsidy','insufficient','race']) {
      let baseline: any;
      for (const recording of ['disabled','enabled','rejected']) {
        const live = {id:'live',affiliate_email:'affiliate@test',business_email:'business@test',offer_id:'offer',spend:20,spend_transferred:5};
        const mock = mockDB(undefined,(table,kind) => table === 'live_ads' ? kind === 'update' ? scenario === 'race' ? []:[{id:'live'}]:live : table === 'business_activation_subsidies' ? [{id:'subsidy'}]:{id:'new-row'});
        mock.rejectMetadata = recording === 'rejected';
        const context = {
          ...helpers,supabase:mock,
          withRecordedCurrency:recording === 'disabled' ? async (_fields: any,write: any)=>write({}):withRecordedCurrency,
          roundMoney:(v: number)=>Math.round(v*100)/100,toMoney:(v: any)=>Number(v || 0),
          guardPaidCurrency:async()=>({allowed:true,metaAccountCurrency:'AUD',campaignCurrency:'AUD'}),
          getWalletBalanceSnapshot:async()=>({availableBalance:scenario === 'insufficient' ? 0:100,totalTopupsNetAvailable:100,totalDeductions:0}),
          findReservedActivationSubsidy:async()=>scenario === 'subsidy' ? {id:'subsidy',consumed_amount:0,subsidy_amount:10}:null,
          getActivationSubsidyRemaining:(v: any)=>v ? 10:0,
          buildAdSpendSettlementKey:(id: string,v: number)=>`${id}:${v}`,
          findExistingSettlementByKey:async()=>null,isUniqueViolation:(e: any)=>e?.code === '23505',
        };
        const settle = extracted('utils/adSpend/settlements.ts','settleAdSpendLedger',context);
        const outcome = await settle({supabase:mock,liveAdId:'live'});
        const moneyWrites = mock.writes.filter((w: any)=> !(recording === 'rejected' && w.values?.currency_source)).map((w: any)=>clean(w));
        // Timestamps are bookkeeping fields; use a stable snapshot marker.
        const snapshot = JSON.parse(JSON.stringify({outcome,writes:moneyWrites}), (key,value)=>['next_retry_at','consumed_at','updated_at'].includes(key) ? '<timestamp>':value);
        if (recording === 'disabled') baseline = snapshot;
        else assert.deepEqual(snapshot,baseline,`${scenario}: recording must preserve settlement outcome and money writes`);
        if (scenario === 'wallet' || scenario === 'subsidy') {
          assert.equal(outcome.chargedAmount,15);
          assert.equal(outcome.wallet.availableBalanceAfter,scenario === 'subsidy' ? 95:85);
        }
      }
    }
    // Exercise the real insert expressions (including their .select return shape).
    for (const [file,name,payloadName,table] of [
      ['utils/adSpend/settlements.ts','deductionErr','walletDeductionPayload','wallet_deductions'],
      ['utils/adSpend/settlements.ts','settlementErr','settlementPayload','ad_spend_settlements'],
      ['app/api/meta/callback/upload-video/route.ts','liveAdErr','liveAdsPayload','live_ads'],
    ]) {
      for (const rejected of [false,true]) {
        const mock = mockDB(); mock.rejectMetadata = rejected;
        const payload = { amount:12.34,affiliate_email:'affiliate@test',settlement_key:'stable-key',spend:20,spend_transferred:5 };
        await writeStatement(file,name,{ ...helpers,supabase:mock,[payloadName]:payload,currency:{ metaAccountCurrency:'AUD',campaignCurrency:'AUD' },currencyGuard:{ metaAccountCurrency:'AUD',campaignCurrency:'AUD' } });
        assert.equal(mock.writes[0].table,table);
        assert.deepEqual(mock.writes[0].values,{...payload,...recordCurrency('AUD','verified')});
        assert.deepEqual(clean(mock.writes.at(-1).values),payload);
        assert.equal(mock.writes.length,rejected ? 2:1);
      }
    }
    // Stripe is mocked even for the synthetic harness's private creation path.
    const mock = mockDB();
    const createLive = extracted('app/api/internal/money-flow-harness/route.ts','createLiveAd',{...helpers,supabase:mock,getBusinessProfile:async()=>({id:'business'}),getAffiliateProfile:async()=>({user_id:'affiliate'}),getDefaultOffer:async()=>({id:'offer'}),toAmount:(v: any,f: any)=>v ?? f,crypto:{randomUUID:()=> 'uuid'},AFFILIATE_EMAIL:'affiliate@test',BUSINESS_EMAIL:'business@test',stripe:{}});
    await createLive({spend:12.34});
    assert.equal(mock.writes[0].values.spend,12.34);
    assert.equal(mock.writes[0].values.currency,null);
    assert.equal(mock.writes[0].values.currency_source,'unresolved');
    assert.ok(warnings.length >= 6);
    console.log('Segment 5: normalization, all direct write sites, payload snapshots, metadata failures, RPC writes and replay protection passed (mocked; no connections).');
  } finally { console.warn = warn; globalThis.fetch = fetch; }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });

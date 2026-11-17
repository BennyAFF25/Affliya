/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports -- Offline Supabase/Stripe contract fixtures. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import { captureCreatorReferral, recordCreatorReferralSignupIntent, parseCreatorReferralCookie, createCreatorCommissionFromPaidInvoice } from '../utils/creatorReferrals';
import { generatePartnerCode, withUniquePartnerCode } from '../utils/growthPartners/accounts';
import { calculateEligibleSubscriptionRevenue, remainingCommission } from '../utils/growthPartners/commissionMath';
import { growthEmailAllowed } from '../utils/growthPartners/email';
import { createGrowthLoginHandler } from '../utils/growthPartners/login';
import { trackGrowthPartnerStripeEvent } from '../utils/growthPartners/stripeEvents';
import { reviewCommission, recordPartnerPayout } from '../utils/growthPartners/admin';
import { submitGrowthApplication } from '../utils/growthPartners/applications';

let count = 0;
async function test(name: string, fn: () => any) { await fn(); count++; console.log(`ok ${count} - ${name}`); }
// This fake records TS contracts; it does NOT implement or validate SQL invariants.
// Reviewer must verify the real RPCs, transactions, RLS and concurrent replay on staging.
function fake(rows: Record<string, any> = {}, rpcResult: any = { data: null, error: null }) {
  const writes: any[] = [], calls: any[] = [];
  const db: any = { writes, calls, from(table: string) {
    const q: any = {};
    for (const method of ['select','eq','ilike','in','is']) q[method] = (...args: any[]) => { calls.push({table, method, args}); return q; };
    for (const method of ['insert','upsert','update']) q[method] = (...args: any[]) => { writes.push({table, method, args}); return q; };
    const result = () => ({data: rows[table] ?? null, error: null});
    q.single = q.maybeSingle = async () => result();
    q.then = (resolve: any, reject: any) => Promise.resolve(result()).then(resolve,reject);
    return q;
  }, rpc: async (name: string, args: any) => { calls.push({name,args}); return typeof rpcResult === 'function' ? rpcResult(name,args) : rpcResult; } };
  return db;
}
const partner = { id:'partner', status:'active', referral_code:'ABCDEFGH', partner_email:'partner@example.test', user_id:'partner-user' };
function jar() {
  let raw = ''; let sets = 0;
  return {get: () => ({value:raw}), set: (_name: string,value: string) => {raw=value; sets++;}, get sets() {return sets;} };
}
const invoice: any = {id:'in_1', subscription:'sub_1', status:'paid', amount_paid:11000, currency:'aud', billing_reason:'subscription_create', created:1700000000, status_transitions:{paid_at:1700000000}, lines:{data:[{type:'subscription',amount:11000}],has_more:false}};
const subscription: any = {id:'sub_1', customer:'cus_1',items:{data:[{price:{recurring:{interval:'month',interval_count:1}}}]}};
const commissionDb = (result: any = {data:{created:true,monthNumber:1},error:null}) => fake({business_entitlements:{business_id:'business'},business_creator_attributions:{id:'attribution',creator_partner_id:'partner'}},result);
const create = (db: any, inv = invoice, sub = subscription) => createCreatorCommissionFromPaidInvoice({supabase:db,invoice:inv,subscription:sub});
const event = (type: string, object: any): any => ({id:'evt_1',type,created:1700000000,data:{object}});
async function run() {
  globalThis.fetch = async () => {throw new Error('Network forbidden');};
  delete process.env.CREATOR_REFERRAL_ATTRIBUTION_WINDOW_DAYS;
  delete process.env.GROWTH_PARTNER_COMMISSION_HOLD_DAYS;
  delete process.env.GROWTH_PARTNER_ASSUME_AUD_GST_INCLUSIVE;
  // Prevent actual email transport even when the parent shell has credentials configured.
  delete process.env.RESEND_API_KEY; delete process.env.RESEND_FROM_EMAIL; delete process.env.ADMIN_NOTIFY_EMAIL;
  await test('referral code alphabet and length', () => {for(let i=0;i<100;i++) assert.match(generatePartnerCode(),/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);});
  await test('unique code retries collisions and stops on success', async () => {
    let n=0; const codes: string[]=[];
    assert.equal(await withUniquePartnerCode(async code => {codes.push(code);return ++n<3 ? {data:'',error:{code:'23505'}} : {data:'partner',error:null};},()=>String(n)), 'partner');
    assert.deepEqual(codes,['0','1','2']);
    await assert.rejects(withUniquePartnerCode(async()=>({data:null,error:{code:'23505'}})),/allocate/);
    await assert.rejects(withUniquePartnerCode(async()=>({data:null,error:{code:'other'}})),/activation/);
  });
  await test('first touch preserved with exactly 60 days', async () => {
    const cookieStore=jar(),db=fake({creator_partners:partner});
    const first=await captureCreatorReferral({supabase:db,cookieStore,referralCode:partner.referral_code});
    assert.equal(first.captured,true); assert.equal(Date.parse(first.cookie!.expiresAt)-Date.parse(first.cookie!.capturedAt),60*86400000);
    const second=await captureCreatorReferral({supabase:db,cookieStore,referralCode:'OTHER'});
    assert.equal(second.reason,'existing_creator_referral_cookie'); assert.equal(cookieStore.sets,1);
    assert.equal(parseCreatorReferralCookie(JSON.stringify({...first.cookie,expiresAt:'bad'})),null);
    assert.equal(parseCreatorReferralCookie(JSON.stringify({...first.cookie,expiresAt:new Date(0).toISOString()})),null);
  });
  for(const [label,row,code] of [['invalid',null,'!'],['unknown',null,'UNKNOWN'],['suspended',{...partner,status:'suspended'},'ABCDEFGH']] as const) await test(`${label} referral never sets cookie`,async()=>{
    const cookieStore=jar(); const result=await captureCreatorReferral({supabase:fake({creator_partners:row}),cookieStore,referralCode:code});
    assert.equal(result.captured,false); assert.equal(cookieStore.sets,0);
  });
  for(const [label,email,userId,extra,reason] of [
    ['self email','partner@example.test','other',{},'self_referral_rejected'],
    ['self user','business@example.test','partner-user',{},'self_referral_rejected'],
    ['already attributed','business@example.test','other',{business_creator_attributions:{id:'existing'}},'business_already_attributed'],
    ['pre-existing business','business@example.test','other',{business_profiles:{id:'business',created_at:new Date(Date.now()-1000).toISOString()}},'pre_existing_business'],
  ] as const) await test(label,async()=>{
    const cookieStore=jar(),db=fake({creator_partners:partner,...extra});
    await captureCreatorReferral({supabase:db,cookieStore,referralCode:partner.referral_code});
    assert.equal((await recordCreatorReferralSignupIntent({supabase:db,cookieStore,businessEmail:email,userId})).reason,reason);
    assert.equal(db.writes.filter((w:any)=>w.table==='creator_referral_signup_intents').length,0);
  });
  await test('valid signup intent forwards immutable first-touch capture to attach RPC',async()=>{
    const cookieStore=jar(), db=fake({creator_partners:partner,business_profiles:{id:'business',business_email:'business@example.test',created_at:new Date(Date.now()+1000).toISOString()}},{data:'attribution',error:null});
    await captureCreatorReferral({supabase:db,cookieStore,referralCode:partner.referral_code});
    const result=await recordCreatorReferralSignupIntent({supabase:db,cookieStore,businessEmail:' Business@Example.Test ',userId:'business-user'});
    assert.deepEqual(result,{recorded:true,attributionId:'attribution'});
    const write=db.writes.find((w:any)=>w.table==='creator_referral_signup_intents');
    assert.deepEqual(write.args[1],{onConflict:'business_email',ignoreDuplicates:true});
    assert.equal(write.args[0].captured_at,JSON.parse(cookieStore.get().value).capturedAt);
    assert.deepEqual(db.calls.find((c:any)=>c.name)?.args,{p_business_id:'business',p_business_email:'business@example.test',p_attribution_source:'signup_intent_recorded'});
  });
  await test('failed invoice calculator and paid invoice replay RPC contracts',async()=>{
    const failed=commissionDb(); assert.equal((await create(failed,{...invoice,status:'open'})).reason,'invoice_not_paid');
    assert.equal(failed.calls.filter((c:any)=>c.name).length,0);
    let attempts=0;
    const db=commissionDb(()=>({data:++attempts===1?{created:true,ledgerId:'one-row',monthNumber:1}:{created:false,reason:'duplicate_invoice'},error:null}));
    await trackGrowthPartnerStripeEvent(db,{} as any,event('invoice.paid',invoice),subscription);
    await trackGrowthPartnerStripeEvent(db,{} as any,event('invoice.paid',invoice),subscription);
    const calls=db.calls.filter((c:any)=>c.name==='create_creator_subscription_commission');
    assert.equal(calls.length,2); assert.deepEqual(calls[0].args,calls[1].args);
    assert.equal(db.writes.filter((w:any)=>w.table==='creator_commission_ledger').length,0,'SQL owns the single-row invariant');
  });
  await test('$0 trial skips commission RPC',async()=>{const db=commissionDb(); assert.equal((await create(db,{...invoice,amount_paid:0})).reason,'free_or_zero_amount_invoice'); assert.equal(db.calls.filter((c:any)=>c.name).length,0);});
  for(const [name,patch,base,tax] of [
    ['Stripe tax',{amount_paid:11000,total_taxes:[{amount:1000}],lines:{data:[{type:'subscription',amount:11000,amount_excluding_tax:10000}]}},10000,1000],
    ['AUD GST-inclusive fallback',{},10000,1000],
    ['coupon discount',{amount_paid:8800,lines:{data:[{type:'subscription',amount:11000,discount_amounts:[{amount:2200}]}]}},8000,800],
    ['pretax credit',{amount_paid:8800,lines:{data:[{type:'subscription',amount:11000,pretax_credit_amounts:[{amount:2200}]}]}},8000,800],
    ['non-subscription excluded',{amount_paid:22000,lines:{data:[{type:'subscription',amount:11000},{type:'invoiceitem',amount:11000}]}},10000,2000],
    ['proration skipped',{amount_paid:22000,lines:{data:[{type:'subscription',amount:11000},{type:'subscription',amount:11000,proration:true}]}},10000,2000],
  ] as const) await test(`conversion month 1: ${name}`,async()=>{
    const db=commissionDb(); assert.equal((await create(db,{...invoice,...patch})).monthNumber,1);
    const call=db.calls.find((c:any)=>c.name==='create_creator_subscription_commission');
    assert.deepEqual(call.args,{p_attribution_id:'attribution',p_invoice_id:'in_1',p_subscription_id:'sub_1',p_base:base,p_amount_paid:patch.amount_paid??11000,p_tax:tax,p_currency:'aud',p_paid_at:new Date(1700000000000).toISOString(),p_hold_days:14});
  });
  await test('nonmonthly and incomplete lines fail closed',()=>{
    assert.equal(calculateEligibleSubscriptionRevenue(invoice,false).reason,'non_monthly_subscription');
    assert.equal(calculateEligibleSubscriptionRevenue({...invoice,lines:{...invoice.lines,has_more:true}},true).reason,'incomplete_invoice_lines');
  });
  // Scripted RPC replies validate propagation/arguments, not a second implementation of SQL.
  for(const month of [2,3]) await test(`renewal month ${month} RPC result`,async()=>{
    const db=commissionDb({data:{created:true,monthNumber:month},error:null});
    assert.equal((await create(db,{...invoice,id:`in_${month}`,billing_reason:'subscription_cycle'})).monthNumber,month);
    assert.equal(db.calls.find((c:any)=>c.name)?.args.p_attribution_id,'attribution');
  });
  for(const [label,sub,reason] of [
    ['fourth invoice',subscription,'commission_duration_complete'],
    ['resubscription does not reset business count',{...subscription,id:'sub_new'},'commission_duration_complete'],
    ['suspended partner',subscription,'partner_not_active'],
    ['duplicate invoice',subscription,'duplicate_invoice'],
  ] as const) await test(`${label}: SQL result propagated`,async()=>{
    const db=commissionDb({data:{created:false,reason},error:null}); assert.deepEqual(await create(db,invoice,sub),{created:false,reason});
    assert.equal(db.calls.filter((c:any)=>c.name==='create_creator_subscription_commission').length,1);
    assert.equal(db.calls.find((c:any)=>c.name)?.args.p_attribution_id,'attribution');
  });
  await test('duplicate unique constraint handled without TS ledger insert',async()=>{
    const db=commissionDb({data:null,error:{code:'23505'}}); assert.equal((await create(db)).reason,'duplicate_invoice');
    assert.equal(db.writes.filter((w:any)=>w.table==='creator_commission_ledger').length,0);
  });
  await test('failed payment audits without commission',async()=>{
    const db=commissionDb(); await trackGrowthPartnerStripeEvent(db,{} as any,event('invoice.payment_failed',{...invoice,status:'open'}),subscription);
    assert.equal(db.calls.filter((c:any)=>c.name).length,0);
    assert.ok(db.writes.some((w:any)=>w.args[0].event_type==='payment_failed'));
  });
  for(const [label,amount,reason] of [['full refund',11000,'stripe_charge_refunded'],['partial refund',5500,'stripe_charge_refunded'],['paid refund clawback replay',5500,'stripe_charge_refunded'],['dispute',null,'stripe_charge_disputed']] as const) await test(`${label}: cumulative RPC contract`,async()=>{
    const db=commissionDb({data:{reversed:true},error:null});
    const charge={id:'ch_1',invoice:'in_1',amount_refunded:amount,refunds:{data:[{id:'re_1'}]}};
    const dispute=label==='dispute'; const evt=event(dispute?'charge.dispute.created':'charge.refunded',dispute?{id:'dp_1',charge:'ch_1'}:charge);
    const stripe:any={charges:{retrieve:async(id:string)=>{assert.equal(id,'ch_1');return charge;}}};
    await trackGrowthPartnerStripeEvent(db,stripe,evt);
    const args=db.calls.find((c:any)=>c.name==='refund_creator_subscription_commission').args;
    assert.deepEqual(args,{p_invoice_id:'in_1',p_refund_key:dispute?'dispute:dp_1':`re_1:${amount}`,p_cumulative_amount:amount,p_reason:reason});
    if(label.includes('replay')) {await trackGrowthPartnerStripeEvent(db,stripe,evt);assert.deepEqual(db.calls.filter((c:any)=>c.name).map((c:any)=>c.args),[args,args]);}
    assert.equal(remainingCommission(5000,11000,amount??11000),amount===5500?2500:0);
  });
  await test('approval hold rejection propagated, approval args preserved',async()=>{
    const db=fake({}, {data:null,error:{message:'hold'}});
    await assert.rejects(reviewCommission(db,'ledger',true,'review','admin@example.test'),/hold/);
    assert.deepEqual(db.calls[0],{name:'review_creator_commission',args:{p_ledger_id:'ledger',p_approve:true,p_reason:'review',p_reviewed_by:'admin@example.test'}});
  });
  await test('payout validates empty input locally and forwards deduplicated selection',async()=>{
    const db=fake({}, {data:'payout',error:null});
    await assert.rejects(recordPartnerPayout(db,'partner',[],'ref','','admin'),/Select/);
    assert.equal(db.calls.length,0);
    assert.equal(await recordPartnerPayout(db,'partner',['approved','clawback','approved'],' ref ','notes','admin'),'payout');
    assert.deepEqual(db.calls[0].args,{partner_id:'partner',ledger_ids:['approved','clawback'],method:'manual_bank_transfer',reference:'ref',notes:'notes',recorded_by:'admin'});
  });
  for(const issue of ['unapproved row','different partner','mixed currency','nonpositive net clawback']) await test(`payout RPC rejection: ${issue}`,async()=>{
    const db=fake({}, {data:null,error:{message:issue}}); await assert.rejects(recordPartnerPayout(db,'partner',['bad'],'ref','','admin'),/one partner.*one currency.*approved.*clawbacks/);
  });
  await test('nonproduction email guard permits QA aliases and denies other recipients',()=>{
    const env:any={VERCEL_ENV:'preview'};
    for(const email of ['nettmarkqa@mail.grokbot.com','NettmarkQA+growth@mail.grokbot.com']) assert.equal(growthEmailAllowed(email,env),true);
    for(const email of ['outsider@example.test','nettmarkqa@mail.grokbot.com.evil','other+nettmarkqa@mail.grokbot.com']) assert.equal(growthEmailAllowed(email,env),false);
    const configured:any={...env,NON_PRODUCTION_EMAIL_ALLOWLIST:'tester@example.test,@safe.test'};
    assert.equal(growthEmailAllowed('tester@example.test',configured),true);
    assert.equal(growthEmailAllowed('person+tag@safe.test',configured),true);
    assert.equal(growthEmailAllowed('tester+tag@example.test',configured),false,'explicit mailbox allowlist is exact');
    assert.equal(growthEmailAllowed('x@unsafe.test',configured),false);
    assert.equal(growthEmailAllowed('any@example.test',{VERCEL_ENV:'production'} as any),true);
  });
  await test('login identical generic response with and without partner',async()=>{
    let sent=0;
    const request=()=>new Request('https://offline.test/api/growth-partners/login',{method:'POST',body:JSON.stringify({email:'partner@example.test'})});
    const db=fake({creator_partners:{user_id:'partner-user'}});
    db.auth={admin:{getUserById:async()=>({data:{user:{email:'partner@example.test'}},error:null}),generateLink:async()=>({data:{properties:{hashed_token:'offline-token'}},error:null})}};
    const handler=createGrowthLoginHandler({limit:async()=>true,admin:()=>db,send:async()=>{sent++;return {sent:true};}});
    const yes=await handler(request());
    const no=await createGrowthLoginHandler({limit:async()=>true,admin:()=>fake(),send:async()=>{throw Error('Must not send');}})(request());
    assert.equal(yes.status,200); assert.equal(no.status,200); assert.deepEqual(await yes.json(),await no.json()); assert.equal(sent,1);
  });
  await test('Lead response id matches CAPI payload; preview skips CAPI',async()=>{
    const input={email:'applicant@example.test',full_name:'Offline Applicant',category:'creator',profile_url:'https://example.test',audience_estimate:'<1k'};
    const request=new Request('https://offline.test/api/growth-partners/apply');
    let payload:any, sent=0;
    const sender:any=async(args:any)=>{payload=args.payload;sent++;return {ok:true};};
    process.env.VERCEL_ENV='production'; process.env.META_CAPI_ACCESS_TOKEN='offline-fixture';
    const db=fake({growth_partner_applications:{id:'application'}});
    const result=await submitGrowthApplication(db,input,request,sender);
    assert.equal(payload.event_id,result.event_id); assert.equal(payload.event_name,'Lead'); assert.equal(sent,1);
    assert.equal(db.writes[0].args[0].meta_event_id,result.event_id);
    process.env.VERCEL_ENV='preview';
    const preview=fake({growth_partner_applications:{id:'preview'}});
    await submitGrowthApplication(preview,input,request,sender); assert.equal(sent,1);
    assert.ok(preview.writes.some((w:any)=>w.args[0].meta_capi_status==='skipped_non_production'));
  });
  await test('real redirect and admin API reject invalid/suspended codes and unauthorized users',async()=>{
    const loader=Module as any, original=loader._load;
    let user:any=null, db=fake();
    loader._load=function(id:string,...args:any[]) {
      if(id==='@supabase/auth-helpers-nextjs') return {createRouteHandlerClient:()=>({auth:{getUser:async()=>({data:{user}})}})};
      if(id==='next/headers') return {cookies:()=>({})};
      if(id.endsWith('businessSubscriptions')) return {createServerSupabaseClient:()=>db};
      return original.call(this,id,...args);
    };
    try {
      const redirect=require('../app/r/[code]/route');
      for(const row of [null,{...partner,status:'suspended'}]) {
        db=fake({creator_partners:row});
        const response=await redirect.GET(new Request('https://offline.test/r/ABCDEFGH',{headers:{'user-agent':'Mozilla/5.0'}}),{params:Promise.resolve({code:'ABCDEFGH'})});
        assert.equal(response.status,307); assert.equal(response.headers.get('set-cookie'),null);
      }
      const admin=require('../app/api/internal/growth-partners/route');
      for(const [identity,status] of [[null,401],[{id:'outsider',email:'outsider@example.test'},403]] as const) {
        user=identity; db=fake();
        assert.equal((await admin.GET(new Request('https://offline.test/api/internal/growth-partners'))).status,status);
        assert.equal((await admin.POST(new Request('https://offline.test/api/internal/growth-partners',{method:'POST',body:'{}'}))).status,status);
        assert.equal(db.calls.length,0);
      }
    } finally {loader._load=original;}
  });
  await test('SQL source contracts awaiting reviewer staging verification',()=>{
    const sql=fs.readFileSync('supabase/migrations/20261117120000_growth_partners.sql','utf8');
    for(const pattern of [/FOR UPDATE/,/business_creator_attribution_id=a.id AND entry_type='commission'/,/n>p.commission_duration_months/,/partner_not_active/,/commission_skipped/,/duplicate_invoice/,/cumulative<=l.refunded_amount/,/l.status='paid' AND delta>0/,/commission_amount=target/,/cumulative=l.amount_paid THEN 'reversed'/,/Refund hold has not elapsed/,/l.creator_partner_id<>partner_id/,/Mixed currencies/,/total<=0/,/total:=total\+l.commission_amount/,/FROM PUBLIC,anon,authenticated/]) assert.match(sql,pattern);
  });
  assert.match(fs.readFileSync('app/api/growth-partners/apply/route.ts','utf8'),/Response.json\(await submitGrowthApplication/);
  assert.match(fs.readFileSync('app/api/growth-partners/login/route.ts','utf8'),/createGrowthLoginHandler/);
  console.log(`growth partner tests passed: ${count} cases (SQL execution requires staging reviewer)`);
}
void run().catch(error=>{console.error(error);process.exitCode=1;});

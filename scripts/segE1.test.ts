import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { resolveOfferCurrency } from '../utils/currency/proposalCurrency';
import { checkPaidCurrency, paidLaunchCurrencies } from '../utils/currency/paidCurrencyGuard';
import { formatMoney } from '../utils/currency';
import { createReadinessRateLookup, getAudRate } from '../utils/fx/rates';
import { reserveLaunchHold } from '../utils/wallet/launchHolds';
import { getAffiliateCampaignFundingReadiness } from '../utils/paidCampaignLaunchReadiness';
async function main() {
 const oldFetch=globalThis.fetch;
 globalThis.fetch=async()=>{throw new Error('No network allowed');};
 const flag=process.env.PAID_LAUNCH_CURRENCIES, buffer=process.env.FX_BUFFER_BPS;
 try {
  delete process.env.PAID_LAUNCH_CURRENCIES; process.env.FX_BUFFER_BPS='400';
  assert.deepEqual(paidLaunchCurrencies(),['AUD']);
  for(const [currency, rate, expected] of [['USD',1.5,34.32],['GBP',2,45.76]] as const){
   let reads=0; const calls:any[]=[];
   const client:any={from(table:string){
    if(table==='fx_rates')reads++;
    const q:any={}; for(const method of ['select','eq','lte','order','limit'])q[method]=()=>q;
    q.maybeSingle=async()=>({data:table==='ad_ideas'?{offer_id:'offer',currency:null}:{currency}});
    q.then=(resolve:any)=>Promise.resolve({data:[{rate,source:'frankfurter',rate_date:new Date().toISOString().slice(0,10)}],error:null}).then(resolve);
    return q;
   },rpc:async(name:string,args:any)=>{calls.push({name,args});return {data:'hold',error:null};}};
   const resolved=resolveOfferCurrency(null,currency);
   assert.equal(resolved.campaignCurrency,currency);
   assert.match(formatMoney(22,resolved.campaignCurrency),new RegExp(currency+'\\s*22.00'));
   const rateLookup=createReadinessRateLookup(client);
   const currencyReadiness=checkPaidCurrency(null,currency,currency);
   assert.equal(currencyReadiness.allowed,false);
   const rows=await Promise.all(Array.from({length:12},()=>getAffiliateCampaignFundingReadiness({supabase:client,affiliateEmail:'a',offerId:'offer',adIdea:{currency:null,budget_amount:2200},currencyReadiness,rateLookup})));
   assert.equal(reads,1,'one FX read per currency per listing request');
   assert.equal(rows[0].requiredAmount,22); assert.equal(rows[0].holdAudEstimate,expected);assert.match(rows[0].currencyBlock!,new RegExp(currency));
   const enabled = await getAffiliateCampaignFundingReadiness({supabase:client,affiliateEmail:'a',offerId:'offer',adIdea:{currency:null,budget_amount:2200},currencyReadiness:{...currencyReadiness,allowed:true,reason:null,message:null},rateLookup,walletSnapshot:Promise.resolve({availableBalance:22}),fundingSources:Promise.resolve({activationSubsidyAvailable:0,launchFundAvailable:0,reservationsApplied:true})});
   assert.equal(enabled.ready,false);assert.equal(enabled.deficit,Math.round((expected-22)*100)/100);
   await reserveLaunchHold(client,'a',22,'proposal');
   assert.equal(calls[0].name,'reserve_launch_hold_fx'); assert.equal(calls[0].args.p_amount,expected);
   assert.equal(calls[0].args.p_original_currency,currency); assert.equal(calls[0].args.p_original_amount,22);
   assert.equal(resolveOfferCurrency('AUD',currency).reason,'proposal_currency_mismatch');
  }
  assert.equal(resolveOfferCurrency(null,null).allowed,false);
  const read=(path:string)=>readFileSync(path,'utf8');
  assert.match(read('app/api/affiliate/pending-paid-proposals/route.ts'),/currency: currencyReadiness\(offerId, proposal.currency\).campaignCurrency/);
  assert.doesNotMatch(read('app/affiliate/dashboard/manage-campaigns/PendingProposalRow.tsx'),/proposal.currency \|\| ["']AUD/);
  for(const route of ['app/api/affiliate/pending-paid-proposals/route.ts','app/api/business/ad-ideas/review-readiness/route.ts']) {
   assert.match(read(route),/createReadinessRateLookup/);
   assert.doesNotMatch(read(route),/verifyLive: true/);
  }

  const empty:any={from(){const q:any={};for(const m of ['select','eq','lte','order','limit'])q[m]=()=>q;q.then=(r:any)=>Promise.resolve({data:[],error:null}).then(r);return q;}};
  await assert.rejects(getAudRate('USD',{client:empty,cachedOnly:true}),/cached/);
  console.log('E1: legacy USD/GBP labels, buffered holds, default block, mismatch/missing currency and request FX deduplication passed');
 }finally{globalThis.fetch=oldFetch;if(flag===undefined)delete process.env.PAID_LAUNCH_CURRENCIES;else process.env.PAID_LAUNCH_CURRENCIES=flag;if(buffer===undefined)delete process.env.FX_BUFFER_BPS;else process.env.FX_BUFFER_BPS=buffer;}
}
void main().catch(e=>{console.error(e);process.exitCode=1;});

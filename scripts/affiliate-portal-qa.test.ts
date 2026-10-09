import assert from "node:assert/strict";
import type { SupabaseClient,Session,User } from "@supabase/supabase-js";
import { loadAffiliateSubmissions,loadApprovedOfferIds,isAwaitingProposalReview,isArchivedCampaignStatus } from "../utils/affiliate/portalData";
import { loadProposalDetails } from "../utils/affiliate/proposalDetails";
import { ensureSubmissionSession,SubmissionSessionError } from "../utils/affiliate/submissionSession";
import { normalizeOfferDestination,getOfferPayoutTypeLabel } from "../utils/offers/presentation";
import { formatMoney } from "../utils/currency";
type Row=Record<string,unknown>;
function fixture(tables:Record<string,Row[]>,failure?:string){
 const reads:{table:string;filters:[string,unknown][]}[]=[];
 const client={from(table:string){
  const filters:[string,unknown][]=[],read={table,filters};let range:[number,number]|undefined;
  const query={
   select(){return query;},order(){return query;},
   eq(key:string,value:unknown){filters.push([key,value]);return query;},
   in(key:string,values:unknown[]){filters.push([key,values]);return query;},
   range(start:number,end:number){range=[start,end];return query;},
   maybeSingle(){return execute(true);},
   then(resolve:(value:unknown)=>unknown,reject:(reason:unknown)=>unknown){return execute(false).then(resolve,reject);}
  };
  async function execute(single:boolean){
   reads.push(read);
   if(table===failure)return {data:null,error:new Error("fixture query failed")};
   let rows=(tables[table] || []).filter(row=>filters.every(([key,value])=>Array.isArray(value)?value.includes(row[key]):row[key]===value));
   if(range)rows=rows.slice(range[0],range[1]+1);
   return {data:single?rows[0] || null:rows,error:null};
  }
  return query;
 }};
 return {client:client as unknown as SupabaseClient,reads};
}
async function run(){
 const email="affiliate@example.test",offer={id:"offer",title:"Own brand"};
 const paid={id:"a",offer_id:"offer",affiliate_email:email,status:"pending",created_at:"2026-10-09T00:00:00Z"};
 const tables={offers:[offer],ad_ideas:[paid,{...paid,id:"b",status:"viewed",business_viewed_at:"2026-10-09T01:00:00Z"},{...paid,id:"foreign",affiliate_email:"other@example.test"}],organic_posts:[{...paid,id:"c"}]};
 const list=await loadAffiliateSubmissions(fixture(tables).client,email);
 assert.equal(list.filter(row=>isAwaitingProposalReview(row.status)).length,3);
 assert.equal(list.filter(row=>row.businessViewedAt).length,1);
 assert.equal(list[0].offerTitle,"Own brand");
 for(const status of ["approved","active","accepted","live","rejected","changes_requested"])assert.equal(isAwaitingProposalReview(status),false,status);
 assert.equal(isAwaitingProposalReview(" VIEWED "),true);
 await assert.rejects(loadAffiliateSubmissions(fixture(tables,"organic_posts").client,email),/fixture query failed/);
 const many=fixture({...tables,ad_ideas:Array.from({length:501},(_,i)=>({...paid,id:String(i)})),organic_posts:[]});
 assert.equal((await loadAffiliateSubmissions(many.client,email)).length,501);
 assert.equal(many.reads.filter(read=>read.table==="ad_ideas").length,2);
 const approved=fixture({offers:[{id:"one"},{id:"two"}],affiliate_requests:[
  {affiliate_email:email,offer_id:"one",status:"approved"},{affiliate_email:email,offer_id:"one",status:"active"},
  {affiliate_email:email,offer_id:"two",status:"accepted"},{affiliate_email:email,offer_id:"removed",status:"approved"},
  {affiliate_email:email,offer_id:"pending",status:"pending"}
 ]});
 assert.deepEqual(await loadApprovedOfferIds(approved.client,email),["one","two"]);
 assert.equal(["ACTIVE","live","pending","paused","ARCHIVED","ended"].filter(status=>!isArchivedCampaignStatus(status)).length,3);
 const detailed=fixture({...tables,ad_ideas:[{...paid,headline:"Saved headline",caption:"Saved copy",budget_amount:2500,daily_budget:99,manual_placements:["facebook_feed"]}]});
 const proposal=await loadProposalDetails(detailed.client,email,"paid","a");
 assert.equal(proposal?.budget,25,"Convert saved minor units only once");
 assert.equal(proposal?.headline,"Saved headline");
 assert.deepEqual(proposal?.placements,["facebook_feed"]);
 assert.ok(detailed.reads[0].filters.some(([key,value])=>key==="affiliate_email" && value===email));
 assert.equal(await loadProposalDetails(fixture(tables).client,email,"paid","foreign"),null);
 const organic=await loadProposalDetails(fixture(tables).client,email,"organic","c");
 assert.equal(organic?.budget,null);
 assert.equal(organic?.cta,null);
 const url="https://everbond.ca/products/"+"long-product-name-".repeat(40)+"?variant=123&utm_source=nettmark#details";
 assert.equal(normalizeOfferDestination(url),url);
 assert.equal(normalizeOfferDestination("  housedesk.co.uk  "),"https://housedesk.co.uk/");
 for(const invalid of ["javascript:alert(1)","https://a.test/has a space","https://username:password@a.test",""])assert.equal(normalizeOfferDestination(invalid),null);
 assert.equal(getOfferPayoutTypeLabel({type:"one-time"}),"One Time");
 assert.equal(getOfferPayoutTypeLabel({}),null);
 for(const currency of ["AUD","USD","GBP"])assert.ok(formatMoney(12.5,currency).includes(currency) && formatMoney(12.5,currency).endsWith("12.50"));
 assert.match(formatMoney(12.5,null),/currency not set/);
 const now=Date.now(),user={id:"own",email} as User,fresh={user,expires_at:Math.floor(now/1000)+3600} as Session;
 function authFixture(options:{expired?:boolean;failRefresh?:boolean;invalidUser?:boolean;otherUser?:boolean}={}){
  let refreshes=0,checks=0;
  const client={auth:{
   getSession:async()=>({data:{session:options.expired?{...fresh,expires_at:Math.floor(now/1000)-1}:fresh},error:null}),
   refreshSession:async()=>{refreshes++;return {data:{session:options.failRefresh?null:fresh},error:options.failRefresh?new Error("bad refresh"):null};},
   getUser:async()=>{checks++;return {data:{user:options.invalidUser && checks===1?null:options.otherUser?{...user,id:"other"}:user},error:null};}
  }} as unknown as Pick<SupabaseClient,"auth">;
  return {client,counts:()=>({refreshes,checks})};
 }
 const expired=authFixture({expired:true});await ensureSubmissionSession(expired.client,"own",now);assert.deepEqual(expired.counts(),{refreshes:1,checks:1});
 const rejected=authFixture({invalidUser:true});await ensureSubmissionSession(rejected.client,"own",now);assert.deepEqual(rejected.counts(),{refreshes:1,checks:2});
 await assert.rejects(ensureSubmissionSession(authFixture({expired:true,failRefresh:true}).client,"own",now),SubmissionSessionError);
 await assert.rejects(ensureSubmissionSession(authFixture({otherUser:true}).client,"own",now),/account that created this draft/);
 console.log("Affiliate QA counts/pagination/errors, proposal ownership/units, complete URLs/currencies and session refresh/failure/account isolation passed");
}
run().catch(error=>{console.error(error);process.exitCode=1;});

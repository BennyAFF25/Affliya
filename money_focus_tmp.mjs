import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).filter(Boolean).filter(l=>!l.trim().startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('='); return [l.slice(0,i), l.slice(i+1)];}));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
async function one(name, p){ const {data,error}=await p; if(error) throw new Error(name+': '+error.message); return data; }
const payoutId='bbcc7d08-13a3-4478-9a51-ed70a78506c6';
const eventId='a7c0355b-776e-43d5-a7df-febca20d102e';
const liveAdId='89783681-a2a5-4389-a150-10fe47826651';
const sessionId='cs_test_a1FQg6mN3Ix7JY3gkxy5w7mtdvCA39vUlghzx88rzrSfB7361hnd9Ij3cs';
const out={};
out.payout = await one('payout', supabase.from('wallet_payouts').select('*').eq('id', payoutId).maybeSingle());
out.auditForPayout = await one('auditForPayout', supabase.from('money_flow_audit_log').select('*').or(`payout_id.eq.${payoutId},entity_id.eq.${payoutId}`).order('created_at',{ascending:false}));
out.event = await one('event', supabase.from('campaign_tracking_events').select('*').eq('id', eventId).maybeSingle());
out.processed = await one('processed', supabase.from('processed_conversions').select('*').eq('event_id',eventId).maybeSingle());
out.liveAd = await one('liveAd', supabase.from('live_ads').select('*').eq('id', liveAdId).maybeSingle());
out.deductionForLiveAd = await one('deductionForLiveAd', supabase.from('wallet_deductions').select('*').eq('ad_id', liveAdId).order('created_at',{ascending:false}));
out.topupBySession = await one('topupBySession', supabase.from('wallet_topups').select('*').eq('stripe_id', sessionId));
out.auditTopupMentions = await one('auditTopupMentions', supabase.from('money_flow_audit_log').select('*').filter('metadata->>stripe_id','eq',sessionId).order('created_at',{ascending:false}));
console.log(JSON.stringify(out,null,2));

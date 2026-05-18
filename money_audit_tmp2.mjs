import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).filter(Boolean).filter(l=>!l.trim().startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('='); return [l.slice(0,i), l.slice(i+1)];}));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
async function one(name, p){ const {data,error}=await p; if(error) throw new Error(name+': '+error.message); return data; }
const out={};
out.auditRecent = await one('auditRecent', supabase.from('money_flow_audit_log').select('created_at,event_type,severity,reason_code,message,affiliate_email,business_email,payout_id,live_ad_id,metadata').order('created_at',{ascending:false}).limit(20));
out.topupsRecent = await one('topupsRecent', supabase.from('wallet_topups').select('created_at,affiliate_email,amount_gross,amount_net,amount_refunded,stripe_id,status,platform_acct_id').order('created_at',{ascending:false}).limit(20));
out.payoutsRecent = await one('payoutsRecent', supabase.from('wallet_payouts').select('created_at,id,affiliate_email,business_email,amount,status,source_event_id,cycle_number,stripe_payment_intent_id,stripe_charge_id,stripe_transfer_id,payout_error_code,payout_error_message').order('created_at',{ascending:false}).limit(20));
out.deductionsRecent = await one('deductionsRecent', supabase.from('wallet_deductions').select('created_at,id,affiliate_email,business_email,offer_id,ad_id,amount,description,settlement_before,settlement_after,settlement_key').order('created_at',{ascending:false}).limit(20));
out.refundsRecent = await one('refundsRecent', supabase.from('wallet_refunds').select('created_at,*').order('created_at',{ascending:false}).limit(20));
out.eventsRecent = await one('eventsRecent', supabase.from('campaign_tracking_events').select('created_at,id,event_type,affiliate_id,campaign_id,offer_id,amount').order('created_at',{ascending:false}).limit(20));
out.liveAdsRecent = await one('liveAdsRecent', supabase.from('live_ads').select('created_at,id,affiliate_email,business_email,offer_id,spend,spend_transferred,status').order('created_at',{ascending:false}).limit(20));
console.log(JSON.stringify(out,null,2));

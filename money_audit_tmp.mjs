import fs from 'fs';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).filter(Boolean).filter(l=>!l.trim().startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('='); return [l.slice(0,i), l.slice(i+1)];}));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
const stripe = new Stripe(env.STRIPE_SECRET_KEY);
const affiliateEmail='affiliate@testuser.com';
const businessEmail='biz@testuser.com';
async function one(name, p){ const {data,error}=await p; if(error) throw new Error(name+': '+error.message); return data; }
const out = {};
out.affiliateProfile = await one('affiliateProfile', supabase.from('affiliate_profiles').select('user_id,email,stripe_account_id,stripe_onboarding_complete').eq('email',affiliateEmail).maybeSingle());
out.businessProfile = await one('businessProfile', supabase.from('business_profiles').select('id,business_email,stripe_customer_id,stripe_account_id').eq('business_email',businessEmail).maybeSingle());
out.walletTopups = await one('walletTopups', supabase.from('wallet_topups').select('*').eq('affiliate_email',affiliateEmail).order('created_at',{ascending:false}).limit(10));
out.walletRefunds = await one('walletRefunds', supabase.from('wallet_refunds').select('*').eq('affiliate_email',affiliateEmail).order('created_at',{ascending:false}).limit(10));
out.walletDeductions = await one('walletDeductions', supabase.from('wallet_deductions').select('*').eq('affiliate_email',affiliateEmail).order('created_at',{ascending:false}).limit(10));
out.walletPayouts = await one('walletPayouts', supabase.from('wallet_payouts').select('*').eq('affiliate_email',affiliateEmail).order('created_at',{ascending:false}).limit(10));
out.audit = await one('audit', supabase.from('money_flow_audit_log').select('*').or(`affiliate_email.eq.${affiliateEmail},business_email.eq.${businessEmail}`).order('created_at',{ascending:false}).limit(30));
out.events = await one('events', supabase.from('campaign_tracking_events').select('*').eq('affiliate_id',affiliateEmail).order('created_at',{ascending:false}).limit(10));
out.liveAds = await one('liveAds', supabase.from('live_ads').select('*').eq('affiliate_email',affiliateEmail).order('created_at',{ascending:false}).limit(10));
out.walletRow = await one('wallets', supabase.from('wallets').select('*').eq('email',affiliateEmail).maybeSingle());
const sessions = await stripe.checkout.sessions.list({limit:30});
out.topupSessions = sessions.data.filter(s => (s.metadata?.nettmark_action||s.metadata?.purpose)==='wallet_topup' && (s.customer_email===affiliateEmail || s.metadata?.email===affiliateEmail)).map(s=>({id:s.id,status:s.status,payment_status:s.payment_status,created:s.created,payment_intent:s.payment_intent,metadata:s.metadata}));
for (const s of out.topupSessions) {
 if (typeof s.payment_intent === 'string' && s.payment_intent) {
  try { const pi = await stripe.paymentIntents.retrieve(s.payment_intent,{expand:['latest_charge.balance_transaction']}); s.pi_status=pi.status; s.latest_charge = typeof pi.latest_charge==='string'?pi.latest_charge:pi.latest_charge?.id; } catch(e) { s.pi_error=e.message; }
 }
}
try { const res = await stripe.customers.search({query:`email:'${businessEmail}'`}); out.businessStripeCustomers = res.data.map(c=>({id:c.id,email:c.email,livemode:c.livemode,created:c.created})); } catch(e) { out.businessStripeCustomersError=e.message; }
console.log(JSON.stringify(out,null,2));

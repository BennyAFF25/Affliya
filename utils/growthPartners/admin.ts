import type { SupabaseClient } from '@supabase/supabase-js';
import { referralEvent } from './events';
export async function reviewCommission(db: SupabaseClient, ledgerId: string, approve: boolean, reason: string, email: string) {
  const { error } = await db.rpc('review_creator_commission',{p_ledger_id:ledgerId,p_approve:approve,p_reason:reason,p_reviewed_by:email});
  if(error) throw new Error('Only pending commissions can be reviewed; approval requires the refund hold to have elapsed.');
}
export async function recordPartnerPayout(db: SupabaseClient, partnerId: string, ids: string[], reference: string, notes: string, email: string, method='manual_bank_transfer') {
  if(!ids.length || !reference.trim()) throw new Error('Select approved commissions and pending clawbacks, and enter a payment reference.');
  const {data,error}=await db.rpc('record_creator_partner_payout',{partner_id:partnerId,ledger_ids:[...new Set(ids)],method,reference:reference.trim().slice(0,500),notes:notes.slice(0,2000),recorded_by:email});
  if(error) throw new Error('Payout selection must belong to one partner, use one currency, contain approved commissions or pending clawbacks, and total more than zero.');
  return data;
}
export async function changePartnerStatus(db:SupabaseClient,id:string,suspend:boolean,reason:string,email:string) {
  const { data, error } = await db.from('creator_partners').update({status:suspend?'suspended':'active',suspended_at:suspend?new Date().toISOString():null,suspension_reason:suspend?reason.slice(0,2000):null}).eq('id',id).eq('program','growth_partner').in('status',suspend?['active']:['suspended']).select('id').maybeSingle();
  if(error) throw new Error('Partner status update failed');
  if(data) await referralEvent(db,id,suspend?'partner_suspended':'partner_reactivated',null,{reason:suspend?reason.slice(0,2000):null,reviewed_by:email});
}

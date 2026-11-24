import type { SupabaseClient } from '@supabase/supabase-js';
export async function referralEvent(db: SupabaseClient, partnerId: string, eventType: string, sourceKey: string | null, metadata: Record<string, unknown> = {}, businessId?: string) {
  const { error } = await db.from('creator_referral_events').insert({ creator_partner_id: partnerId, business_id: businessId || null, event_type: eventType, source_key: sourceKey, metadata });
  if (error && error.code !== '23505') throw new Error('Referral audit write failed');
}

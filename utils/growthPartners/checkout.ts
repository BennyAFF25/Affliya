import type { SupabaseClient } from '@supabase/supabase-js';
import { recordCreatorReferralSignupIntent } from '../creatorReferrals';
export async function growthPartnerCheckoutMetadata(db: SupabaseClient, cookieStore: Parameters<typeof recordCreatorReferralSignupIntent>[0]['cookieStore'], businessId: string, email: string, userId: string): Promise<Record<string, string>> {
  try {
    await recordCreatorReferralSignupIntent({ supabase: db, cookieStore, businessEmail: email, userId });
    const { data, error } = await db.from('business_creator_attributions').select('creator_partner_id,referral_code').eq('business_id', businessId).maybeSingle();
    if (error) throw new Error('Attribution read failed');
    return data ? { creator_partner_id: data.creator_partner_id, referral_code: data.referral_code } : {};
  } catch { console.warn('[growth-partners] Checkout attribution unavailable'); return {}; }
}

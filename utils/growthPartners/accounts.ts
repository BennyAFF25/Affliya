import { randomInt } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { growthOrigin, growthReferralUrl, sendGrowthEmail } from './email';
export const codeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generatePartnerCode() { return Array.from({ length: 8 }, () => codeAlphabet[randomInt(codeAlphabet.length)]).join(''); }
export async function withUniquePartnerCode<T>(insert: (code: string) => Promise<{ data: T; error: { code?: string } | null }>, generate = generatePartnerCode) {
  for (let attempt=0; attempt<8; attempt++) {
    const result = await insert(generate());
    if (!result.error) return result.data;
    if (result.error.code !== '23505') throw new Error('Partner activation failed');
  }
  throw new Error('Could not allocate referral code');
}
export async function getGrowthPartnerForUser(db: SupabaseClient, userId: string) {
  const { data, error } = await db.from('creator_partners').select('*').eq('user_id', userId).eq('program', 'growth_partner').maybeSingle();
  if (error) throw new Error('Partner lookup failed');
  return data;
}
export async function approveApplication(db: SupabaseClient, applicationId: string, reviewedBy: string) {
  const { data: application, error } = await db.from('growth_partner_applications').select('*').eq('id', applicationId).single();
  if (error || !application) throw new Error('Application missing');
  if (application.status === 'approved') return application.creator_partner_id;
  if (application.status !== 'pending') throw new Error('Application is not pending');
  const lookup = await db.rpc('growth_partner_auth_user_id', { p_email: application.email });
  if (lookup.error) throw new Error('Auth identity lookup failed');
  let userId = lookup.data as string | null;
  if (!userId) {
    const created = await db.auth.admin.createUser({ email: application.email, email_confirm: true, app_metadata: { growth_partner: true } });
    if (created.error) {
      // Concurrent approval or an interrupted prior attempt may have created the identity.
      const retry = await db.rpc('growth_partner_auth_user_id', { p_email: application.email });
      if (retry.error || !retry.data) throw new Error('Auth identity could not be provisioned');
      userId = retry.data;
    } else userId = created.data.user.id;
  }
  const partnerId = await withUniquePartnerCode(async code => db.rpc('approve_growth_partner_application', { p_application_id: applicationId, p_user_id: userId, p_code: code, p_origin: growthOrigin(), p_reviewed_by: reviewedBy }));
  const { data: partner, error: partnerError } = await db.from('creator_partners').select('referral_url,referral_code').eq('id', partnerId).single();
  if (partnerError) throw new Error('Activated partner lookup failed');
  const referralUrl = growthReferralUrl(partner) || partner.referral_url;
  await sendGrowthEmail(application.email, 'Your Nettmark Growth Partner application is approved', { heading: 'Welcome to the programme', body: `Start referring businesses with your link: ${referralUrl}\n\nEarn 50% of eligible subscription revenue, excluding GST, for the first three successful paid monthly periods. Commissions are reviewed after a 14-day hold; payouts require admin approval.`, rows: [{ label: 'Referral link', value: referralUrl, href: referralUrl }], cta: { label: 'Sign in', href: `${growthOrigin()}/growth-partners/login` } });
  return partnerId;
}

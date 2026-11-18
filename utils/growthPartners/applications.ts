import { growthEmailContent } from './emailContent';
import { createHash, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { checkoutMatching, hashMeta, sendMetaWebsiteEvent, type MetaWebsitePayload } from '../marketing/startTrial';
import { productionCapiEnabled } from '../marketing/startTrialServer';
import { NETTMARK_META_PIXEL_ID } from '../marketing/metaConfig';
import { sendGrowthEmail, growthOrigin } from './email';
export const categories = ['creator','educator','media_buyer','agency','consultant','accountant_or_advisor','other'];
export const audiences = ['<1k','1k-10k','10k-50k','50k-250k','250k+'];
export function ipHash(req: Request) {
  const salt = process.env.GROWTH_PARTNER_IP_HASH_SALT || process.env.RATE_LIMIT_SECRET;
  const ip = req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return salt && ip ? createHash('sha256').update(`${salt}:${ip}`).digest('hex') : null;
}
export function validateApplication(input: Record<string, unknown>) {
  const value = (key: string, limit: number) => typeof input[key] === 'string' ? (input[key] as string).trim().slice(0, limit) : '';
  const email = value('email', 254).toLowerCase(), full_name = value('full_name', 160), category = value('category', 40), profile_url = value('profile_url', 1000), audience_estimate = value('audience_estimate', 40);
  let validUrl = false;
  try { validUrl = ['https:', 'http:'].includes(new URL(profile_url).protocol); } catch { /* invalid */ }
  if (!full_name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !categories.includes(category) || !audiences.includes(audience_estimate) || !validUrl) throw new Error('Please complete all fields with valid details.');
  return { email, full_name, category, profile_url, audience_estimate };
}
export function leadPayload(eventId: string, email: string, req: Request): MetaWebsitePayload {
  return { event_name: 'Lead', event_id: eventId, event_time: Math.floor(Date.now()/1000), action_source: 'website', event_source_url: `${growthOrigin()}/growth-partners/apply`, user_data: { em: [hashMeta(email.trim().toLowerCase())], ...checkoutMatching(req) } };
}
export async function submitGrowthApplication(db: SupabaseClient, input: Record<string, unknown>, req: Request, sendLead = sendMetaWebsiteEvent) {
  const fields = validateApplication(input);
  const attribution: Record<string, string> = {};
  if (input.attribution && typeof input.attribution === 'object') for (const [key, value] of Object.entries(input.attribution)) {
    if ((/^utm_/.test(key) || ['fbclid','landing_referrer'].includes(key)) && typeof value === 'string') attribution[key.slice(0,50)] = value.slice(0,500);
  }
  const eventId = `growth_lead_${randomUUID()}`;
  const { data, error } = await db.from('growth_partner_applications').insert({ ...fields, meta_event_id: eventId, attribution, ip_hash: ipHash(req), user_agent: req.headers.get('user-agent')?.slice(0,500) || null }).select('id').single();
  if (error?.code === '23505') return { ok: true, duplicate: true };
  if (error || !data) throw new Error('Application could not be saved. Please try again.');
  let status = process.env.VERCEL_ENV === 'production' ? 'skipped_configuration' : 'skipped_non_production';
  if (productionCapiEnabled()) {
    try {
      const result = await sendLead({ payload: leadPayload(eventId, fields.email, req), token: process.env.META_CAPI_ACCESS_TOKEN!, pixelId: NETTMARK_META_PIXEL_ID });
      status = result.ok ? 'sent' : 'failed';
    } catch { status = 'failed'; }
  }
  const { error: statusError } = await db.from('growth_partner_applications').update({ meta_capi_status: status }).eq('id', data.id);
  if (statusError) console.warn('[growth-partners] Lead status update failed');
  await sendGrowthEmail(fields.email, 'Your Nettmark Growth Partner application', growthEmailContent.received());
  if (process.env.ADMIN_NOTIFY_EMAIL) await sendGrowthEmail(process.env.ADMIN_NOTIFY_EMAIL, 'New Growth Partner application', growthEmailContent.adminNotify(`${growthOrigin()}/internal/growth-partners`));
  return { ok: true, event_id: eventId };
}

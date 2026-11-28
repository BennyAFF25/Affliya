import { growthEmailContent } from './emailContent';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthLimiter } from '../auth/rateLimit';
import type { sendGrowthEmail } from './email';
export const loginResponse = { ok: true, message: 'If you have a Growth Partner account, a sign-in link will arrive shortly.' };
export function createGrowthLoginHandler(deps: { limit: AuthLimiter; admin: () => SupabaseClient; send: typeof sendGrowthEmail }) {
  return async (req: Request) => {
    try {
      const body = await req.json();
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0,254) : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !await deps.limit(req, 'reset', email)) return Response.json(loginResponse);
      const db = deps.admin();
      const { data: partner, error } = await db.from('creator_partners').select('user_id').eq('program','growth_partner').eq('partner_email',email).in('status',['active','suspended']).maybeSingle();
      if (error || !partner?.user_id) return Response.json(loginResponse);
      const { data: identity, error: identityError } = await db.auth.admin.getUserById(partner.user_id);
      if (identityError || identity.user?.email?.toLowerCase() !== email) return Response.json(loginResponse);
      const { data, error: linkError } = await db.auth.admin.generateLink({ type: 'magiclink', email });
      const token = data?.properties?.hashed_token;
      if (!linkError && token) await deps.send(email, 'Sign in to Nettmark Growth Partners', growthEmailContent.magicLink(`${new URL(req.url).origin}/growth-partners/auth/confirm?token_hash=${encodeURIComponent(token)}&type=magiclink`));
    } catch { console.warn('[growth-partners] Sign-in request unavailable'); }
    return Response.json(loginResponse);
  };
}

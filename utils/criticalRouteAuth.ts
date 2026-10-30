import type { SupabaseClient } from '@supabase/supabase-js';

export type CriticalRoute = 'business-connect' | 'affiliate-connect' | 'refund' | 'payout' | 'control-ad';
type User = { id: string; email?: string | null };
type Dependencies = {
  getUser: (req: Request) => Promise<User | null>;
  trusted: (req: Request) => boolean;
  database: () => Pick<SupabaseClient, 'from'>;
};
const emailKey = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : '';

// Keep privileged work behind one boundary; dependencies are injectable for offline tests.
export function withCriticalRouteAuth(route: CriticalRoute, work: (req: Request) => Promise<Response>, deps: Dependencies) {
  return async (req: Request): Promise<Response> => {
    try {
      if (deps.trusted(req)) return work(req);
      // Explicit internal credentials must never fall back to a browser session.
      if (req.headers.has('x-cron-secret')) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const user = await deps.getUser(req);
      if (!user?.id || !user.email) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await req.clone().json().catch(() => ({}));
      const denied = () => Response.json({ error: 'Forbidden' }, { status: 403 });
      const db = deps.database();
      const lookup = async (table: string, column: string, value: unknown) => {
        const result = await db.from(table).select('*').eq(column, value).maybeSingle();
        if (result.error) throw new Error('Ownership lookup failed');
        return result.data;
      };
      // Legacy business profiles may have an id that differs from the auth user id;
      // the profile matched by the verified session email is also owned.
      const businessIds = new Set<unknown>([user.id]);
      if (route === 'business-connect' || route === 'payout' || route === 'control-ad') {
        const owned = await lookup('business_profiles', 'business_email', emailKey(user.email));
        if (owned?.id) businessIds.add(owned.id);
      }
      const ownsBusiness = (row: Record<string, unknown>) => row.business_id
        ? businessIds.has(row.business_id)
        : emailKey(row.business_email) === emailKey(user.email);
      const ownsAffiliate = (row: Record<string, unknown>) => row.affiliate_user_id
        ? row.affiliate_user_id === user.id
        : emailKey(row.affiliate_email) === emailKey(user.email);

      if (route === 'business-connect' || route === 'affiliate-connect' || route === 'refund') {
        const requestedEmail = body.email || (route === 'business-connect' ? body.businessEmail || body.userEmail : undefined);
        if (requestedEmail && emailKey(requestedEmail) !== emailKey(user.email)) return denied();
        if (route === 'affiliate-connect' && body.user_id && body.user_id !== user.id) return denied();
        body.email = user.email;
        if (route === 'business-connect') {
          const profile = await lookup('business_profiles', 'business_email', emailKey(user.email));
          if (!profile) {
            const identity = await lookup('profiles', 'id', user.id);
            if (identity?.role !== 'business') return denied();
          }
          const account = body.stripe_account_id || body.accountId;
          if (account && account !== profile?.stripe_account_id) return denied();
        } else {
          const profile = await lookup('affiliate_profiles', 'user_id', user.id);
          if (profile) {
            if (emailKey(profile.email) !== emailKey(user.email)) return denied();
          } else {
            // Onboarding already supports creating the caller's missing profile.
            const identity = route === 'affiliate-connect' ? await lookup('profiles', 'id', user.id) : null;
            if (identity?.role !== 'affiliate') return denied();
          }
          if (route === 'affiliate-connect') body.user_id = user.id;
          if (route === 'refund' && body.stripe_charge_id) {
            const topup = await lookup('wallet_topups', 'stripe_id', body.stripe_charge_id);
            if (!topup || !ownsAffiliate(topup)) return denied();
          } else if (route === 'refund') {
            // The legacy refund handler chooses a top-up by email. Verify that
            // none of those candidates has an authoritative conflicting owner.
            const { data: topups, error } = await db.from('wallet_topups')
              .select('affiliate_user_id, affiliate_email').eq('affiliate_email', user.email);
            if (error) throw new Error('Ownership lookup failed');
            if ((topups || []).some(topup => !ownsAffiliate(topup))) return denied();
          }
        }
      } else if (route === 'payout') {
        if (!body.payout_id) return Response.json({ error: 'payout_id required' }, { status: 400 });
        {
          const payout = await lookup('wallet_payouts', 'id', body.payout_id);
          if (!payout || !ownsBusiness(payout)) return denied();
        }
      } else {
        if (!body.liveAdId) return Response.json({ error: 'liveAdId required' }, { status: 400 });
        {
          const ad = await lookup('live_ads', 'id', body.liveAdId);
          if (!ad) return denied();
          const business = ownsBusiness(ad);
          if (!business && !ownsAffiliate(ad)) return denied();
          body.actor = business ? 'business' : 'affiliate';
        }
        body.skipSettlement = false;
      }
      return work(new Request(req, { body: JSON.stringify(body) }));
    } catch {
      return Response.json({ error: 'Authorization verification failed' }, { status: 500 });
    }
  };
}

// Session-only ownership boundary for offer deletion; never accepts cron credentials.
export async function authorizeOfferDeletion(req: Request, offerId: string, deps: Omit<Dependencies, 'trusted'>) {
  const user = await deps.getUser(req);
  if (!user?.id || !user.email) return { response: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
  const db = deps.database();
  const offer = await db.from('offers').select('*').eq('id', offerId).maybeSingle();
  if (offer.error) throw new Error('Offer lookup failed');
  if (!offer.data) return { response: Response.json({ error: 'Offer not found' }, { status: 404 }) };
  const profile = await db.from('business_profiles').select('id').eq('business_email', emailKey(user.email)).maybeSingle();
  if (profile.error) throw new Error('Ownership lookup failed');
  const row = offer.data;
  const owns = row.business_id === user.id || (!!profile.data?.id && row.business_id === profile.data.id)
    || emailKey(row.business_email) === emailKey(user.email);
  if (!owns) return { response: Response.json({ error: 'Forbidden' }, { status: 403 }) };
  return { offer: row, user };
}

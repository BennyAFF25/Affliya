import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../utils/businessSubscriptions';
import { captureCreatorReferral, findActiveCreatorPartnerByCode, CREATOR_REFERRAL_COOKIE } from '../../../utils/creatorReferrals';
import { referralEvent } from '../../../utils/growthPartners/events';
import { ipHash } from '../../../utils/growthPartners/applications';
import { isLikelyAutomatedVisit } from '../../../utils/tracking/visitMetrics';
import { randomUUID } from 'node:crypto';
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const source = new URL(req.url), target = new URL('/for-businesses', source.origin);
  for (const [key,value] of source.searchParams) if (/^utm_/.test(key) || key === 'fbclid') target.searchParams.set(key,value.slice(0,500));
  const response = NextResponse.redirect(target,307);
  response.headers.set('X-Robots-Tag','noindex, nofollow');
  response.headers.set('Cache-Control','private, no-store');
  if (isLikelyAutomatedVisit(req.headers.get('user-agent'))) return response;
  try {
    const db = createServerSupabaseClient();
    const { code } = await params;
    const requestedPartner = await findActiveCreatorPartnerByCode({supabase:db,referralCode:code});
    if (!requestedPartner) return response;
    const raw = (req.headers.get('cookie') || '').split(';').find(p => p.trim().startsWith(`${CREATOR_REFERRAL_COOKIE}=`))?.trim().slice(CREATOR_REFERRAL_COOKIE.length+1);
    const result = await captureCreatorReferral({ supabase: db, referralCode: code, cookieStore: { get: () => ({ value: raw ? decodeURIComponent(raw) : '' }), set: (name,value,options) => response.cookies.set(name,value,options) }, landingPath: source.pathname, landingReferrer: req.headers.get('referer')?.slice(0,500) });
    if (requestedPartner) {
      let host: string | null = null;
      try { host = new URL(req.headers.get('referer') || '').hostname; } catch { /* no referrer */ }
      await referralEvent(db,requestedPartner.id,'click',randomUUID(),{ landing_session_id: result.cookie?.landingSessionId || null, ip_hash: ipHash(req), user_agent: /Mobile/i.test(req.headers.get('user-agent') || '') ? 'mobile' : 'desktop', referrer_host: host, utm: Object.fromEntries(target.searchParams) });
    }
  } catch { console.warn('[growth-partners] Referral capture unavailable'); }
  return response;
}

import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

import { businessFunnelVersion, isTrialFirstBusinessFunnel } from '../../../../utils/businessOnboardingFunnel';

const PLAN_CHOICE_COOKIE = 'nettmark_business_plan_choice_v2';
const LEGACY_PLAN_CHOICE_COOKIE = 'nettmark_business_plan_choice';
const REDDIT_PIXEL_ID = 'a2_jpxi5jrkyvlx';

async function trackOnboardingOfferConversion(user: { id: string; email?: string | null }) {
  const token = process.env.REDDIT_CONVERSION_ACCESS_TOKEN;
  if (!token) return;

  const conversionId = `offer_onboarding_${user.id}_${Date.now()}`;

  try {
    const response = await fetch(
      `https://ads-api.reddit.com/api/v3/pixels/${REDDIT_PIXEL_ID}/conversion_events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            events: [
              {
                event_at: Date.now(),
                action_source: 'WEBSITE',
                event_source_url: 'https://www.nettmark.com/onboarding/for-business',
                type: {
                  tracking_type: 'CUSTOM',
                  custom_event_name: 'CreateOffer',
                },
                metadata: {
                  conversion_id: conversionId,
                },
                user: user.email ? { email: user.email.trim().toLowerCase() } : {},
              },
            ],
          },
        }),
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      console.error('[Reddit CAPI] Onboarding CreateOffer rejected', {
        status: response.status,
        body: await response.text().catch(() => ''),
      });
    }
  } catch (error) {
    console.error('[Reddit CAPI] Onboarding CreateOffer failed', error);
  }
}

export async function POST(req?: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user?.email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: profile, error: profileError } = await supabase.from('profiles')
    .select('role').eq('id', user.id).maybeSingle();
  if (profileError) return NextResponse.json({ error: 'Could not verify account role.' }, { status: 503 });
  if (!profile || !['affiliate', 'business'].includes(profile.role)) return NextResponse.json({ error: 'Invalid account role.' }, { status: 403 });

  let offer: { id: string } | null = null;
  let treatment = false;
  if (profile.role === 'business') {
    const body = await req?.json().catch(() => ({}));
    let offerQuery = supabase.from('offers').select('id').eq('business_email', user.email);
    if (body?.offerId) offerQuery = offerQuery.eq('id', String(body.offerId));
    const { data: ownedOffer, error: offerError } = await offerQuery.order('created_at', { ascending: true }).limit(1).maybeSingle();
    if (offerError || !ownedOffer) return NextResponse.json({ error: 'Your offer must be saved before continuing.' }, { status: 409 });
    offer = ownedOffer;
    const { data: signup, error: signupError } = await supabase.from('profiles').select('created_at').eq('id', user.id).maybeSingle();
    if (signupError) return NextResponse.json({ error: 'Could not verify onboarding. Your offer is saved; please retry.' }, { status: 503 });
    treatment = isTrialFirstBusinessFunnel(businessFunnelVersion(user.id, signup?.created_at || ''));
  }

  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_completed: true })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Affiliate completion records onboarding progress, never campaign activation,
  // a business CreateOffer conversion, or a business billing gate.
  if (profile.role === 'affiliate') return NextResponse.json({ ok: true });

  // This endpoint is called immediately after the onboarding offer insert succeeds.
  // Reddit tracking is best-effort and must never break onboarding completion.
  await trackOnboardingOfferConversion({ id: user.id, email: user.email });

  const { data: entitlement, error: entitlementError } = await supabase
    .from('business_entitlements')
    .select('billing_entry_mode')
    .eq('business_email', user.email)
    .limit(1)
    .maybeSingle();

  if (entitlementError || !entitlement) {
    return NextResponse.json({ error: 'Your offer is saved. Could not verify your next step; please retry.' }, { status: 503 });
  }

  // Only business completion loads the server helpers; affiliate completion stays unchanged.
  try {
    const { createServerSupabaseClient } = await import('../../../../utils/businessSubscriptions');
    const { recordBusinessFunnelEvent } = await import('../../../../utils/businessOnboardingServer');
    await recordBusinessFunnelEvent(createServerSupabaseClient(), {
      eventType: 'offer_published', businessId: user.id, email: user.email, offerId: offer?.id,
      meta: { source: 'business_onboarding', persisted_offer: true },
    });
  } catch { /* Analytics must never block a saved offer. */ }

  const isLegacyDeferred = entitlement?.billing_entry_mode === 'legacy_deferred';
  const response = NextResponse.json({
    ok: true,
    billingEntryMode: isLegacyDeferred ? 'legacy_deferred' : 'plan_choice',
    treatment: treatment && !isLegacyDeferred,
    offerId: offer?.id || null,
  });

  // Old accounts must never be surprised by the new post-offer pricing gate.
  // Clear the original cookie for everyone, then only issue the v2 gate cookie
  // to businesses that belong to the new plan-choice cohort.
  response.cookies.set(LEGACY_PLAN_CHOICE_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });

  if (isLegacyDeferred) {
    response.cookies.set(PLAN_CHOICE_COOKIE, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    });
  } else {
    response.cookies.set(PLAN_CHOICE_COOKIE, 'required', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24,
    });
  }

  return response;
}

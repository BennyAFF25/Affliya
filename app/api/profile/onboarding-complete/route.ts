import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

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

export async function POST() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_completed: true })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // This endpoint is called immediately after the onboarding offer insert succeeds.
  // Reddit tracking is best-effort and must never break onboarding completion.
  await trackOnboardingOfferConversion({ id: user.id, email: user.email });

  const { data: entitlement } = await supabase
    .from('business_entitlements')
    .select('billing_entry_mode')
    .eq('business_email', user.email)
    .limit(1)
    .maybeSingle();

  const isLegacyDeferred = entitlement?.billing_entry_mode === 'legacy_deferred';
  const response = NextResponse.json({
    ok: true,
    billingEntryMode: isLegacyDeferred ? 'legacy_deferred' : 'plan_choice',
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

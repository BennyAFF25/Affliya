import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const PLAN_CHOICE_COOKIE = 'nettmark_business_plan_choice_v2';
const LEGACY_PLAN_CHOICE_COOKIE = 'nettmark_business_plan_choice';

export async function POST() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_completed: true })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

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

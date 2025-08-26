import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const rawRole = (requestUrl.searchParams.get('role') || '').toLowerCase();
  const nextParam = requestUrl.searchParams.get('next');

  // In route handlers, cookies() is synchronous; pass it directly to Supabase
  const supabase = createRouteHandlerClient({ cookies });

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', requestUrl.origin));
  }

  // Exchange the code for a Supabase session (sets auth cookies)
  const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeErr) {
    console.error('[auth/callback] exchangeCodeForSession error:', exchangeErr);
    return NextResponse.redirect(new URL('/login?error=auth_failed', requestUrl.origin));
  }

  // At this point we should have a session; fetch the user + profile
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr) {
    console.error('[auth/callback] getUser error:', userErr);
  }

  let redirectRole: 'affiliate' | 'business' =
    rawRole === 'affiliate' || rawRole === 'partner' ? 'affiliate' : 'business';

  let post: string | undefined = undefined;

  if (user?.id) {
    // Prefer lookup by id (email can change / be null with some providers)
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('active_role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileErr) {
      console.error('[auth/callback] profile fetch error:', profileErr);
    }

    if (profile?.active_role) {
      // Existing user: let /auth-redirect make the final call; don't force create-account
      redirectRole = profile.active_role as 'affiliate' | 'business';
      post = nextParam || undefined; // only carry explicit next if provided
    } else {
      // New user: carry them to create-account with the intended role
      post = nextParam || `/create-account?role=${redirectRole}`;
    }
  } else {
    // No user after exchange (should be rare) – treat as new
    post = nextParam || `/create-account?role=${redirectRole}`;
  }

  // Build /auth-redirect URL with params (omit post if not set)
  const params = new URLSearchParams({ role: redirectRole });
  if (post) params.set('post', post);
  const dest = new URL(`/auth-redirect?${params.toString()}`, requestUrl.origin);
  return NextResponse.redirect(dest);
}
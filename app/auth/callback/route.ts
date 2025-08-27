// app/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const roleParam = (url.searchParams.get('role') || '').toLowerCase();
  const next = url.searchParams.get('next') || '';
  const role: 'business' | 'affiliate' | '' =
    roleParam === 'affiliate' || roleParam === 'partner'
      ? 'affiliate'
      : roleParam === 'business'
      ? 'business'
      : '';

  try {
    if (!code) {
      const back = new URL('/login', url.origin);
      if (role) back.searchParams.set('role', role);
      back.searchParams.set('error', 'missing_code');
      return NextResponse.redirect(back);
    }

    // MUST await cookies() in App Router per Next warnings
    const supabase = createRouteHandlerClient({ cookies });

    // Exchange the OAuth code for a Supabase session
    const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeErr) {
      const back = new URL('/login', url.origin);
      if (role) back.searchParams.set('role', role);
      back.searchParams.set('error', 'oauth_callback_failed');
      return NextResponse.redirect(back);
    }

    // Success → centralize redirect logic
    const dest = new URL('/auth-redirect', url.origin);
    if (role) dest.searchParams.set('role', role);
    if (next) dest.searchParams.set('next', next);

    return NextResponse.redirect(dest);
  } catch (err) {
    // Never 500 to the user; bounce to login with context
    const back = new URL('/login', url.origin);
    if (role) back.searchParams.set('role', role);
    back.searchParams.set('error', 'unexpected_failure');
    return NextResponse.redirect(back);
  }
}

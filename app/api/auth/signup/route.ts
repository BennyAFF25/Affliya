import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { roleReturnTo } from '../../../../utils/affiliate/onboarding';
import { PASSWORD_ERROR, validPassword, validUsername } from '../../../../utils/auth/credentials';

export async function POST(req: Request) {
  if (req.headers.get('origin') !== new URL(req.url).origin) return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!validPassword(body?.password)) return NextResponse.json({ error: PASSWORD_ERROR }, { status: 400 });
  const { email, password, options } = body;
  const role = options?.data?.role;
  const username = String(options?.data?.username || '').trim();
  if (!['affiliate', 'business'].includes(role) || !username || (role === 'affiliate' && !validUsername(username))) {
    return NextResponse.json({ error: 'Please enter a valid name or username.' }, { status: 400 });
  }
  if (typeof email !== 'string' || !email.trim()) return NextResponse.json({ error: 'Please enter an email.' }, { status: 400 });
  const redirect = new URL('/auth-redirect', req.url);
  // Keep selected offers/plans and attribution on confirmation fallback, without open redirects.
  try {
    const requested = new URL(options?.emailRedirectTo);
    const returnTo = roleReturnTo(requested.searchParams.get('returnTo'), role);
    if (returnTo) redirect.searchParams.set('returnTo', returnTo);
  } catch { /* No confirmation redirect intent supplied. */ }
  redirect.searchParams.set('role', role);
  // Use public Auth, retaining its rate limits, confirmation settings and profile trigger.
  const supabase = createRouteHandlerClient({ cookies });
  const { data, error } = await supabase.auth.signUp({ email, password, options: {
    emailRedirectTo: redirect.href,
    data: { role, username, ...(role === 'business' ? { business_plan_first_v2: true } : {}) },
  } });
  return NextResponse.json(error ? { error: error.message } : { data }, {
    status: error ? 400 : 200, headers: { 'Cache-Control': 'no-store' },
  });
}

import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  // ✅ Get the code param only
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  if (!code) {
    console.error('[auth-redirect] missing code');
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // ✅ Proper call
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('[auth-redirect] exchange error', error);
    return NextResponse.redirect(new URL('/login', req.url));
  }

  console.log('[auth-redirect] session', data.session);

  const role = url.searchParams.get('role');
  const post = url.searchParams.get('post');
  const dest =
    post || (role === 'affiliate' ? '/affiliate/dashboard' : '/business/dashboard');

  return NextResponse.redirect(new URL(dest, req.url));
}
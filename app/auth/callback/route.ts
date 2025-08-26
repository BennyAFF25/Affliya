import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const rawRole = (requestUrl.searchParams.get('role') || '').toLowerCase();
  const nextParam = requestUrl.searchParams.get('next');

  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(requestUrl.origin + '/login?error=auth_failed');
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let redirectRole = rawRole === 'affiliate' || rawRole === 'partner' ? 'affiliate' : 'business';
  let post;

  if (user && user.email) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('active_role')
      .eq('email', user.email)
      .single();

    if (profile && profile.active_role) {
      redirectRole = profile.active_role;
      post = nextParam || '/dashboard/onboarding';
    } else {
      post = nextParam || `/create-account?role=${redirectRole}`;
    }
  } else {
    post = nextParam || `/create-account?role=${redirectRole}`;
  }

  const redirectTo = `/auth-redirect?role=${redirectRole}&post=${encodeURIComponent(post)}`;

  return NextResponse.redirect(requestUrl.origin + redirectTo);
}
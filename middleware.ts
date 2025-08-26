import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  const { nextUrl } = req;
  const path = nextUrl.pathname;

  const protectedRoots = ['/affiliate', '/business'];
  const isProtected = protectedRoots.some(p => path.startsWith(p));
  const isOnboarding = path.startsWith('/onboarding/');
  if (!isProtected && !isOnboarding) return NextResponse.next();

  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const url = new URL('/login', req.url);
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  const { data: prof } = await supabase
    .from('profiles')
    .select('active_role, onboarding_completed')
    .eq('id', user.id)
    .maybeSingle();

  // If no role yet, push through create-account
  if (!prof?.active_role) {
    return NextResponse.redirect(new URL('/create-account', req.url));
  }

  // Force onboarding once
  if (!prof.onboarding_completed && !isOnboarding) {
    const dest = prof.active_role === 'affiliate' ? '/onboarding/for-partners' : '/onboarding/for-business';
    return NextResponse.redirect(new URL(dest, req.url));
  }

  // Role gate
  if (path.startsWith('/affiliate') && prof.active_role !== 'affiliate') {
    return NextResponse.redirect(new URL('/business/dashboard', req.url));
  }
  if (path.startsWith('/business') && prof.active_role !== 'business') {
    return NextResponse.redirect(new URL('/affiliate/dashboard', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/affiliate/:path*', '/business/:path*', '/onboarding/:path*'],
};
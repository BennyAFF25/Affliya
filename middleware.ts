// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED = [/^\/business/, /^\/affiliate/];
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasSb = req.cookies.has('sb-gpaccxkfvcxzzpilsjww-auth-token') || req.cookies.has('sb-access-token');

  // let auth + login + static pass through
  if (pathname.startsWith('/auth-redirect') || pathname.startsWith('/auth/callback') || pathname.startsWith('/login')) {
    return NextResponse.next();
  }

  // protect dashboards
  if (PROTECTED.some(rx => rx.test(pathname)) && !hasSb) {
    const url = new URL('/login', req.url);
    url.searchParams.set('next', pathname + search);
    // choose role bucket for nicer UX
    url.searchParams.set('role', pathname.startsWith('/affiliate') ? 'affiliate' : 'business');
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
export const config = { matcher: ['/((?!_next|favicon.ico|images|fonts|api).*)'] };
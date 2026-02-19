import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createMiddlewareClient from './utils/supabase/middleware-client';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient(req, res);

  // Refresh auth/session cookies on every matched request.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = req.nextUrl;
  const isProtected = pathname.startsWith('/affiliate') || pathname.startsWith('/business');

  if (isProtected && !user) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createMiddlewareClient from './utils/supabase/middleware-client';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient(req, res);

  // Refresh auth/session cookies on every matched request.
  await supabase.auth.getUser();

  // Important: do NOT hard-redirect here.
  // In some login transitions, middleware can briefly see no user before client cookies settle,
  // which causes a false redirect loop back to home.
  // We only refresh cookies here; page-level guards handle route access.
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createMiddlewareClient from './utils/supabase/middleware-client';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient(req, res);

  // Only refresh session for protected app areas to avoid interfering
  // with auth/login callback routes during cookie handoff.
  await supabase.auth.getUser();

  return res;
}

export const config = {
  matcher: ['/affiliate/:path*', '/business/:path*'],
};

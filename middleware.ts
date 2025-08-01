// middleware.ts

import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // Creates a Supabase client with cookie context
  const supabase = createMiddlewareClient({ req, res })
  await supabase.auth.getSession()

  return res
}

// ✅ Only run middleware for protected routes:
export const config = {
  matcher: ['/affiliate/:path*', '/business/:path*'],
}
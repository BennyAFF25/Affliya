// utils/supabase/middleware-client.ts
import { createServerClient } from '@supabase/ssr';
import { type NextRequest, type NextResponse } from 'next/server';

const createMiddlewareClient = (req: NextRequest, res: NextResponse) => {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (key: string) => req.cookies.get(key)?.value,
        set: (key: string, value: string, options: any) => {
          res.cookies.set(key, value, options);
        },
        remove: (key: string, options: any) => {
          res.cookies.set(key, '', { ...options, maxAge: 0 });
        },
      },
    }
  );
};

export default createMiddlewareClient;
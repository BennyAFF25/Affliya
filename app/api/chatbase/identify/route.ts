import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST() {
  const supabase = createRouteHandlerClient({ cookies: () => cookies() });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const secret = process.env.CHATBASE_IDENTITY_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Missing Chatbase secret' }, { status: 500 });
  }

  const token = jwt.sign(
    {
      user_id: user.id,
      email: user.email,
      role: user.user_metadata?.role ?? 'unknown',
    },
    secret,
    { expiresIn: '1h' }
  );

  return NextResponse.json({ token });
}
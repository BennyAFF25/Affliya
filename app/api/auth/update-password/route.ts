import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { authRateLimit } from '../../../../utils/auth/rateLimit';
import { AUTH_RETRY_MESSAGE, readAuthBody } from '../../../../utils/auth/request';
import { PASSWORD_ERROR, validPassword } from '../../../../utils/auth/credentials';

export async function POST(req: Request) {
  // Cookie-authenticated public client; never an admin password update.
  if (req.headers.get('origin') !== new URL(req.url).origin) return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
  if (!await authRateLimit(req, 'update')) return NextResponse.json({ error: AUTH_RETRY_MESSAGE }, { status: 429, headers: { 'Cache-Control': 'no-store' } });
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Please open a valid reset link or sign in.' }, { status: 401 });
  let body;
  try { body = await readAuthBody(req); } catch { return NextResponse.json({ error: 'Please enter valid details and try again.' }, { status: 400 }); }
  if (!validPassword(body?.password)) return NextResponse.json({ error: PASSWORD_ERROR }, { status: 400 });
  const { error } = await supabase.auth.updateUser({ password: body.password });
  return NextResponse.json(error ? { error: error.message } : { ok: true }, { status: error ? 400 : 200, headers: { 'Cache-Control': 'no-store' } });
}

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createServerSupabaseClient } from '../../../../utils/supabase/createServerClient';
export const dynamic = 'force-dynamic';
export async function GET() {
  const userClient = createRouteHandlerClient({ cookies });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user?.email) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  const client = createServerSupabaseClient();
  const accounts = await client.from('wallet_accounts').select('id').eq('owner_email', data.user.email).eq('currency', 'AUD');
  if (accounts.error) return NextResponse.json({ error: 'Holds unavailable' }, { status: 503 });
  const ids = (accounts.data || []).map((account: { id: string }) => account.id);
  if (!ids.length) return NextResponse.json({ holds: [] });
  const holds = await client.from('wallet_holds').select('id,original_currency,original_amount,amount_minor,launch_remaining_minor,fx_rate')
    .in('account_id', ids).eq('status', 'active');
  if (holds.error) return NextResponse.json({ error: 'Holds unavailable' }, { status: 503 });
  return NextResponse.json({ holds: holds.data });
}

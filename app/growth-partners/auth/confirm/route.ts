import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../utils/businessSubscriptions';
import { getGrowthPartnerForUser } from '../../../../utils/growthPartners/accounts';
import { growthOrigin } from '../../../../utils/growthPartners/email';
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const failure = () => NextResponse.redirect(`${growthOrigin()}/growth-partners/login?error=link`);
  if (!token || !['magiclink','email'].includes(type || '')) return failure();
  const auth = createRouteHandlerClient({ cookies });
  try {
    const { data, error } = await auth.auth.verifyOtp({ token_hash: token, type: type as 'magiclink' | 'email' });
    if (error || !data.user) return failure();
    const partner = await getGrowthPartnerForUser(createServerSupabaseClient(), data.user.id);
    if (!partner || !['active','suspended'].includes(partner.status)) { await auth.auth.signOut(); return failure(); }
    return NextResponse.redirect(`${growthOrigin()}/growth-partners/dashboard`);
  } catch { return failure(); }
}

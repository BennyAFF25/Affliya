import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { canAccessMarketingDashboard } from '../marketing/internalAccess';
import { createServerSupabaseClient } from '../businessSubscriptions';
import { getGrowthPartnerForUser } from './accounts';
export async function adminAccess() {
  const { data: { user } } = await createRouteHandlerClient({ cookies }).auth.getUser();
  if (!user) return { status: 401 as const };
  if (!canAccessMarketingDashboard(user.email)) return { status: 403 as const };
  return { status: 200 as const, email: user.email!, db: createServerSupabaseClient() };
}
export async function partnerAccess() {
  const auth = createRouteHandlerClient({ cookies });
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return null;
  const db = createServerSupabaseClient();
  const partner = await getGrowthPartnerForUser(db, user.id);
  return partner ? { db, user, partner } : null;
}

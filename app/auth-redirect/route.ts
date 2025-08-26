// app/auth-redirect/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

/**
 * Post-auth landing.
 * Query params:
 *  - role: "business" | "partner" (also supports legacy "type")
 *  - post: absolute path to continue to (e.g. "/onboarding/business")
 *
 * Behavior:
 *  - Upserts/merges role in `profiles`
 *  - If `post` provided → redirect there (after path normalization)
 *  - Else: first-time users → onboarding, returning users → dashboard
 */
export async function GET(req: NextRequest) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const url = new URL(req.url);

  // Read and normalize params
  const rawPost = url.searchParams.get('post') || '';
  const roleParam = (
    url.searchParams.get('role') ||
    url.searchParams.get('type') || // backwards compat
    ''
  ).toLowerCase();

  const normalizedRole: 'business' | 'affiliate' | '' =
    roleParam === 'business' ? 'business' : roleParam === 'partner' || roleParam === 'affiliate' ? 'affiliate' : '';

  // Map any legacy onboarding paths to current ones
  const normalizePath = (p: string) => {
    if (!p || !p.startsWith('/')) return '';
    // Map legacy to current
    if (p === '/onboarding/business') return '/onboarding/for-business';
    if (p === '/onboarding/partner') return '/onboarding/for-partners';
    if (p === '/create-account') {
      // If someone sent us back to create-account, choose role onboarding instead
      if (normalizedRole === 'business') return '/onboarding/for-business';
      if (normalizedRole === 'affiliate') return '/onboarding/for-partners';
    }
    return p;
  };

  const postParam = normalizePath(rawPost);

  // 1) Ensure a signed-in user exists
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  console.log('[auth-redirect] user check', { user, userErr });

  if (!user || userErr) {
    const fallbackRole = normalizedRole || 'business';
    const dest = new URL(`/create-account?role=${fallbackRole}`, req.url);
    return NextResponse.redirect(dest);
  }

  // 2) Read existing profile (if any)
  const { data: existing, error: profileErr } = await supabase
    .from('profiles')
    .select('email, roles, active_role, onboarding_completed')
    .eq('id', user.id)
    .maybeSingle();

  console.log('[auth-redirect] profile check', { existing, profileErr });

  const currentRoles: string[] = Array.isArray(existing?.roles) ? (existing!.roles as string[]) : [];
  let existingActive = (existing?.active_role as 'business' | 'affiliate' | null) || null;
  const existingOnboardingDone = Boolean(existing?.onboarding_completed);

  // Decide target role to persist (allow explicit switch via ?role=...)
  const computedRole: 'business' | 'affiliate' | '' =
    normalizedRole || existingActive || (currentRoles[0] as 'business' | 'affiliate' | undefined) || '';

  const nextRoles = computedRole
    ? Array.from(new Set([...(currentRoles || []), computedRole]))
    : currentRoles;

  // If caller explicitly asked for another role, update active_role now so redirect uses it
  const desiredActive = (normalizedRole || existingActive || '') as 'business' | 'affiliate' | '';
  if (normalizedRole && existingActive && normalizedRole !== existingActive) {
    existingActive = normalizedRole; // reflect the switch locally for routing below
  }

  await supabase.from('profiles').upsert(
    {
      id: user.id,
      email: user.email ?? existing?.email ?? '',
      roles: nextRoles,
      active_role: desiredActive || null,
    },
    { onConflict: 'id' }
  );

  // 4) Compute destination
  const onboardingFor = (r: 'business' | 'affiliate' | '') =>
    r === 'business' ? '/onboarding/for-business' : r === 'affiliate' ? '/onboarding/for-partners' : '/onboarding/role';
  const dashboardFor = (r: 'business' | 'affiliate' | '') =>
    r === 'business' ? '/business/dashboard' : r === 'affiliate' ? '/affiliate/dashboard' : '/';

  let destPath: string | undefined;

  if (existingActive) {
    if (existingOnboardingDone) {
      // Returning user with completed onboarding → always dashboard
      destPath = dashboardFor(existingActive);
    } else {
      // Returning but not completed onboarding → send to onboarding
      destPath = onboardingFor(existingActive);
    }
  } else {
    // Brand new user (no active role yet)
    destPath = postParam || onboardingFor(computedRole);
  }

  if (!destPath) destPath = '/login';

  console.log('[auth-redirect] deciding destination', {
    existingActive,
    existingOnboardingDone,
    activeRole: computedRole,
    postParam,
    destPath,
  });

  return NextResponse.redirect(new URL(destPath, req.url));
}
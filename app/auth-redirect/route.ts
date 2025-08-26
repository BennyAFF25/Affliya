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
  const supabase = createRouteHandlerClient({ cookies });
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

  if (!user || userErr) {
    const fallbackRole = normalizedRole || 'business';
    const dest = new URL(`/create-account?role=${fallbackRole}`, req.url);
    return NextResponse.redirect(dest);
  }

  // 2) Read existing profile (if any)
  const { data: existing } = await supabase
    .from('profiles')
    .select('email, roles, active_role')
    .eq('id', user.id)
    .maybeSingle();

  const currentRoles: string[] = Array.isArray(existing?.roles) ? (existing!.roles as string[]) : [];
  const existingActive = (existing?.active_role as 'business' | 'affiliate' | null) || null;

  // Decide active role to persist
  const activeRole: 'business' | 'affiliate' | '' =
    normalizedRole || existingActive || (currentRoles[0] as 'business' | 'affiliate' | undefined) || '';

  const nextRoles = activeRole
    ? Array.from(new Set([...(currentRoles || []), activeRole]))
    : currentRoles;

  // 3) Upsert profile
  await supabase.from('profiles').upsert(
    {
      id: user.id,
      email: user.email ?? existing?.email ?? '',
      roles: nextRoles,
      active_role: activeRole || existingActive || null,
    },
    { onConflict: 'id' }
  );

  // 4) Compute destination
  const onboardingFor = (r: 'business' | 'affiliate' | '') =>
    r === 'business' ? '/onboarding/for-business' : r === 'affiliate' ? '/onboarding/for-partners' : '/onboarding/role';
  const dashboardFor = (r: 'business' | 'affiliate' | '') =>
    r === 'business' ? '/business/dashboard' : r === 'affiliate' ? '/affiliate/dashboard' : '/';

  let destPath = '/';

  if (postParam) {
    // Honor explicit post target when present
    destPath = postParam;
  } else {
    const isFirstTime = !existingActive; // no active_role previously stored
    if (isFirstTime) {
      destPath = onboardingFor(activeRole);
    } else {
      destPath = dashboardFor(activeRole);
    }
  }

  return NextResponse.redirect(new URL(destPath, req.url));
}
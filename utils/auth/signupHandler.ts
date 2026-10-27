import { authJson, readAuthBody, validEmail, AUTH_RETRY_MESSAGE } from './request';
import { authRateLimit, type AuthLimiter } from './rateLimit';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { roleReturnTo } from '../affiliate/onboarding';
import { PASSWORD_ERROR, validPassword, validUsername } from './credentials';

export function createSignupHandler(deps: { limit: AuthLimiter; client: () => ReturnType<typeof createRouteHandlerClient> } = { limit: authRateLimit, client: () => createRouteHandlerClient({ cookies }) }) {
  return async function POST(req: Request) {
    if (req.headers.get('origin') !== new URL(req.url).origin) return authJson({ error: 'Invalid origin.' }, 403);
    let body;
    try { body = await readAuthBody(req); } catch { return authJson({ error: 'Please enter valid details and try again.' }, 400); }
    if (!validPassword(body?.password)) return authJson({ error: PASSWORD_ERROR }, 400);
    const { email, password, options } = body;
    const role = options?.data?.role;
    const username = String(options?.data?.username || '').trim();
    if (!['affiliate', 'business'].includes(role) || !username || (role === 'affiliate' && !validUsername(username))) {
      return authJson({ error: 'Please enter a valid name or username.' }, 400);
    }
    if (!validEmail(email)) return authJson({ error: 'Please enter a valid email address.' }, 400);
    if (!await deps.limit(req, 'signup', email)) return authJson({ error: AUTH_RETRY_MESSAGE }, 429);
    const redirect = new URL('/auth-redirect', req.url);
    // Keep selected offers/plans and attribution on confirmation fallback, without open redirects.
    try {
      const requested = new URL(options?.emailRedirectTo);
      const returnTo = roleReturnTo(requested.searchParams.get('returnTo'), role);
      if (returnTo) redirect.searchParams.set('returnTo', returnTo);
    } catch { /* No confirmation redirect intent supplied. */ }
    redirect.searchParams.set('role', role);
    // Use public Auth, retaining its rate limits, confirmation settings and profile trigger.
    try {
      const supabase = deps.client();
      const { data, error } = await supabase.auth.signUp({ email, password, options: {
        emailRedirectTo: redirect.href,
        data: { role, username, ...(role === 'business' ? { business_plan_first_v2: true } : {}) },
      } });
      return authJson(error ? { error: 'Unable to create an account. Please check your details, or try signing in or resetting your password.' } : { data }, error ? 400 : 200);
    } catch {
      return authJson({ error: 'Unable to create an account. Please check your details, or try signing in or resetting your password.' }, 400);
    }
  };
}

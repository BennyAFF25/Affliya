import 'server-only';
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

type Rpc = (name: string, args: { p_bucket: string; p_limit: number; p_window_seconds: number }) => PromiseLike<{ data: unknown; error: unknown }>;
export type AuthLimiter = (req: Request, scope: 'reset' | 'signup' | 'update', email?: string) => Promise<boolean>;
export function createAuthLimiter(deps: { rpc: Rpc; secret: () => string | undefined }): AuthLimiter {
  return async (req, scope, email) => {
    try {
      const secret = deps.secret();
      if (!secret) return false;
      const hash = (value: string) => createHmac('sha256', secret).update(value).digest('hex');
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip')?.trim() || 'unknown';
      const buckets: [string, number, number][] = [[`${scope}:ip:${hash(ip)}`, scope === 'reset' ? 5 : 10, scope === 'reset' ? 900 : 3600]];
      if (email) {
        const identity = hash(email.trim().toLowerCase());
        buckets.push([`${scope}:email:${identity}`, scope === 'reset' ? 3 : 5, scope === 'reset' ? 900 : 3600]);
        if (scope === 'reset') buckets.push([`reset:daily:${identity}`, 6, 86400]);
      }
      if (scope === 'reset') buckets.push(['reset:global', 200, 3600]);
      for (const [p_bucket, p_limit, p_window_seconds] of buckets) {
        const result = await deps.rpc('auth_rate_limit_hit', { p_bucket, p_limit, p_window_seconds });
        if (result.error || result.data !== true) return false;
      }
      return true;
    } catch { return false; }
  };
}
export const authRateLimit = createAuthLimiter({
  secret: () => process.env.RATE_LIMIT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY,
  rpc: async (name, args) => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Rate limiter unavailable');
    return await createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
      .rpc(name, args)
      .abortSignal(AbortSignal.timeout(3000));
  },
});
export function authLog(event: string, email: string, reason: string) {
  const secret = process.env.RATE_LIMIT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const prefix = secret ? createHmac('sha256', secret).update(email).digest('hex').slice(0, 12) : 'unavailable';
  console.warn('[auth]', { event, hash: prefix, reason });
}

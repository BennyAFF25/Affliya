import type { AuthError, SupabaseClient } from '@supabase/supabase-js';
import { clearAccountRoleCache } from '../affiliate/accountRole';
type SignOutResult = { error: AuthError | null };
const pending = new WeakMap<object, Promise<SignOutResult>>();
/** Stop timer-driven refresh and deduplicate clicks while preserving global sign-out. */
export function signOutSession(client: Pick<SupabaseClient, 'auth'>): Promise<SignOutResult> {
  const existing = pending.get(client.auth);
  if (existing) return existing;
  const result = (async () => {
    client.auth.stopAutoRefresh();
    try {
      const response = await client.auth.signOut();
      if (response.error) client.auth.startAutoRefresh();
      else clearAccountRoleCache();
      return response;
    } catch (error) {
      client.auth.startAutoRefresh();
      throw error;
    }
  })();
  pending.set(client.auth, result);
  void result.then(() => pending.delete(client.auth), () => pending.delete(client.auth));
  return result;
}

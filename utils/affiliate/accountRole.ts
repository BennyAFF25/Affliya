import { withProposalTimeout } from './proposalTimeout';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/pages-client';
// In-memory, user-scoped UX cache. API/RLS authorization remains authoritative.
const roles = new Map<string, { expires: number; result: Promise<string> }>();
export function clearAccountRoleCache() { roles.clear(); }
export function getAccountRole(userId: string): Promise<string> {
  const cached = roles.get(userId);
  if (cached && cached.expires > Date.now()) return cached.result;
  const result = (async () => {
    const { data, error } = await withProposalTimeout((supabase as unknown as SupabaseClient).from('profiles').select('role').eq('id', userId)
      .abortSignal(AbortSignal.timeout(5000)).maybeSingle(), 5000);
    if (error) throw error;
    const role = String(data?.role || '').trim().toLowerCase();
    if (!role) throw new Error('Account role is not ready');
    return role;
  })();
  roles.set(userId, { expires: Date.now() + 60000, result });
  void result.catch(() => { if (roles.get(userId)?.result === result) roles.delete(userId); });
  return result;
}

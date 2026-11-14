import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptToken, encryptToken } from './security';
import { refreshToken, type TokenPair } from './admin';

export function encryptedTokens(pair: TokenPair) {
  return { access_token_encrypted: encryptToken(pair.token), refresh_token_encrypted: encryptToken(pair.refreshToken),
    access_token_expires_at: pair.accessExpiresAt, refresh_token_expires_at: pair.refreshExpiresAt };
}
export const clearedTokens = { access_token_encrypted: null, refresh_token_encrypted: null, access_token_expires_at: null, refresh_token_expires_at: null };
// Coalesce refreshes in this process. Cross-process races use compare-and-swap below.
const refreshing = new Map<string, Promise<string>>();
export async function validAccessToken(admin: SupabaseClient, shop: string, businessId: string, request = fetch): Promise<string> {
  const key = `${shop}:${businessId}`;
  const existing = refreshing.get(key);
  if (existing) return existing;
  const operation = getToken(admin, shop, businessId, request);
  refreshing.set(key, operation);
  try { return await operation; } finally { if (refreshing.get(key) === operation) refreshing.delete(key); }
}
async function getToken(admin: SupabaseClient, shop: string, businessId: string, request: typeof fetch): Promise<string> {
  const { data: store, error } = await admin.from('shopify_stores')
    .select('id,status,installed_at,access_token_encrypted,refresh_token_encrypted,access_token_expires_at,refresh_token_expires_at')
    .eq('shop_domain', shop).eq('business_id', businessId).maybeSingle();
  if (error) throw new Error('database');
  if (!store || store.status !== 'connected' || !store.access_token_encrypted) throw new Error('reauth_required');
  const guarded = () => admin.from('shopify_stores').update({ ...clearedTokens, status: 'disconnected', pixel_status: 'inactive', updated_at: new Date().toISOString() })
    .eq('id', store.id).eq('business_id', businessId).eq('status', 'connected').eq('installed_at', store.installed_at).eq('access_token_encrypted', store.access_token_encrypted);
  if (!store.refresh_token_encrypted || !store.access_token_expires_at || !store.refresh_token_expires_at || Date.parse(store.refresh_token_expires_at) <= Date.now()) {
    const { data: cleared, error } = await guarded().select('id').maybeSingle();
    if (error) throw new Error('database');
    if (!cleared) return currentToken(admin, shop, businessId);
    throw new Error('reauth_required');
  }
  if (Date.parse(store.access_token_expires_at) > Date.now() + 60000) return decryptToken(store.access_token_encrypted);
  let pair: TokenPair;
  try { pair = await refreshToken(shop, decryptToken(store.refresh_token_encrypted), request); }
  catch (error) {
    if (error instanceof Error && error.message === 'reauth_required') {
      const { data: cleared, error: updateError } = await guarded().select('id').maybeSingle();
      if (updateError) throw new Error('database', { cause: error });
      if (!cleared) return currentToken(admin, shop, businessId);
    }
    throw error;
  }
  const { data: saved, error: saveError } = await admin.from('shopify_stores').update({ ...encryptedTokens(pair), updated_at: new Date().toISOString() })
    .eq('id', store.id).eq('business_id', businessId).eq('status', 'connected').eq('installed_at', store.installed_at)
    .eq('refresh_token_encrypted', store.refresh_token_encrypted).select('id').maybeSingle();
  if (saveError) throw new Error('database');
  if (!saved) {
    // A concurrent refresh/reinstall/disconnect won. Never use our unpersisted token pair.
    return currentToken(admin, shop, businessId);
  }
  return pair.token;
}

async function currentToken(admin: SupabaseClient, shop: string, businessId: string): Promise<string> {
  const { data: current, error } = await admin.from('shopify_stores')
    .select('status,access_token_encrypted,access_token_expires_at').eq('shop_domain', shop).eq('business_id', businessId).maybeSingle();
  if (error) throw new Error('database');
  if (current?.status !== 'connected' || !current.access_token_encrypted || Date.parse(current.access_token_expires_at) <= Date.now() + 60000) throw new Error('reauth_required');
  return decryptToken(current.access_token_encrypted);
}

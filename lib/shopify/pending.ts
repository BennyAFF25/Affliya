import type { SupabaseClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { nonce, stateSecret, type OAuthState } from './security';
import { encryptedTokens } from './tokens';
import type { TokenPair } from './admin';

export const PENDING_COOKIE = 'shopify_pending_install';
export const COMPLETE_PATH = '/business/shopify/complete';
export const PENDING_SECONDS = 3600;
export const pendingCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: PENDING_SECONDS };
export function pendingCookie(id: string): string {
  return `${id}.${createHmac('sha256', stateSecret()).update(`shopify-pending:${id}`).digest('base64url')}`;
}
export function pendingId(cookie: string | undefined): string {
  const [id, signature, extra] = (cookie || '').split('.');
  if (!id || !/^[\w-]{43}$/.test(id) || !signature || !/^[\w-]{43}$/.test(signature) || extra) throw new Error('pending_expired');
  const expected = pendingCookie(id).split('.')[1];
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error('pending_expired');
  return id;
}
export async function savePending(admin: SupabaseClient, state: OAuthState, pair: TokenPair & { scopes: string[] }) {
  const now = new Date().toISOString();
  const { error: cleanupError } = await admin.from('shopify_pending_installs').delete().lt('expires_at', now);
  if (cleanupError) throw new Error('database');
  const id = nonce();
  const { error } = await admin.from('shopify_pending_installs').insert({ id, shop_domain: state.shop,
    user_id: state.userId, business_id: state.businessId, ...encryptedTokens(pair), scopes: pair.scopes,
    expires_at: new Date(Date.now() + PENDING_SECONDS * 1000).toISOString() });
  if (error) throw new Error('database');
  return pendingCookie(id);
}
export async function takePending(admin: SupabaseClient, cookie: string | undefined, userId: string, businessId: string) {
  const id = pendingId(cookie);
  // Atomic one-use consumption; never return a grant twice across workers.
  const { data, error } = await admin.from('shopify_pending_installs').delete().eq('id', id).select('shop_domain,user_id,business_id,scopes,access_token_encrypted,refresh_token_encrypted,access_token_expires_at,refresh_token_expires_at,expires_at').maybeSingle();
  if (error) throw new Error('database');
  if (!data || Date.parse(data.expires_at) <= Date.now()) throw new Error('pending_expired');
  if (data.user_id !== null && (data.user_id !== userId || data.business_id !== businessId)) throw new Error('session_mismatch');
  return data;
}

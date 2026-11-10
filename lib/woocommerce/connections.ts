import { isUuid } from '../../utils/tracking/campaignIdentity';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authRateLimit } from '../../utils/auth/rateLimit';
import { requireBusiness, sameOrigin, json } from './server';
import { baseUrl, deliveryUrl, nonce, nonceHash, readBody, encrypt, decrypt, deriveKey } from './security';
import { normalizeStoreUrl, resolveStore } from './url';
import { storeRequest, wcRest } from './rest';
export const SAFE_COLUMNS = 'id,store_url,status,tracking_status,tracking_error,connected_at,disconnected_at,last_event_at,created_at,updated_at';
const checked = <T extends { error: unknown }>(result: T): T => { if (result.error) throw new Error('database'); return result; };
export async function disconnectStore(admin: SupabaseClient, store: { id: string; business_id: string; store_url: string; consumer_key_encrypted: string | null; consumer_secret_encrypted: string | null; webhook_ids: unknown }, rest = wcRest) {
  if (store.consumer_key_encrypted && store.consumer_secret_encrypted) {
    try {
      const key = decrypt(store.consumer_key_encrypted), secret = decrypt(store.consumer_secret_encrypted);
      for (const id of Array.isArray(store.webhook_ids) ? store.webhook_ids : []) {
        if (!/^\d+$/.test(String(id))) continue;
        try { await rest(store.store_url, `/webhooks/${id}?force=true`, key, secret, 'DELETE'); } catch { /* Merchant can revoke the API key manually. */ }
      }
    } catch { /* Redact credentials even if remote cleanup cannot run. */ }
  }
  checked(await admin.from('woocommerce_stores').update({ status: 'disconnected', tracking_status: 'inactive', tracking_error: null, consumer_key_encrypted: null, consumer_secret_encrypted: null, webhook_secret_encrypted: null, wc_key_id: null, webhook_ids: [], auth_nonce_hash: null, auth_expires_at: null, disconnected_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', store.id).eq('business_id', store.business_id));
}
export async function businessRoute(req: Request, action: 'connect' | 'status' | 'disconnect') {
  try {
    if (action !== 'status') sameOrigin(req);
    const { user, businessId, admin } = await requireBusiness();
    if (action === 'status') return json({ stores: checked(await admin.from('woocommerce_stores').select(SAFE_COLUMNS).eq('business_id', businessId)).data });
    if (!await authRateLimit(req, 'woocommerce', user.email)) return json({ error: 'rate_limited' }, 429);
    const body = JSON.parse((await readBody(req, 8192)).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_payload');
    if (action === 'disconnect') {
      if (!isUuid(body.storeId)) throw new Error('invalid_payload');
      const store = checked(await admin.from('woocommerce_stores').select('*').eq('id', body.storeId).eq('business_id', businessId).maybeSingle()).data;
      if (!store) return json({ error: 'store_unavailable' }, 404);
      await disconnectStore(admin, store); return json({ ok: true });
    }
    deriveKey(); // Fail before sending merchant to approve an unusable connection.
    if (typeof body.storeUrl !== 'string' || body.storeUrl.length > 2048) throw new Error('invalid_store_url');
    const storeUrl = normalizeStoreUrl(body.storeUrl); await resolveStore(storeUrl);
    let probe;
    try { probe = await storeRequest(storeUrl, '/wp-json/'); } catch { throw new Error('store_unreachable'); }
    if (probe.status !== 200) throw new Error('store_unreachable');
    if (!probe.data || typeof probe.data !== 'object' || !Array.isArray((probe.data as { namespaces?: unknown }).namespaces) || !(probe.data as { namespaces: unknown[] }).namespaces.includes('wc/v3')) throw new Error('not_woocommerce');
    const base = baseUrl(req); if (!base.startsWith('https://')) throw new Error('configuration');
    const token = nonce(), hash = nonceHash(token), now = new Date().toISOString();
    const old = checked(await admin.from('woocommerce_stores').select('id,business_id,status').eq('store_url', storeUrl).maybeSingle()).data;
    // Only a live connection blocks other businesses. Pending/disconnected rows can be re-claimed:
    // proof of ownership is the store admin approving the key, so an unapproved claim must not squat a URL.
    if (old?.status === 'connected') throw new Error(old.business_id === businessId ? 'already_connected' : 'store_already_connected');
    const pending = { business_id: businessId, store_url: storeUrl, status: 'pending', auth_nonce_hash: hash, auth_expires_at: new Date(Date.now() + 900000).toISOString(), tracking_status: 'inactive', tracking_error: null, updated_at: now };
    if (old) {
      const result = checked(await admin.from('woocommerce_stores').update(pending).eq('id', old.id).eq('business_id', old.business_id).neq('status', 'connected').select('id'));
      if (!result.data?.length) throw new Error('connection_changed');
    } else checked(await admin.from('woocommerce_stores').insert(pending)); // Unique URL prevents concurrent cross-business claims.
    const url = new URL(`${storeUrl}/wc-auth/v1/authorize`);
    url.search = new URLSearchParams({ app_name: 'Nettmark', scope: 'read_write', user_id: token, return_url: `${base}/business/my-business?woocommerce=returned`, callback_url: deliveryUrl(req, '/api/woocommerce/callback') }).toString();
    return json({ authorizeUrl: url.toString() });
  } catch (error) { return failure(error); }
}
export function failure(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  const allowed = ['unauthorized','forbidden','business_profile_required','invalid_store_url','store_unreachable','not_woocommerce','store_already_connected','already_connected','connection_changed','configuration','invalid_payload','invalid_callback','database'];
  const safe = allowed.includes(code) ? code : 'connection_failed';
  return json({ error: safe }, code === 'unauthorized' ? 401 : code === 'forbidden' ? 403 : ['database','configuration'].includes(code) ? 503 : 400);
}
export async function callback(req: Request, admin: SupabaseClient) {
  try {
    const v = JSON.parse((await readBody(req, 8192)).toString('utf8'));
    if (!v || typeof v.user_id !== 'string' || !/^[\w-]{43}$/.test(v.user_id) || v.key_permissions !== 'read_write' || !/^ck_[a-f0-9]{40}$/.test(v.consumer_key) || !/^cs_[a-f0-9]{40}$/.test(v.consumer_secret) || !Number.isSafeInteger(v.key_id) || v.key_id <= 0) throw new Error('invalid_callback');
    const hash = nonceHash(v.user_id);
    const store = checked(await admin.from('woocommerce_stores').select('id,store_url,business_id').eq('status', 'pending').eq('auth_nonce_hash', hash).gt('auth_expires_at', new Date().toISOString()).maybeSingle()).data;
    if (!store) throw new Error('invalid_callback');
    const keyEncrypted = encrypt(v.consumer_key), secretEncrypted = encrypt(v.consumer_secret), secret = nonce(), webhookSecret = encrypt(secret);
    await wcRest(store.store_url, '/webhooks?per_page=1', v.consumer_key, v.consumer_secret);
    const ids: number[] = []; let trackingError: string | null = null;
    try {
      for (const topic of ['order.created','order.updated']) {
        const result = await wcRest(store.store_url, '/webhooks', v.consumer_key, v.consumer_secret, 'POST', { name: 'Nettmark order tracking', topic, api_version: 'wp_api_v3', status: 'active', secret, delivery_url: deliveryUrl(req, `/api/woocommerce/webhooks?store=${store.id}`) }) as { id?: number };
        if (!Number.isSafeInteger(result?.id) || result.id! <= 0) throw new Error('webhook_creation_failed');
        ids.push(result.id!);
      }
    } catch { trackingError = 'webhook_creation_failed'; }
    const saved = checked(await admin.from('woocommerce_stores').update({ status: 'connected', wc_key_id: v.key_id, consumer_key_encrypted: keyEncrypted, consumer_secret_encrypted: secretEncrypted, webhook_secret_encrypted: webhookSecret, webhook_ids: ids, tracking_status: trackingError ? 'error' : 'active', tracking_error: trackingError, auth_nonce_hash: null, auth_expires_at: null, connected_at: new Date().toISOString(), disconnected_at: null, updated_at: new Date().toISOString() }).eq('id', store.id).eq('status', 'pending').eq('auth_nonce_hash', hash).gt('auth_expires_at', new Date().toISOString()).select('id'));
    if (!saved.data?.length) {
      for (const id of ids) try { await wcRest(store.store_url, `/webhooks/${id}?force=true`, v.consumer_key, v.consumer_secret, 'DELETE'); } catch { /* no secrets logged */ }
      throw new Error('connection_changed');
    }
    return json({ ok: true });
  } catch (error) { return failure(error); }
}

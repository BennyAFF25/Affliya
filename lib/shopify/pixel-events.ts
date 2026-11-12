import { createHmac } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { validShop } from './security';
import { resolveRuntimeCampaign } from '../../utils/tracking/campaignIdentity';
import { assertAffiliateOfferApproved } from '../../utils/approvals/enforcement';
import { quarantineBillableEvent } from '../../utils/tracking/quarantine';

export const MAX_PIXEL_BYTES = 8192;
const WINDOW_MS = 7 * 86400000;
type Item = { product_id: string | null; variant_id: string | null; quantity: number; line_total: number };
export type PixelPayload = {
  shop_domain: string; order_id: string; checkout_token: string | null; total_value: number;
  currency: string; nm_aff: string | null; nm_camp: string | null; nm_src: string | null;
  timestamp: string; line_items: Item[];
};
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_payload');
  return value as Record<string, unknown>;
}
function text(value: unknown, pattern: RegExp, max: number): string {
  if (typeof value !== 'string' || !value.length || value.length > max || !pattern.test(value)) throw new Error('invalid_payload');
  return value;
}
function optional(value: unknown, pattern: RegExp, max: number): string | null {
  return value == null || value === '' ? null : text(value, pattern, max);
}
function money(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e10) throw new Error('invalid_payload');
  return value;
}

export function parsePixelPayload(value: unknown, now = Date.now()): PixelPayload {
  const v = record(value);
  const shop = text(v.shop_domain, /^[a-z0-9.-]+$/, 255);
  if (!validShop(shop)) throw new Error('invalid_payload');
  const timestamp = text(v.timestamp, /^\d{4}-\d{2}-\d{2}T/, 40);
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time) || now - time > WINDOW_MS || time - now > 300000) throw new Error('invalid_payload');
  if (!Array.isArray(v.line_items) || v.line_items.length > 100) throw new Error('invalid_payload');
  const line_items = v.line_items.map(entry => {
    const item = record(entry);
    if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 100000) throw new Error('invalid_payload');
    return { product_id: optional(item.product_id, /^(?:gid:\/\/shopify\/Product\/)?\d+$/, 100), variant_id: optional(item.variant_id, /^(?:gid:\/\/shopify\/ProductVariant\/)?\d+$/, 100), quantity: item.quantity, line_total: money(item.line_total) };
  });
  // Construct every persisted/forwarded field explicitly. Unknown keys (including PII) are discarded recursively.
  return {
    shop_domain: shop, order_id: text(v.order_id, /^(?:gid:\/\/shopify\/Order\/)?\d+$/, 100),
    checkout_token: optional(v.checkout_token, /^[a-zA-Z0-9_-]+$/, 200), total_value: money(v.total_value),
    currency: text(v.currency, /^[A-Z]{3}$/, 3),
    nm_aff: v.nm_aff == null || v.nm_aff === '' ? null : text(v.nm_aff, /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i, 36),
    nm_camp: optional(v.nm_camp, /^(?:[a-f0-9-]{36}|\d+)$/i, 100),
    nm_src: optional(v.nm_src, /^[a-zA-Z0-9_-]+$/, 64), timestamp: new Date(time).toISOString(), line_items,
  };
}

type Rpc = (name: string, args: { p_bucket: string; p_limit: number; p_window_seconds: number }) => PromiseLike<{ data: unknown; error: unknown }>;
// Same fail-closed HMAC + atomic RPC approach as utils/auth/rateLimit; never retain/log raw IPs.
export function createPixelLimiter(rpc: Rpc, secret: () => string | undefined) {
  return async (req: Request, shop: string): Promise<boolean> => {
    try {
      const key = secret();
      if (!key) return false;
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
      const digest = createHmac('sha256', key).update(`${shop}:${ip}`).digest('hex');
      for (const [bucket, limit] of [[`shopify:ip-shop:${digest}`, 60], [`shopify:shop:${shop}`, 600]] as const) {
        const result = await rpc('auth_rate_limit_hit', { p_bucket: bucket, p_limit: limit, p_window_seconds: 60 });
        if (result.error || result.data !== true) return false;
      }
      return true;
    } catch { return false; }
  };
}
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Cache-Control': 'no-store' };
export function pixelOptions() { return new Response(null, { status: 204, headers }); }
export function createPixelEventsHandler(deps: {
  admin: () => SupabaseClient;
  limit: (req: Request, shop: string) => Promise<boolean>;
  process: (eventId: string) => Promise<unknown>;
  log?: (shop: string, outcome: string) => void;
}) {
  return async (req: Request): Promise<Response> => {
    let shop: string | null = null;
    const respond = (status: number, outcome: string, data: Record<string, unknown> = {}) => {
      if (shop) deps.log?.(shop, outcome);
      return Response.json(data, { status, headers });
    };
    try {
      const declared = Number(req.headers.get('content-length'));
      if (declared > MAX_PIXEL_BYTES) return respond(400, 'invalid_payload', { error: 'invalid_payload' });
      // Read incrementally: don't buffer an unbounded public request before checking size.
      const reader = req.body?.getReader();
      if (!reader) return respond(400, 'invalid_payload', { error: 'invalid_payload' });
      let size = 0;
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_PIXEL_BYTES) { await reader.cancel(); return respond(400, 'invalid_payload', { error: 'invalid_payload' }); }
        chunks.push(value);
      }
      let payload: PixelPayload;
      try { payload = parsePixelPayload(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { return respond(400, 'invalid_payload', { error: 'invalid_payload' }); }
      shop = payload.shop_domain;
      if (!await deps.limit(req, shop)) return respond(429, 'rate_limited', { error: 'rate_limited' });
      const admin = deps.admin();
      const { data: store, error: storeError } = await admin.from('shopify_stores').select('business_id,status,access_token_encrypted').eq('shop_domain', shop).maybeSingle();
      if (storeError) throw new Error('database');
      if (!store || store.status !== 'connected' || !store.access_token_encrypted) return respond(404, 'store_unavailable', { error: 'store_unavailable' });
      if (!payload.nm_aff || !payload.nm_camp) return respond(202, 'unattributed', { ok: true });
      const { data: profile, error: profileError } = await admin.from('profiles').select('email').eq('id', payload.nm_aff).eq('role', 'affiliate').maybeSingle();
      if (profileError) throw new Error('database');
      const campaign = await resolveRuntimeCampaign(admin as never, { campaignId: payload.nm_camp, affiliateEmail: profile?.email });
      if (!campaign) {
        await quarantineBillableEvent(admin as never, {
          sourceRoute: 'app/api/shopify/pixel-events', reasonCode: 'INVALID_BILLABLE_CAMPAIGN_IDENTITY',
          message: 'Shopify conversion could not resolve an exact runtime campaign.', eventType: 'conversion', rawCampaignId: payload.nm_camp,
          // Deliberately omit raw payload and identity values from quarantine.
        });
        return respond(202, 'identity_unresolved', { ok: true });
      }
      if (!profile?.email || campaign.affiliateEmail !== profile.email) return respond(202, 'affiliate_mismatch', { ok: true });
      const { data: runtimeOwner, error: runtimeOwnerError } = await admin.from(campaign.sourceTable).select('business_id').eq('id', campaign.campaignId).maybeSingle();
      if (runtimeOwnerError) throw new Error('database');
      if (runtimeOwner?.business_id && runtimeOwner.business_id !== store.business_id) return respond(202, 'business_mismatch', { ok: true });
      const { data: offer, error: offerError } = await admin.from('offers').select('business_email').eq('id', campaign.offerId).maybeSingle();
      const { data: business, error: businessError } = await admin.from('business_profiles').select('business_email').eq('id', store.business_id).maybeSingle();
      if (offerError || businessError) throw new Error('database');
      if (!business?.business_email || offer?.business_email !== business.business_email || campaign.businessEmail !== business.business_email) return respond(202, 'business_mismatch', { ok: true });
      const approval = await assertAffiliateOfferApproved(admin as never, { offerId: campaign.offerId, affiliateEmail: profile.email });
      if (!approval.ok) return respond(202, 'participation_rejected', { ok: true });
      const eventData = {
        source: 'shopify_pixel', shop_domain: payload.shop_domain, order_id: payload.order_id.replace(/^gid:\/\/shopify\/Order\//, ''),
        checkout_token: payload.checkout_token, total_value: payload.total_value, currency: payload.currency,
        nm_aff: payload.nm_aff, nm_camp: payload.nm_camp, nm_src: payload.nm_src, timestamp: payload.timestamp,
        line_items: payload.line_items.map(item => ({ product_id: item.product_id, variant_id: item.variant_id, quantity: item.quantity, line_total: item.line_total })),
      };
      const { data: recorded, error: recordingError } = await admin.rpc('record_shopify_conversion', {
        p_shop: shop, p_order: eventData.order_id, p_business: store.business_id,
        p_campaign: campaign.campaignId, p_offer: campaign.offerId, p_affiliate: profile.email,
        p_amount: payload.total_value, p_currency: payload.currency.toLowerCase(), p_event_data: eventData,
      });
      if (recordingError || !recorded?.event_id) throw new Error('database');
      if (recorded.duplicate) return respond(200, 'duplicate', { duplicate: true });
      // Same stored-event processor used by track-event, with no HTTP/protection hop.
      try { await deps.process(recorded.event_id); }
      catch { return respond(200, 'processing_pending', { ok: true, event_id: recorded.event_id }); }
      return respond(200, 'recorded', { ok: true, event_id: recorded.event_id });
    } catch { return respond(503, 'unavailable', { error: 'unavailable' }); }
  };
}

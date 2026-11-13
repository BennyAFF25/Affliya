import type { SupabaseClient } from '@supabase/supabase-js';
import { isUuid, resolveRuntimeCampaign } from '../../utils/tracking/campaignIdentity';
import { assertAffiliateOfferApproved } from '../../utils/approvals/enforcement';
import { readBody, decrypt, verifySignature } from './security';
import { reduceOrder, isPing } from './orders';
export function createWebhookHandler(deps: { admin: () => SupabaseClient; process: (eventId: string) => Promise<void>; log?: (store: string, code: string) => void }) {
  return async (req: Request) => {
    const storeId = new URL(req.url).searchParams.get('store');
    const respond = (status: number, code: string, body: object = { ok: true }) => { if (storeId) deps.log?.(storeId, code); return Response.json(body, { status }); };
    if (!storeId || !isUuid(storeId)) return respond(404, 'store_unavailable', { error: 'store_unavailable' });
    try {
      let raw: Buffer; try { raw = await readBody(req, 262144); } catch { return respond(413, 'invalid_payload', { error: 'invalid_payload' }); }
      const admin = deps.admin();
      const { data: store, error } = await admin.from('woocommerce_stores').select('business_id,status,webhook_secret_encrypted').eq('id', storeId).maybeSingle();
      if (error) throw new Error('database');
      if (!store || store.status !== 'connected' || !store.webhook_secret_encrypted) {
        // Woo sends an unsigned form ping while the callback is still installing webhooks.
        if (store?.status === 'pending' && isPing(raw)) return respond(200, 'ping');
        return respond(404, 'store_unavailable', { error: 'store_unavailable' });
      }
      if (isPing(raw)) return respond(200, 'ping');
      if (!verifySignature(raw, req.headers.get('x-wc-webhook-signature'), decrypt(store.webhook_secret_encrypted))) return respond(401, 'invalid_signature', { error: 'invalid_signature' });
      const topic = req.headers.get('x-wc-webhook-topic');
      if (topic !== 'order.created' && topic !== 'order.updated') return respond(200, 'ignored_topic');
      let order: ReturnType<typeof reduceOrder>;
      try { order = reduceOrder(JSON.parse(raw.toString('utf8'))); } catch { return respond(400, 'invalid_payload', { error: 'invalid_payload' }); }
      const touched = await admin.from('woocommerce_stores').update({ last_event_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', storeId).eq('status', 'connected');
      if (touched.error) throw new Error('database');
      if (topic === 'order.updated' && ['refunded','cancelled','failed'].includes(order.status)) {
        const reversed = await admin.from('woocommerce_order_conversions').update({ status: 'reversed', reversed_at: new Date().toISOString() }).eq('store_id', storeId).eq('order_id', order.order_id).eq('status', 'recorded');
        if (reversed.error) throw new Error('database');
        return respond(200, 'reversed');
      }
      if (!['processing','completed'].includes(order.status)) return respond(200, 'unpaid');
      const attribution = order.attribution;
      if (!attribution) return respond(200, 'unattributed');
      const { data: profile, error: profileError } = await admin.from('profiles').select('email').eq('id', attribution.nm_aff).eq('role', 'affiliate').maybeSingle();
      if (profileError) throw new Error('database');
      if (!profile?.email) return respond(200, 'affiliate_mismatch');
      const campaign = await resolveRuntimeCampaign(admin as never, { campaignId: attribution.nm_camp, affiliateEmail: profile.email });
      if (!campaign || campaign.affiliateEmail !== profile.email) return respond(200, 'identity_mismatch');
      const owner = await admin.from(campaign.sourceTable).select('business_id').eq('id', campaign.campaignId).maybeSingle();
      const offer = await admin.from('offers').select('business_email').eq('id', campaign.offerId).maybeSingle();
      const business = await admin.from('business_profiles').select('business_email').eq('id', store.business_id).maybeSingle();
      if (owner.error || offer.error || business.error) throw new Error('database');
      if ((owner.data?.business_id && owner.data.business_id !== store.business_id) || !business.data?.business_email || offer.data?.business_email !== business.data.business_email || campaign.businessEmail !== business.data.business_email) return respond(200, 'business_mismatch');
      const approval = await assertAffiliateOfferApproved(admin as never, { offerId: campaign.offerId, affiliateEmail: profile.email });
      if (!approval.ok) return respond(200, 'participation_rejected');
      const event = { source: 'woocommerce_webhook', order_id: order.order_id, total_value: order.total_value, currency: order.currency, line_items: order.line_items, nm_aff: attribution.nm_aff, nm_camp: campaign.campaignId, nm_src: attribution.nm_src };
      const recorded = await admin.rpc('record_woocommerce_conversion', { p_store: storeId, p_order: order.order_id, p_business: store.business_id, p_campaign: campaign.campaignId, p_offer: campaign.offerId, p_affiliate: profile.email, p_amount: order.total_value, p_currency: order.currency.toLowerCase(), p_event_data: event });
      if (recorded.error || !recorded.data?.event_id) throw new Error('database');
      if (recorded.data.duplicate) return respond(200, 'duplicate', { duplicate: true });
      await deps.process(recorded.data.event_id);
      return respond(200, 'recorded');
    } catch { return respond(503, 'unavailable', { error: 'unavailable' }); }
  };
}

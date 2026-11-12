import { register } from '@shopify/web-pixels-extension';

// Match Nettmark redirect/tracker cookies; localStorage also expires explicitly.
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const KEY = 'nettmark_attribution_v1';
type Attribution = { nm_aff: string; nm_camp: string; nm_src: string; captured_at: number };

register(({ analytics, browser, settings }) => {
  // Serialize storage operations so a checkout cannot outrun an earlier page capture.
  let pending = Promise.resolve();
  async function read(): Promise<Attribution | null> {
    try {
      const raw = await browser.localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* Cookie fallback. */ }
    try {
      const raw = await browser.cookie.get(KEY);
      return raw ? JSON.parse(decodeURIComponent(raw)) : null;
    } catch { return null; }
  }
  analytics.subscribe('page_viewed', event => {
    pending = pending.then(async () => {
      const url = new URL(event.context.document.location.href);
      const aff = url.searchParams.get('nm_aff');
      const camp = url.searchParams.get('nm_camp');
      // Capture a complete pair together; never mix two campaigns' identities.
      if (!aff || !camp || !/^[a-f0-9-]{36}$/i.test(aff)) return;
      const value = JSON.stringify({ nm_aff: aff, nm_camp: camp, nm_src: url.searchParams.get('nm_src') || 'nettmark', captured_at: Date.now() });
      try { await browser.localStorage.setItem(KEY, value); } catch { /* Cookie fallback. */ }
      try { await browser.cookie.set(`${KEY}=${encodeURIComponent(value)};path=/;max-age=604800;SameSite=Lax;Secure`); } catch { /* Storage may be unavailable. */ }
    }).catch(() => {});
  });
  analytics.subscribe('checkout_completed', async event => {
    await pending;
    const attr = await read();
    if (!attr?.nm_aff || !attr.nm_camp || !Number.isFinite(attr.captured_at) || Date.now() < attr.captured_at || Date.now() - attr.captured_at > WINDOW_MS) return;
    const checkout = event.data.checkout;
    if (!checkout.order?.id || checkout.totalPrice?.amount == null || !checkout.currencyCode) return;
    const payload = {
      shop_domain: String(settings.shopKey), order_id: String(checkout.order.id),
      checkout_token: checkout.token || null, total_value: Number(checkout.totalPrice.amount),
      currency: checkout.currencyCode, nm_aff: attr.nm_aff, nm_camp: attr.nm_camp,
      nm_src: attr.nm_src, timestamp: event.timestamp,
      line_items: checkout.lineItems.map(item => ({
        product_id: item.variant?.product?.id || null, variant_id: item.variant?.id || null,
        quantity: item.quantity, line_total: Number(item.finalLinePrice.amount),
      })),
    };
    const body = JSON.stringify(payload);
    if (new TextEncoder().encode(body).length > 8192) return;
    try {
      await fetch(String(settings.ingestUrl), { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body, keepalive: true, credentials: 'omit' });
    } catch { /* Never log checkout data. */ }
  });
});

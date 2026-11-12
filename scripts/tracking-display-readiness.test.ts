import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isOfferTrackingDisplayReady, hasRecentManualTrackingEvent } from '../utils/tracking/displayReadiness';
import { assertOfferTrackingReady, type QueryClient } from '../utils/approvals/enforcement';
type Row = Record<string, unknown>;
const now = Date.now();
const event = (source: string, event_type = 'conversion', age = 0) => ({ event_type, event_data: { source }, created_at: new Date(now - age).toISOString(), offer_id: 'offer' });
let failure = '';
const rows: Record<string, Row[]> = {
  offers: [{ id: 'offer', business_email: 'owner@example.test', site_host: 'shopify', meta_pixel_id: 'meta' }],
  business_profiles: [{ id: 'business', business_email: 'owner@example.test', pixel_connected: true }],
  business_onboarding_progress: [{ offer_id: 'offer', tracking_connected: true }],
  campaign_tracking_events: [event('setup-tracking-test-button', 'test_pixel')],
  shopify_stores: [],
};
const db = { from(table: string) {
  let matched = [...(rows[table] || [])];
  const result = () => ({ data: matched, error: failure === table ? { message: 'mock failure' } : null });
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => { matched = matched.filter(row => row[key] === value); return query; },
    order: () => { matched.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))); return query; },
    limit: (count: number) => { matched = matched.slice(0, count); return query; },
    maybeSingle: async () => ({ ...result(), data: matched[0] || null }),
    then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
  };
  return query;
} } as unknown as QueryClient;
async function run() {
  assert.equal(await isOfferTrackingDisplayReady(db, 'offer'), false, 'website/meta/onboarding/profile hints and synthetic tests are insufficient');
  assert.equal((await assertOfferTrackingReady(db, 'offer')).ok, true, 'legacy gate unchanged');
  for (const status of ['connected', 'disconnected', 'uninstalled']) {
    for (const pixel_status of ['active', 'inactive', 'error']) {
      rows.shopify_stores = [{ business_id: 'business', status, pixel_status }];
      rows.campaign_tracking_events = [event('shopify_pixel')];
      assert.equal(await isOfferTrackingDisplayReady(db, 'offer'), status === 'connected' && pixel_status === 'active');
    }
  }
  rows.shopify_stores = [{ business_id: 'other', status: 'connected', pixel_status: 'active' }];
  assert.equal(await isOfferTrackingDisplayReady(db, 'offer'), false, 'other business cannot satisfy readiness');
  rows.shopify_stores.push({ business_id: 'business', status: 'connected', pixel_status: 'active' });
  assert.equal(await isOfferTrackingDisplayReady(db, 'offer'), true, 'any owned active store qualifies');
  rows.shopify_stores = [{ business_id: 'business', status: 'disconnected', pixel_status: 'inactive' }];
  rows.campaign_tracking_events = [event('generic_tracker', 'page_view')];
  assert.equal(await isOfferTrackingDisplayReady(db, 'offer'), true, 'independent manual tracker qualifies');
  assert.equal(hasRecentManualTrackingEvent([event('manual', 'page_view', 8 * 86400000)], now), false);
  assert.equal(hasRecentManualTrackingEvent([event('manual', 'page_view', -1000)], now), false);
  assert.equal(hasRecentManualTrackingEvent([event('manual', 'test_pixel')], now), false);
  failure = 'shopify_stores';
  await assert.rejects(() => isOfferTrackingDisplayReady(db, 'offer'));
  const page = readFileSync('app/business/my-business/page.tsx', 'utf8');
  const route = readFileSync('app/api/business/tracking-readiness/route.ts', 'utf8') + readFileSync('utils/tracking/readinessRequest.ts', 'utf8');
  assert.match(page, /purpose: "display"/);
  assert.match(page, /const hasTrackingConnected = hasTrackingDerived/);
  assert.doesNotMatch(page, /trackingVerifiedOfferIds.size === 0\) return true|tracking_connected:\s*\n/);
  assert.match(page, /onTrackingChange=/);
  assert.match(route, /input\?\.purpose === "display"/);
  assert.match(route, /assertOfferTrackingReady\(/);
  console.log('tracking display readiness tests passed');
}
void run();

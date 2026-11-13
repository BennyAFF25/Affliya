// Regression: /api/business/tracking-readiness returned 500 ("order is not a function") because
// displayReadiness called .order() on from(). Uses the REAL supabase-js builder with a stubbed fetch.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { isOfferTrackingDisplayReady } from '../utils/tracking/displayReadiness';
import type { QueryClient } from '../utils/approvals/enforcement';

const urls: string[] = [];
const fakeFetch = async (input: RequestInfo | URL) => {
  const url = String(input); urls.push(url);
  const body = url.includes('/offers') ? { business_email: 'owner@example.test' }
    : url.includes('/business_profiles') ? { id: 'business' }
    : url.includes('/shopify_stores') ? null
    : [{ event_type: 'page_view', event_data: { source: 'manual' }, created_at: new Date().toISOString() }];
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
};
const client = createClient('http://supabase.invalid', 'test-key', { global: { fetch: fakeFetch as typeof fetch }, auth: { persistSession: false } });
(async () => {
  const ready = await isOfferTrackingDisplayReady(client as unknown as QueryClient, 'offer');
  assert.equal(ready, true);
  const events = urls.find(u => u.includes('/campaign_tracking_events'));
  assert.ok(events && /order=created_at\.desc/.test(events) && /limit=50/.test(events) && /offer_id=eq\.offer/.test(events));
  console.log('tracking-readiness real supabase-js builder: ok');
})().catch(error => { console.error(error); process.exit(1); });

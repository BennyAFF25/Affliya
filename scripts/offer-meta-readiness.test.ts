import * as assert from 'node:assert/strict';
import { computeOfferMetaReady } from '../utils/offerMetaReadiness';
import { loadOfferSnapshot } from '../utils/affiliateAssistantWebhook';

async function run() {
  const offer = { business_email: 'brand@example.com' };
  const single = [{ page_id: 'page', ad_account_id: 'account' }];
  const ambiguous = [...single, { page_id: 'other', ad_account_id: 'other' }];
  const cases = [
    { offer, connections: [], ready: false },
    { offer, connections: single, ready: true },
    { offer, connections: [...single, ...single], ready: true },
    { offer, connections: ambiguous, ready: false },
    { offer, connections: [{ page_id: 'page' }], ready: false },
    { offer, connections: [{ ad_account_id: 'account' }], ready: false },
    { offer: { ...offer, meta_page_id: 'selected', meta_ad_account_id: 'selected' }, connections: ambiguous, ready: true },
    { offer: { ...offer, meta_page_id: 'selected' }, connections: single, ready: true },
    { offer: { ...offer, meta_ad_account_id: 'selected' }, connections: single, ready: true },
    { offer: { ...offer, meta_page_id: '  ', meta_ad_account_id: ' ' }, connections: [], ready: false },
    { offer: {}, connections: single, ready: false },
  ];
  for (const test of cases) {
    assert.equal(computeOfferMetaReady(test.offer, test.connections).metaReady, test.ready);
    for (const currency of [null, '', 'USD', 'GBP', 'CAD', 'AUD']) {
      let connectionQueries = 0;
      const supabase = {
        from(table: string) {
          if (table === 'meta_connections') connectionQueries++;
          const builder: any = {
            select() { return builder; },
            eq() { return builder; },
            maybeSingle: async () => ({ data: { id: 'offer', ...test.offer, currency }, error: null }),
            then(resolve: any) { return Promise.resolve({ data: test.connections, error: null }).then(resolve); },
          };
          return builder;
        },
      } as never;
      const snapshot = await loadOfferSnapshot(supabase, 'offer');
      assert.deepEqual(snapshot?.allowed_channels, test.ready ? ['organic', 'facebook_ads'] : ['organic']);
      assert.equal(snapshot?.currency, currency || null);
      if (computeOfferMetaReady(test.offer).metaReady) assert.equal(connectionQueries, 0);
    }
  }
  console.log('offer Meta readiness and webhook payload regression tests passed');
}
void run();

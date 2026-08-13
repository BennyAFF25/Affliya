import * as assert from 'node:assert/strict';
import { resolveOfferPaidReadiness } from '../utils/offerReadiness';

type Row = Record<string, any>;

type TableData = Record<string, Row[]>;

function createMockSupabase(data: TableData) {
  return {
    from(table: string) {
      let rows = [...(data[table] || [])];
      const builder: any = {
        select() { return builder; },
        eq(column: string, value: any) {
          rows = rows.filter((row) => row[column] === value);
          return builder;
        },
        is(column: string, value: null) {
          rows = rows.filter((row) => row[column] === value);
          return builder;
        },
        limit(count: number) {
          rows = rows.slice(0, count);
          return builder;
        },
        maybeSingle: async () => ({ data: rows[0] || null, error: null }),
        then(resolve: any) {
          return Promise.resolve({ data: rows, error: null }).then(resolve);
        },
      };
      return builder;
    },
  } as never;
}

async function run() {
  const singleConnection = await resolveOfferPaidReadiness({
    supabase: createMockSupabase({
      offers: [{ id: 'offer_1', business_email: 'tester3@test.com', site_host: 'shopify', meta_page_id: null, meta_ad_account_id: null, meta_pixel_id: null }],
      business_onboarding_progress: [{ business_email: 'tester3@test.com', offer_id: null, tracking_connected: true }],
      campaign_tracking_events: [],
      meta_connections: [{ business_email: 'tester3@test.com', page_id: 'page_1', page_name: 'Page', ad_account_id: 'act_1', ad_account_name: 'Ads', pixel_id: 'pixel_1', pixel_name: 'Pixel' }],
    }),
    offerId: 'offer_1',
  });

  assert.equal(singleConnection.trackingReady, true);
  assert.equal(singleConnection.metaReady, true);
  assert.equal(singleConnection.metaSource, 'meta_connections');
  assert.equal(singleConnection.resolvedMeta.pageId, 'page_1');
  assert.equal(singleConnection.resolvedMeta.adAccountId, 'act_1');
  assert.equal(singleConnection.resolvedMeta.pixelId, 'pixel_1');

  const ambiguousConnections = await resolveOfferPaidReadiness({
    supabase: createMockSupabase({
      offers: [{ id: 'offer_2', business_email: 'multi@test.com', site_host: 'shopify', meta_page_id: null, meta_ad_account_id: null, meta_pixel_id: null }],
      business_onboarding_progress: [],
      campaign_tracking_events: [],
      meta_connections: [
        { business_email: 'multi@test.com', page_id: 'page_1', ad_account_id: 'act_1' },
        { business_email: 'multi@test.com', page_id: 'page_2', ad_account_id: 'act_2' },
      ],
    }),
    offerId: 'offer_2',
  });

  assert.equal(ambiguousConnections.metaReady, false);
  assert.equal(ambiguousConnections.metaConnected, true);
  assert.equal(ambiguousConnections.metaReason, 'needs_offer_selection');

  const offerSelectionWins = await resolveOfferPaidReadiness({
    supabase: createMockSupabase({
      offers: [{ id: 'offer_3', business_email: 'biz@test.com', site_host: null, meta_page_id: 'offer_page', meta_ad_account_id: 'offer_act', meta_pixel_id: null }],
      business_onboarding_progress: [],
      campaign_tracking_events: [{ offer_id: 'offer_3', event_type: 'test_pixel', id: 'evt_1' }],
      meta_connections: [],
    }),
    offerId: 'offer_3',
  });

  assert.equal(offerSelectionWins.trackingReady, true);
  assert.equal(offerSelectionWins.metaReady, true);
  assert.equal(offerSelectionWins.metaSource, 'offer');

  console.log('offer readiness tests passed');
}

void run();

import type { QueryClient } from '../approvals/enforcement';

type OrderedQuery = ReturnType<QueryClient['from']> & {
  order: (column: string, options: { ascending: boolean }) => OrderedQuery;
};

const MANUAL_EVIDENCE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Setup-button test_pixel events are server-generated, not merchant installation evidence.
// Shopify purchases are historical evidence only; current Shopify state is checked separately.
export function hasRecentManualTrackingEvent(events: Record<string, unknown>[], now = Date.now()): boolean {
  return events.some(event => {
    const data = event.event_data as Record<string, unknown> | null;
    const timestamp = typeof event.created_at === 'string' ? Date.parse(event.created_at) : NaN;
    return ['page_view', 'click', 'add_to_cart', 'checkout', 'conversion'].includes(String(event.event_type))
      && data?.source !== 'shopify_pixel'
      && data?.source !== 'setup-tracking-test-button'
      && timestamp <= now && timestamp >= now - MANUAL_EVIDENCE_MAX_AGE_MS;
  });
}

// Display only. Do not replace approval enforcement with this status policy.
export async function isOfferTrackingDisplayReady(supabase: QueryClient, offerId: string): Promise<boolean> {
  const { data: offer, error: offerError } = await supabase.from('offers')
    .select('business_email').eq('id', offerId).maybeSingle();
  if (offerError) throw new Error('Tracking display offer lookup failed');
  const email = (offer as { business_email?: string } | null)?.business_email;
  if (!email) return false;
  const { data: business, error: businessError } = await supabase.from('business_profiles')
    .select('id').eq('business_email', email).maybeSingle();
  if (businessError) throw new Error('Tracking display business lookup failed');
  const businessId = (business as { id?: string } | null)?.id;
  if (businessId) {
    const { data: store, error } = await supabase.from('shopify_stores')
      .select('id').eq('business_id', businessId).eq('status', 'connected')
      .eq('pixel_status', 'active').limit(1).maybeSingle();
    if (error) throw new Error('Tracking display Shopify lookup failed');
    if (store) return true;
  }
  // supabase-js only exposes .order() after .select() (filter builder), not on from().
  const eventQuery = supabase.from('campaign_tracking_events')
    .select('event_type,event_data,created_at').eq('offer_id', offerId) as OrderedQuery;
  const { data: events, error } = await eventQuery.order('created_at', { ascending: false }).limit(50);
  if (error) throw new Error('Tracking display merchant event lookup failed');
  return hasRecentManualTrackingEvent((events || []) as Record<string, unknown>[]);
}

import { supabase } from '../supabase/pages-client';
import { firstBrandDestination } from './firstBrand';

export async function affiliateLoginDestination(next: string | null, email: string | undefined) {
  // Explicit destinations (settings, inbox, promotion, selected offer) are preserved.
  if ((next && next.split(/[?#]/)[0] !== '/affiliate/dashboard') || !email) return firstBrandDestination(next, null);
  // Any participation state or promotion counts, including historical/rejected requests.
  try {
    const results = await Promise.all(['affiliate_requests', 'ad_ideas', 'organic_posts', 'live_ads', 'affiliate_shop_items'].map(table =>
      supabase.from(table).select('id').eq('affiliate_email', email).limit(1).abortSignal(AbortSignal.timeout(5000))));
    const hasActivity = results.some(result => (result.data?.length || 0) > 0)
      ? true : results.some(result => result.error) ? null : false;
    return firstBrandDestination(next, hasActivity);
  } catch { return firstBrandDestination(next, null); }
}

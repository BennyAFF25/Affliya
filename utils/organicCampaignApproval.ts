import type { SupabaseClient } from '@supabase/supabase-js';
import { assertAffiliateOfferApproved, assertOfferTrackingReady, type QueryClient } from './approvals/enforcement';
import { isSubscriptionRequiredError } from './businessSubscriptionGate';
import { organicCaptionError, ORGANIC_CAPTION_TYPE_ERROR } from './organicCaption';
import { buildTrackingUrl } from './tracking/buildTrackingUrl';

import { findLegacyPairCampaign, matchesOrganicCampaign, type OrganicCampaignIdentity } from './organicCampaignIdentity';
const fail = (error: string, message: string, status = 409) => ({ success: false as const, error, message, status });

/** One implementation for business review and operator recovery. Dry run performs reads only.
 * Organic has no application subscription/card gate (paid-only migration); DB gate errors
 * remain fail-closed. Never delete a stable campaign after a failed link: a concurrent
 * approver may have linked it. Retain it for deterministic repair on the next retry.
 */
export async function approveOrganicPost(client: SupabaseClient, postId: string,
  options: { dryRun?: boolean; context?: { offerId: string; businessEmail: string; affiliateEmail: string } } = {}) {
  const postResult = await client.from('organic_posts')
    .select('id,status,campaign_id,offer_id,business_email,affiliate_email,caption,image_url,video_url,platform')
    .eq('id', postId).maybeSingle();
  if (postResult.error) return fail('POST_LOOKUP_FAILED', 'Could not load post.', 500);
  const post = postResult.data;
  if (!post) return fail('POST_NOT_FOUND', 'Post not found.', 404);
  const context = options.context;
  if (context && (context.offerId !== post.offer_id || context.businessEmail !== post.business_email || context.affiliateEmail !== post.affiliate_email)) {
    return fail('POST_CONTEXT_MISMATCH', 'Post does not belong to this offer and business.', 403);
  }
  if (!['pending', 'approved'].includes(post.status)) return fail('POST_STATE_CHANGED', 'Only pending or approved posts can be completed.');
  const offerResult = await client.from('offers').select('id,business_email,currency').eq('id', post.offer_id).maybeSingle();
  if (offerResult.error) return fail('OFFER_LOOKUP_FAILED', 'Could not verify offer.', 500);
  if (!offerResult.data || offerResult.data.business_email !== post.business_email) return fail('OFFER_BUSINESS_MISMATCH', 'Offer business does not match post.', 403);
  const ids = [...new Set([post.campaign_id, post.id].filter(Boolean))];
  const campaigns = await client.from('live_campaigns').select('id,type,offer_id,business_email,affiliate_email').in('id', ids);
  if (campaigns.error) return fail('CAMPAIGN_LOOKUP_FAILED', 'Could not verify campaign.', 500);
  const rows = (campaigns.data || []) as OrganicCampaignIdentity[];
  const existing = rows.find(c => matchesOrganicCampaign(post, c));
  if (rows.some(c => c.id === post.id && !matchesOrganicCampaign(post, c))) return fail('CAMPAIGN_CONTEXT_MISMATCH', 'Stable campaign ID belongs to another context.');
  if (!existing && post.status === 'approved') {
    const pair = await client.from('live_campaigns').select('id,type,offer_id,business_email,affiliate_email')
      .eq('type', 'organic').eq('offer_id', post.offer_id).eq('business_email', post.business_email)
      .eq('affiliate_email', post.affiliate_email).limit(1);
    if (pair.error) return fail('CAMPAIGN_LOOKUP_FAILED', 'Could not verify campaign.', 500);
    const legacy = findLegacyPairCampaign(post, (pair.data || []) as OrganicCampaignIdentity[]);
    if (legacy) {
      // Legacy approval already has a campaign for this pair; never create a duplicate.
      return { success: true as const, ...(options.dryRun ? { dryRun: true } : {}), campaignId: legacy.id,
        trackingLink: buildTrackingUrl({ campaignId: legacy.id, affiliateId: post.affiliate_email }),
        currency: offerResult.data.currency,
        commissionStatus: offerResult.data.currency === 'AUD' ? 'pending' : 'blocked_currency',
        subscriptionGate: 'paid_only', billingRequiredForApproval: false, action: 'legacy_pair_existing' };
    }
  }
  const captionError = organicCaptionError(post.caption);
  if (captionError) return fail(captionError === ORGANIC_CAPTION_TYPE_ERROR ? 'CAPTION_NOT_TEXT' : 'CAPTION_TOO_LONG', captionError, 400);
  for (const check of [
    () => assertOfferTrackingReady(client as unknown as QueryClient, post.offer_id),
    () => assertAffiliateOfferApproved(client as unknown as QueryClient, { offerId: post.offer_id, affiliateEmail: post.affiliate_email }),
  ]) {
    const result = await check();
    if (!result.ok) return fail(result.error, result.message, result.status);
  }
  const campaignId = existing?.id || post.id;
  const trackingLink = buildTrackingUrl({ campaignId, affiliateId: post.affiliate_email });
  const plan = { campaignId, trackingLink, currency: offerResult.data.currency,
    commissionStatus: offerResult.data.currency === 'AUD' ? 'pending' : 'blocked_currency',
    subscriptionGate: 'paid_only', billingRequiredForApproval: false,
    action: existing ? 'link_existing' : 'create_and_link' };
  if (options.dryRun) return { success: true as const, dryRun: true, ...plan };
  if (!existing) {
    const inserted = await client.from('live_campaigns').insert({ id: campaignId, type: 'organic',
      offer_id: post.offer_id, business_email: post.business_email, affiliate_email: post.affiliate_email,
      media_url: post.video_url || post.image_url || null, caption: post.caption || null,
      platform: post.platform || null, created_from: 'post-ideas', status: 'live' });
    if (inserted.error) {
      if (inserted.error.code !== '23505') return isSubscriptionRequiredError(inserted.error)
        ? fail('ORGANIC_GATE_MISCONFIGURED', 'Apply the paid-ad-only subscription gate migration before retrying.', 500)
        : fail('INSERT_FAILED', 'Failed to create the organic campaign.', 500);
      const winner = await client.from('live_campaigns').select('id,type,offer_id,business_email,affiliate_email').eq('id', campaignId).maybeSingle();
      if (winner.error || !winner.data || !matchesOrganicCampaign(post, winner.data)) return fail('CAMPAIGN_CONTEXT_MISMATCH', 'Could not verify concurrent campaign.');
    }
  }
  let update = client.from('organic_posts').update({ status: 'approved', campaign_id: campaignId })
    .eq('id', post.id).eq('status', post.status).eq('offer_id', post.offer_id)
    .eq('business_email', post.business_email).eq('affiliate_email', post.affiliate_email);
  update = post.campaign_id == null ? update.is('campaign_id', null) : update.eq('campaign_id', post.campaign_id);
  const linked = await update.select('id').maybeSingle();
  if (linked.error || !linked.data) {
    const current = await client.from('organic_posts').select('status,campaign_id').eq('id', post.id).maybeSingle();
    if (current.error || current.data?.status !== 'approved' || current.data.campaign_id !== campaignId) {
      return fail('POST_LINK_FAILED', 'Campaign prepared but post could not be linked. Retry Finish setup.', 500);
    }
  }
  return { success: true as const, ...plan };
}

export type OrganicPostIdentity = {
  id: string; campaign_id?: string | null; status: string; offer_id: string;
  business_email: string; affiliate_email: string;
};
export type OrganicCampaignIdentity = {
  id: string; type: string; offer_id: string; business_email: string; affiliate_email: string;
};
export function matchesOrganicCampaign(post: OrganicPostIdentity, campaign: OrganicCampaignIdentity) {
  return campaign.type === 'organic' && campaign.offer_id === post.offer_id &&
    campaign.business_email === post.business_email && campaign.affiliate_email === post.affiliate_email;
}
export function hasOrganicCampaign(post: OrganicPostIdentity, campaigns: OrganicCampaignIdentity[]) {
  return campaigns.some(c => (c.id === post.campaign_id || c.id === post.id) && matchesOrganicCampaign(post, c))
    || !!findLegacyPairCampaign(post, campaigns);
}
/** Legacy approvals (before stable ids) created a live_campaigns row with a random id and never
 * linked it back (organic_posts.campaign_id defaults to a random uuid). For an already-approved post,
 * an organic campaign for the same offer/business/affiliate is treated as its campaign so
 * "Finish setup" never creates a duplicate. */
export function findLegacyPairCampaign(post: OrganicPostIdentity, campaigns: OrganicCampaignIdentity[]) {
  if (post.status !== 'approved') return undefined;
  return campaigns.find(c => matchesOrganicCampaign(post, c));
}

/** Pending submissions and incomplete approved posts both need business attention. */
export function needsOrganicPostReview(post: OrganicPostIdentity, campaigns: OrganicCampaignIdentity[]) {
  return post.status === 'pending' || (post.status === 'approved' && !hasOrganicCampaign(post, campaigns));
}

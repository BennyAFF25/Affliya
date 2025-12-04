// e.g. utils/tracking/buildTrackingUrl.ts
export function buildTrackingUrl({
  campaignId,
  affiliateId,
}: {
  campaignId: string;
  affiliateId: string;
}) {
  return `https://www.nettmark.com/go/${campaignId}-${affiliateId}`;
}
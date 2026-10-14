// Runtime campaign ownership supplies affiliate identity server-side.
export function buildTrackingUrl({ campaignId }: { campaignId: string; affiliateId: string }) {
  return `https://www.nettmark.com/go/${encodeURIComponent(campaignId)}`;
}

import { parseTrackingRef } from "./parseTrackingRef";
// Runtime campaign ownership supplies affiliate identity server-side.
export function buildTrackingUrl({ campaignId }: { campaignId: string; affiliateId: string }) {
  return `https://www.nettmark.com/go/${encodeURIComponent(campaignId)}`;
}

export function displayTrackingUrl(value: string | null | undefined, identity?: { runtimeId?: string; affiliateId?: string }) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (!["nettmark.com", "www.nettmark.com"].includes(url.hostname) || !url.pathname.startsWith("/go/")) return value;
    const ref = decodeURIComponent(url.pathname.slice(4));
    const parts = parseTrackingRef(ref);
    if (parts.length < 2) return value;
    const refId = identity?.runtimeId || parts[0];
    url.pathname = identity?.affiliateId && !identity.runtimeId
      ? `/go/${encodeURIComponent(refId)}___${encodeURIComponent(identity.affiliateId)}`
      : `/go/${encodeURIComponent(refId)}`;
    return url.toString();
  } catch { return value; }
}

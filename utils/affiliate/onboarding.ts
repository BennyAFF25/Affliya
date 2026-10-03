export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type PromotionMode = "organic" | "ad";

export function affiliateOnboardingPath(offerId: string | null, mode: string | null) {
  const query = new URLSearchParams();
  if (offerId && UUID.test(offerId)) query.set("offerId", offerId);
  if (mode === "ad") query.set("mode", "ad");
  return "/onboarding/for-partners" + (query.size ? "?" + query.toString() : "");
}

function hasUnsafePathCharacters(value: string) {
  return [...value].some(character => character === "\\" || character.charCodeAt(0) <= 32);
}

export function safeInternalReturnTo(value: string | null): string | null {
  const raw = String(value || "").trim();
  if (!raw.startsWith("/") || raw.startsWith("//") || hasUnsafePathCharacters(raw) || raw.length > 500) return null;
  // Reject encoded separators/dot segments before role checks.
  let decoded: string;
  try { decoded = decodeURIComponent(raw); } catch { return null; }
  if (hasUnsafePathCharacters(decoded.split("?")[0]) || decoded.startsWith("//")) return null;
  const url = new URL(raw, "https://nettmark.local");
  if (url.origin !== "https://nettmark.local" || url.pathname !== raw.split(/[?#]/)[0]) return null;
  if (/%(?:2f|5c|2e)/i.test(url.pathname)) return null;
  return raw;
}

export function roleReturnTo(value: string | null, role: string | null | undefined) {
  const safe = safeInternalReturnTo(value);
  if (!safe) return null;
  const pathname = safe.split(/[?#]/)[0];
  if (role === "affiliate" && (pathname.startsWith("/affiliate/") || pathname === "/onboarding/for-partners")) return safe;
  if (role === "business" && (pathname.startsWith("/business/") || pathname === "/onboarding/for-business")) return safe;
  return null;
}

export type OnboardingOffer = {
  id: string;
  title: string;
  description: string;
  logoUrl: string | null;
  commission: number | null;
  commissionValue: number | null;
  currency: string | null;
  type: string | null;
  participationMode: "open" | "approval_required" | "private";
  requestStatus: string | null;
  readyOrganicCount: number | null;
};

export function isApproved(status: unknown) {
  return ["approved", "active", "accepted"].includes(String(status || "").toLowerCase());
}

export function visibleOnboardingOffer(row: Record<string, unknown>, requestStatus: unknown) {
  if (!UUID.test(String(row.id || "")) || !row.business_email) return false;
  if (!["active", "approved", "live", "published"].includes(String(row.status || "active").toLowerCase())) return false;
  if (String(requestStatus || "").toLowerCase() === "rejected") return false;
  const participation = row.participation_mode == null ? "open" : String(row.participation_mode).toLowerCase();
  if (!["open", "approval_required", "private"].includes(participation)) return false;
  return participation !== "private" || isApproved(requestStatus);
}

export function rankOnboardingOffers(offers: OnboardingOffer[]) {
  const score = (offer: OnboardingOffer) =>
    (isApproved(offer.requestStatus) ? 4 : offer.participationMode === "open" ? 2 : 0) +
    ((offer.readyOrganicCount || 0) > 0 ? 1 : 0) -
    (offer.requestStatus === "pending" ? 5 : 0);
  return [...offers].sort((a, b) => score(b) - score(a) || a.title.localeCompare(b.title));
}

export function canUsePreapprovedOrganic(
  usingBrandContent: boolean | undefined,
  creative: { allow_organic?: boolean; organic_preapproved?: boolean; caption?: string | null } | null | undefined,
  method: string,
  caption: string,
) {
  return !!usingBrandContent && !!creative?.allow_organic && !!creative?.organic_preapproved &&
    method === "social" && caption.trim() === String(creative.caption || "").trim();
}

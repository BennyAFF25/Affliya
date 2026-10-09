import { formatMoney } from "../currency";
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
  price?: number | null;
  recurringMonthlyCommissionValue?: number | null;
  recurringTermMonths?: number | null;
  payoutCycles?: number | null;
  payoutMode?: string | null;
  payoutInterval?: string | null;
  currency: string | null;
  type: string | null;
  participationMode: "open" | "approval_required" | "private";
  requestStatus: string | null;
  readyOrganicCount: number | null;
};

/** Display only: actual payouts remain authoritative in process-conversion. */
export function onboardingCommission(offer: OnboardingOffer): { label: string; detail: string | null } {
  const positive = (value: number | null | undefined): value is number =>
    typeof value === "number" && Number.isFinite(value) && value > 0;
  const rate = positive(offer.commission) ? offer.commission + "% commission" : "See offer terms";
  const fallback = { label: rate, detail: offer.type === "recurring" ? "Recurring offer · See payment terms" : null };
  if (!positive(offer.commission) || !offer.currency || !/^[A-Za-z]{3}$/.test(offer.currency)) return fallback;
  const currency = offer.currency.toUpperCase();
  const money = (amount: number) => formatMoney(amount, currency);
  const priceEstimate = positive(offer.price) ? offer.price * offer.commission / 100 : null;
  const suffix = " · " + offer.commission + "%";
  if (offer.type === "recurring") {
    // Mirror the processor's monthly-value precedence and legacy one-month default.
    const savedMonthly = offer.recurringMonthlyCommissionValue ?? offer.commissionValue;
    const monthly = savedMonthly;
    const term = offer.recurringTermMonths ?? offer.payoutCycles ?? 1;
    const mode = offer.payoutMode ?? "upfront";
    if (!positive(monthly) || !Number.isInteger(term) || term < 1 ||
        !["upfront", "spread"].includes(mode) || (offer.payoutInterval ?? "monthly") !== "monthly") return fallback;
    const upfront = mode === "upfront";
    const total = monthly * term;
    if (!Number.isFinite(total)) return fallback;
    return {
      label: money(upfront ? total : monthly) + (upfront ? " per referral" : "/month") + suffix,
      detail: money(monthly) + "/month for " + term + (term === 1 ? " month" : " months") +
        (upfront ? " · Paid upfront" : " · Paid monthly") + " · Offer terms apply",
    };
  }
  // commission_value may be rounded or stale after editing; prefer the current listed price.
  const estimate = offer.price == null ? offer.commissionValue : priceEstimate;
  if (!positive(estimate)) return fallback;
  return {
    label: money(estimate) + " est. per sale" + suffix,
    detail: (positive(offer.price) ? "Based on a sale of " + money(offer.price) + ". " : "") +
      "Actual commission depends on eligible sale value.",
  };
}

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
  forceReview = false,
) {
  return !forceReview && !!usingBrandContent && !!creative?.allow_organic && !!creative?.organic_preapproved &&
    method === "social" && caption.trim() === String(creative.caption || "").trim();
}

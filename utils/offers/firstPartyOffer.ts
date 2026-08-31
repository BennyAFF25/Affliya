/* eslint-disable @typescript-eslint/no-explicit-any */

import { ensureAffiliateOfferParticipation } from "@/../utils/approvals/enforcement";

export const NETTMARK_PARTNER_PROGRAMME_SYSTEM_KEY = "nettmark_partner_programme";
export const NETTMARK_PARTNER_PROGRAMME_EMAIL = "contact@nettmark.com";
export const NETTMARK_PARTNER_PROGRAMME_TITLE = "Nettmark Partner Programme";

type OfferLike = {
  system_key?: string | null;
  business_email?: string | null;
  title?: string | null;
  price?: number | null;
  currency?: string | null;
  commission_value?: number | null;
  recurring_monthly_commission_value?: number | null;
  recurring_term_months?: number | null;
  payout_cycles?: number | null;
  type?: string | null;
};

export function isNettmarkPartnerProgrammeOffer(offer: OfferLike | null | undefined) {
  if (!offer) return false;
  if (offer.system_key === NETTMARK_PARTNER_PROGRAMME_SYSTEM_KEY) return true;

  const email = String(offer.business_email || "").trim().toLowerCase();
  const title = String(offer.title || "").trim().toLowerCase();

  return email === NETTMARK_PARTNER_PROGRAMME_EMAIL && title === NETTMARK_PARTNER_PROGRAMME_TITLE.toLowerCase();
}

function formatMoney(amount: number | null | undefined, currency = "AUD") {
  if (amount == null || !Number.isFinite(Number(amount))) return null;

  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: currency || "AUD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(amount));
  } catch {
    return `$${Number(amount).toFixed(0)}`;
  }
}

export function buildPartnerProgrammeSummary(offer: OfferLike | null | undefined) {
  const priceLabel = formatMoney(offer?.price ?? null, offer?.currency || "AUD");
  const monthlyCommission = formatMoney(
    offer?.recurring_monthly_commission_value ?? offer?.commission_value ?? null,
    offer?.currency || "AUD",
  );
  const termMonths = Number(offer?.recurring_term_months ?? offer?.payout_cycles ?? 0) || null;

  const subscriptionLabel = priceLabel
    ? `${priceLabel}/month Nettmark subscription`
    : "Monthly Nettmark subscription";

  let commissionLabel = "Recurring commission handled by Nettmark";
  if (monthlyCommission && offer?.type === "recurring" && termMonths && termMonths > 1) {
    commissionLabel = `Earn ${monthlyCommission}/month for up to ${termMonths} months per qualifying activation`;
  } else if (monthlyCommission && offer?.type === "recurring") {
    commissionLabel = `Earn ${monthlyCommission} recurring commission per qualifying activation`;
  } else if (monthlyCommission) {
    commissionLabel = `Earn ${monthlyCommission} per qualifying activation`;
  }

  return {
    subscriptionLabel,
    commissionLabel,
    monthlyCommissionLabel: monthlyCommission,
    termMonths,
  };
}

export async function getNettmarkPartnerProgrammeOffer<T = any>(
  supabase: any,
  columns = "*",
): Promise<T | null> {
  const primary = await supabase
    .from("offers")
    .select(columns)
    .eq("system_key", NETTMARK_PARTNER_PROGRAMME_SYSTEM_KEY)
    .maybeSingle();

  if (primary?.data) return primary.data as T;

  const fallback = await supabase
    .from("offers")
    .select(columns)
    .eq("business_email", NETTMARK_PARTNER_PROGRAMME_EMAIL)
    .ilike("title", NETTMARK_PARTNER_PROGRAMME_TITLE)
    .maybeSingle();

  return (fallback?.data as T | null) || null;
}

export async function ensureNettmarkPartnerProgrammeAccess(params: {
  supabase: any;
  offerId: string;
  affiliateEmail: string;
  businessEmail?: string | null;
}) {
  const { supabase, offerId, affiliateEmail, businessEmail = NETTMARK_PARTNER_PROGRAMME_EMAIL } = params;

  const result = await ensureAffiliateOfferParticipation(supabase, {
    offerId,
    affiliateEmail,
    businessEmail,
    participationMode: "open",
    notes: "Auto-approved first-party onboarding access",
  });

  if (!result.ok) {
    throw new Error(result.message || "Failed to create approved onboarding access.");
  }
}

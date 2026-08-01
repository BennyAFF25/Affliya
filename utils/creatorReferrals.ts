import Stripe from "stripe";
import { SupabaseClient } from "@supabase/supabase-js";

type CookieStoreLike = {
  get?: (name: string) => { value?: string } | undefined;
  set?: (name: string, value: string, options?: Record<string, unknown>) => void;
  delete?: (name: string) => void;
};

type StripeRef = string | { id?: string | null } | null | undefined;

export const CREATOR_REFERRAL_COOKIE = "nettmark_creator_referral";
export const CREATOR_REFERRAL_WINDOW_DAYS_ENV = "CREATOR_REFERRAL_ATTRIBUTION_WINDOW_DAYS";
export const DEFAULT_CREATOR_COMMISSION_PERCENTAGE = 50;
export const DEFAULT_CREATOR_COMMISSION_DURATION_MONTHS = 3;

export type CreatorReferralCookie = {
  referralCode: string;
  creatorPartnerId: string;
  landingSessionId: string;
  landingPath?: string | null;
  landingReferrer?: string | null;
  capturedAt: string;
  expiresAt: string;
};

export type CreatorPartner = {
  id: string;
  display_name: string;
  partner_email?: string | null;
  referral_code: string;
  referral_url: string;
  status: "invited" | "active" | "paused" | "terminated";
  commission_percentage: number;
  commission_duration_months: number;
};

export function normalizeCreatorReferralCode(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/^@+/, "")
    .slice(0, 64);
}

export function isSafeCreatorReferralCode(value: string) {
  return /^[A-Za-z0-9_-]{3,64}$/.test(value);
}

export function getCreatorReferralWindowDays() {
  const raw = Number(process.env[CREATOR_REFERRAL_WINDOW_DAYS_ENV] || 30);
  if (!Number.isFinite(raw) || raw <= 0) return 30;
  return Math.min(Math.floor(raw), 365);
}

export function createLandingSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `landing_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function parseCreatorReferralCookie(raw?: string | null): CreatorReferralCookie | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CreatorReferralCookie>;
    if (!parsed.referralCode || !parsed.creatorPartnerId || !parsed.expiresAt) return null;
    if (Date.parse(parsed.expiresAt) <= Date.now()) return null;
    return parsed as CreatorReferralCookie;
  } catch {
    return null;
  }
}

export function readCreatorReferralCookie(cookieStore: CookieStoreLike) {
  return parseCreatorReferralCookie(cookieStore.get?.(CREATOR_REFERRAL_COOKIE)?.value || null);
}

export function setCreatorReferralCookie(cookieStore: CookieStoreLike, value: CreatorReferralCookie) {
  cookieStore.set?.(CREATOR_REFERRAL_COOKIE, JSON.stringify(value), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(value.expiresAt),
  });
}

export async function findActiveCreatorPartnerByCode(params: {
  supabase: SupabaseClient;
  referralCode: string;
}) {
  const code = normalizeCreatorReferralCode(params.referralCode);
  if (!isSafeCreatorReferralCode(code)) return null;

  const { data, error } = await params.supabase
    .from("creator_partners")
    .select("id,display_name,partner_email,referral_code,referral_url,status,commission_percentage,commission_duration_months")
    .ilike("referral_code", code)
    .maybeSingle();

  if (error) throw new Error(`Failed to validate creator referral code: ${error.message}`);
  if (!data || (data as CreatorPartner).status !== "active") return null;
  return data as CreatorPartner;
}

export async function captureCreatorReferral(params: {
  supabase: SupabaseClient;
  cookieStore: CookieStoreLike;
  referralCode: string;
  landingPath?: string | null;
  landingReferrer?: string | null;
}) {
  const existing = readCreatorReferralCookie(params.cookieStore);
  if (existing) return { captured: false, reason: "existing_creator_referral_cookie", cookie: existing };

  const partner = await findActiveCreatorPartnerByCode({
    supabase: params.supabase,
    referralCode: params.referralCode,
  });

  if (!partner) return { captured: false, reason: "invalid_or_inactive_creator_referral" };

  const now = new Date();
  const expiresAt = new Date(now.getTime() + getCreatorReferralWindowDays() * 24 * 60 * 60 * 1000);
  const cookie: CreatorReferralCookie = {
    referralCode: partner.referral_code,
    creatorPartnerId: partner.id,
    landingSessionId: createLandingSessionId(),
    landingPath: params.landingPath || null,
    landingReferrer: params.landingReferrer || null,
    capturedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  setCreatorReferralCookie(params.cookieStore, cookie);
  return { captured: true, partner, cookie };
}

export async function recordCreatorReferralSignupIntent(params: {
  supabase: SupabaseClient;
  cookieStore: CookieStoreLike;
  businessEmail: string;
  userId?: string | null;
}) {
  const cookie = readCreatorReferralCookie(params.cookieStore);
  if (!cookie) return { recorded: false, reason: "no_creator_referral_cookie" };

  const businessEmail = String(params.businessEmail || "").trim().toLowerCase();
  if (!businessEmail) return { recorded: false, reason: "missing_business_email" };

  const partner = await findActiveCreatorPartnerByCode({
    supabase: params.supabase,
    referralCode: cookie.referralCode,
  });
  if (!partner || partner.id !== cookie.creatorPartnerId) {
    return { recorded: false, reason: "creator_partner_no_longer_active" };
  }

  if (partner.partner_email && partner.partner_email.toLowerCase() === businessEmail) {
    return { recorded: false, reason: "self_referral_rejected" };
  }

  const { data: existingAttribution, error: existingAttributionError } = await params.supabase
    .from("business_creator_attributions")
    .select("id")
    .eq("business_email", businessEmail)
    .maybeSingle();

  if (existingAttributionError) throw new Error(`Failed to check existing creator attribution: ${existingAttributionError.message}`);
  if (existingAttribution?.id) return { recorded: false, reason: "business_already_attributed" };

  const { error } = await params.supabase.from("creator_referral_signup_intents").upsert(
    {
      creator_partner_id: partner.id,
      referral_code: partner.referral_code,
      business_email: businessEmail,
      user_id: params.userId || null,
      attribution_source: "landing_referral_cookie",
      landing_session_id: cookie.landingSessionId,
      landing_path: cookie.landingPath || null,
      landing_referrer: cookie.landingReferrer || null,
      expires_at: cookie.expiresAt,
    },
    { onConflict: "business_email", ignoreDuplicates: true },
  );

  if (error) throw new Error(`Failed to record creator referral signup intent: ${error.message}`);

  const { data: business } = await params.supabase
    .from("business_profiles")
    .select("id,business_email")
    .eq("business_email", businessEmail)
    .maybeSingle();

  let attributionId: string | null = null;
  if (business?.id) {
    const { data: attached, error: attachError } = await params.supabase.rpc("attach_creator_referral_attribution", {
      p_business_id: business.id,
      p_business_email: business.business_email,
      p_attribution_source: "signup_intent_recorded",
    });
    if (attachError) throw new Error(`Failed to attach creator referral attribution: ${attachError.message}`);
    attributionId = attached || null;
  }

  return { recorded: true, attributionId };
}

function getRefId(ref: StripeRef) {
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id || null;
}

export function getSubscriptionIdFromInvoiceForCommissions(invoice: Stripe.Invoice) {
  const typed = invoice as Stripe.Invoice & {
    subscription?: StripeRef;
    parent?: { subscription_details?: { subscription?: StripeRef } | null } | null;
  };
  return getRefId(typed.subscription) || getRefId(typed.parent?.subscription_details?.subscription);
}

export function getInvoiceAmountPaid(invoice: Stripe.Invoice) {
  const typed = invoice as Stripe.Invoice & { amount_paid?: number | null; total?: number | null; amount_due?: number | null };
  return Math.max(0, Number(typed.amount_paid ?? typed.total ?? typed.amount_due ?? 0));
}

export async function createCreatorCommissionFromPaidInvoice(params: {
  supabase: SupabaseClient;
  invoice: Stripe.Invoice;
  subscription: Stripe.Subscription;
}) {
  const invoice = params.invoice;
  const stripeInvoiceId = invoice.id;
  const stripeSubscriptionId = params.subscription.id || getSubscriptionIdFromInvoiceForCommissions(invoice);
  if (!stripeInvoiceId || !stripeSubscriptionId) return { created: false, reason: "missing_invoice_or_subscription_id" };

  const grossAmount = getInvoiceAmountPaid(invoice);
  if (grossAmount <= 0) return { created: false, reason: "free_or_zero_amount_invoice" };

  if (String(invoice.status || "").toLowerCase() !== "paid") {
    return { created: false, reason: "invoice_not_paid" };
  }

  const { data: existing, error: existingError } = await params.supabase
    .from("creator_commission_ledger")
    .select("id,status")
    .eq("stripe_invoice_id", stripeInvoiceId)
    .maybeSingle();

  if (existingError) throw new Error(`Failed to check creator commission ledger idempotency: ${existingError.message}`);
  if (existing?.id) return { created: false, reason: "duplicate_invoice", ledgerId: existing.id };

  const customerId = getRefId((params.subscription as Stripe.Subscription & { customer?: StripeRef }).customer);
  let entitlementQuery = params.supabase
    .from("business_entitlements")
    .select("business_id,business_email,is_grandfathered,stripe_subscription_id,subscription_stripe_customer_id")
    .limit(1);

  if (stripeSubscriptionId) {
    entitlementQuery = entitlementQuery.eq("stripe_subscription_id", stripeSubscriptionId);
  } else if (customerId) {
    entitlementQuery = entitlementQuery.eq("subscription_stripe_customer_id", customerId);
  }

  const { data: entitlement, error: entitlementError } = await entitlementQuery.maybeSingle();
  if (entitlementError) throw new Error(`Failed to load business entitlement for commission: ${entitlementError.message}`);
  if (!entitlement?.business_id) return { created: false, reason: "no_business_entitlement" };
  if (entitlement.is_grandfathered) return { created: false, reason: "grandfathered_business" };

  const { data: attribution, error: attributionError } = await params.supabase
    .from("business_creator_attributions")
    .select("id,business_id,creator_partner_id,first_subscription_id")
    .eq("business_id", entitlement.business_id)
    .maybeSingle();

  if (attributionError) throw new Error(`Failed to load creator attribution for commission: ${attributionError.message}`);
  if (!attribution?.id) return { created: false, reason: "business_not_creator_attributed" };

  const { data: partner, error: partnerError } = await params.supabase
    .from("creator_partners")
    .select("id,commission_percentage,commission_duration_months")
    .eq("id", attribution.creator_partner_id)
    .maybeSingle();

  if (partnerError) throw new Error(`Failed to load creator partner terms: ${partnerError.message}`);
  if (!partner?.id) return { created: false, reason: "creator_partner_missing" };

  const duration = Math.max(0, Number(partner.commission_duration_months || DEFAULT_CREATOR_COMMISSION_DURATION_MONTHS));
  if (duration <= 0) return { created: false, reason: "creator_commission_duration_zero" };

  const { data: previousRows, error: previousError } = await params.supabase
    .from("creator_commission_ledger")
    .select("id")
    .eq("business_id", entitlement.business_id)
    .eq("creator_partner_id", attribution.creator_partner_id)
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .in("status", ["pending", "payable", "paid", "reversed"]);

  if (previousError) throw new Error(`Failed to count previous creator commission months: ${previousError.message}`);
  const monthNumber = (previousRows?.length || 0) + 1;
  if (monthNumber > duration) return { created: false, reason: "commission_duration_complete", monthNumber };

  const commissionPercentage = Number(partner.commission_percentage ?? DEFAULT_CREATOR_COMMISSION_PERCENTAGE);
  const commissionAmount = Math.round((grossAmount * commissionPercentage) / 100);
  const currency = String(invoice.currency || "aud").toLowerCase();
  const eligibilityDate = new Date((invoice.created || Math.floor(Date.now() / 1000)) * 1000).toISOString();

  const { data: inserted, error: insertError } = await params.supabase
    .from("creator_commission_ledger")
    .insert({
      creator_partner_id: attribution.creator_partner_id,
      business_id: entitlement.business_id,
      business_creator_attribution_id: attribution.id,
      stripe_invoice_id: stripeInvoiceId,
      stripe_subscription_id: stripeSubscriptionId,
      gross_eligible_subscription_amount: grossAmount,
      commission_percentage: commissionPercentage,
      commission_amount: commissionAmount,
      currency,
      commission_month_number: monthNumber,
      status: "pending",
      eligibility_date: eligibilityDate,
      metadata: {
        source: "stripe_invoice_paid",
        stripeCustomerId: customerId,
        invoiceNumber: (invoice as Stripe.Invoice & { number?: string | null }).number || null,
      },
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") return { created: false, reason: "duplicate_invoice" };
    throw new Error(`Failed to create creator commission ledger entry: ${insertError.message}`);
  }

  if (!attribution.first_subscription_id) {
    await params.supabase
      .from("business_creator_attributions")
      .update({ first_subscription_id: stripeSubscriptionId })
      .eq("id", attribution.id)
      .is("first_subscription_id", null);
  }

  return { created: true, ledgerId: inserted.id, monthNumber };
}

export async function reverseCreatorCommissionByInvoiceId(params: {
  supabase: SupabaseClient;
  stripeInvoiceId: string | null;
  reason: string;
}) {
  const stripeInvoiceId = String(params.stripeInvoiceId || "").trim();
  if (!stripeInvoiceId) return { reversed: false, reason: "missing_invoice_id" };

  const { data, error } = await params.supabase
    .from("creator_commission_ledger")
    .update({
      status: "reversed",
      reversal_reason: params.reason,
      reversed_at: new Date().toISOString(),
    })
    .eq("stripe_invoice_id", stripeInvoiceId)
    .in("status", ["pending", "payable"])
    .select("id");

  if (error) throw new Error(`Failed to reverse creator commission: ${error.message}`);
  return { reversed: Boolean(data?.length), count: data?.length || 0 };
}

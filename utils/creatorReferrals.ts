import Stripe from "stripe";
import { calculateEligibleSubscriptionRevenue, commissionHoldDays } from "./growthPartners/commissionMath";
import { referralEvent } from "./growthPartners/events";
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
  status: "invited" | "active" | "paused" | "terminated" | "suspended";
  user_id?: string | null;
  application_id?: string | null;
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
  const raw = Number(process.env[CREATOR_REFERRAL_WINDOW_DAYS_ENV] || 60);
  if (!Number.isFinite(raw) || raw <= 0) return 60;
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
    .select("id,display_name,partner_email,referral_code,referral_url,status,user_id,application_id,commission_percentage,commission_duration_months")
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

  const reject = async (reason: string) => {
    await referralEvent(params.supabase, partner.id, 'attribution_rejected', `${cookie.landingSessionId}:${reason}`, { reason });
    return { recorded: false, reason };
  };
  if (params.userId && partner.user_id === params.userId) return reject('self_referral_rejected');
  if (partner.application_id) {
    const { data: application, error } = await params.supabase.from('growth_partner_applications').select('email').eq('id', partner.application_id).maybeSingle();
    if (error) throw new Error('Application identity check failed');
    if (application?.email === businessEmail) return reject('self_referral_rejected');
  }
  if (partner.partner_email && partner.partner_email.toLowerCase() === businessEmail) {
    return reject('self_referral_rejected');
  }

  const { data: existingAttribution, error: existingAttributionError } = await params.supabase
    .from("business_creator_attributions")
    .select("id")
    .eq("business_email", businessEmail)
    .maybeSingle();

  if (existingAttributionError) throw new Error(`Failed to check existing creator attribution: ${existingAttributionError.message}`);
  if (existingAttribution?.id) return reject('business_already_attributed');
  const { data: priorBusiness, error: priorError } = await params.supabase.from('business_profiles').select('id,created_at').eq('business_email', businessEmail).maybeSingle();
  if (priorError) throw new Error('Business identity check failed');
  if (priorBusiness) {
    if (Date.parse(priorBusiness.created_at) < Date.parse(cookie.capturedAt) - 600000) return reject('pre_existing_business');
    const { data: priorEntitlement, error } = await params.supabase.from('business_entitlements').select('stripe_subscription_id,growth_trial_used,is_grandfathered').eq('business_id', priorBusiness.id).maybeSingle();
    if (error) throw new Error('Business entitlement check failed');
    if (priorEntitlement?.stripe_subscription_id || priorEntitlement?.growth_trial_used || priorEntitlement?.is_grandfathered) return reject('existing_subscription_or_trial');
  }

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
      captured_at: cookie.capturedAt,
    },
    { onConflict: "business_email", ignoreDuplicates: true },
  );

  if (error) throw new Error(`Failed to record creator referral signup intent: ${error.message}`);

  await referralEvent(params.supabase, partner.id, 'signup_intent', cookie.landingSessionId, {});
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

  const customerId = getRefId(params.subscription.customer);
  const { data: entitlement, error: entitlementError } = await params.supabase.from('business_entitlements')
    .select('business_id,is_grandfathered').eq('stripe_subscription_id', stripeSubscriptionId).maybeSingle();
  if (entitlementError) throw new Error('Commission entitlement lookup failed');
  if (!entitlement?.business_id) return { created: false, reason: 'no_business_entitlement' };
  if (entitlement.is_grandfathered) return { created: false, reason: 'grandfathered_business' };
  const { data: attribution, error } = await params.supabase.from('business_creator_attributions')
    .select('id,creator_partner_id').eq('business_id', entitlement.business_id).maybeSingle();
  if (error) throw new Error('Commission attribution lookup failed');
  if (!attribution) return { created: false, reason: 'business_not_creator_attributed' };
  const monthly = params.subscription.items.data.length > 0 && params.subscription.items.data.every(item => item.price.recurring?.interval === 'month' && item.price.recurring.interval_count === 1);
  const result = calculateEligibleSubscriptionRevenue(invoice, monthly);
  if (!result.eligible) {
    await referralEvent(params.supabase, attribution.creator_partner_id, 'commission_skipped', stripeInvoiceId, { reason: result.reason }, entitlement.business_id);
    return { created: false, reason: result.reason };
  }
  const paidAt = new Date((invoice.status_transitions?.paid_at || invoice.created) * 1000).toISOString();
  const { data, error: insertError } = await params.supabase.rpc('create_creator_subscription_commission', {
    p_attribution_id: attribution.id, p_invoice_id: stripeInvoiceId, p_subscription_id: stripeSubscriptionId,
    p_base: result.base, p_amount_paid: result.amountPaid, p_tax: result.taxAmount,
    p_currency: invoice.currency, p_paid_at: paidAt, p_hold_days: commissionHoldDays(),
  });
  if (insertError?.code === '23505') return { created: false, reason: 'duplicate_invoice' };
  if (insertError) throw new Error('Commission creation failed');
  if (customerId) {
    const { error: customerError } = await params.supabase.from('business_creator_attributions').update({ stripe_customer_id: customerId }).eq('id', attribution.id).is('stripe_customer_id', null);
    if (customerError) throw new Error('Attribution customer update failed');
  }
  return data;
}

export async function reverseCreatorCommissionByInvoiceId(params: {
  supabase: SupabaseClient;
  stripeInvoiceId: string | null;
  reason: string;
}) {
  const stripeInvoiceId = String(params.stripeInvoiceId || "").trim();
  if (!stripeInvoiceId) return { reversed: false, reason: "missing_invoice_id" };

  const { data, error } = await params.supabase.rpc('refund_creator_subscription_commission', {
    p_invoice_id: stripeInvoiceId, p_refund_key: `void:${stripeInvoiceId}`, p_cumulative_amount: null, p_reason: params.reason,
  });
  if (error) throw new Error('Commission reversal failed');
  return data;
}

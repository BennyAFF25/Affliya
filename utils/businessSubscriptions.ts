import Stripe from "stripe";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  BusinessBillingStatus,
  BusinessEntitlement,
  evaluateBusinessEntitlement,
  getBusinessEntitlement,
} from "./businessEntitlements";
import { STRIPE_API_VERSION, buildStripeMetadata, createStripeClient } from "./stripe";

export const BUSINESS_SUBSCRIPTION_PRICE_ENV = "STRIPE_NETTMARK_BUSINESS_MONTHLY_PRICE_ID";

export type BusinessSubscriptionBillingStatus =
  | BusinessBillingStatus
  | "subscription_trialing"
  | "subscription_unpaid"
  | "subscription_incomplete";

export type BusinessSubscriptionSyncResult = {
  businessId: string | null;
  businessEmail: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  billingStatus: BusinessSubscriptionBillingStatus;
  subscriptionRequired: boolean;
  subscriptionStartedAt: string | null;
  subscriptionCurrentPeriodEnd: string | null;
  subscriptionCancelledAt: string | null;
};

export type BusinessProfileForSubscription = {
  id: string;
  business_email: string;
  business_name?: string | null;
  stripe_customer_id?: string | null;
  billing_email?: string | null;
};

type StripeSubscriptionLike = {
  id: string;
  customer?: string | { id?: string | null } | null;
  status?: string | null;
  metadata?: Stripe.Metadata | null;
  created?: number | null;
  current_period_end?: number | null;
  trial_end?: number | null;
  canceled_at?: number | null;
  cancel_at_period_end?: boolean | null;
  cancel_at?: number | null;
};

type EntitlementWithIdRow = {
  id?: string | null;
  business_id?: string | null;
  business_email?: string | null;
  billing_status?: string | null;
  is_grandfathered?: boolean | null;
  subscription_required?: boolean | null;
  subscription_stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_started_at?: string | null;
  subscription_current_period_end?: string | null;
  subscription_cancelled_at?: string | null;
};

export function isBusinessSubscriptionCheckoutEnabled() {
  return String(process.env.BUSINESS_SUBSCRIPTION_CHECKOUT_ENABLED || "false").toLowerCase() === "true";
}

export function getBusinessSubscriptionPriceId() {
  return (process.env[BUSINESS_SUBSCRIPTION_PRICE_ENV] || "").trim();
}

export function createBusinessSubscriptionStripeClient() {
  return createStripeClient(process.env.STRIPE_APP_SECRET || process.env.STRIPE_SECRET_KEY);
}

export function getBusinessSubscriptionBaseUrl() {
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  const candidate = (explicit || "http://localhost:3000").replace(/\/+$/, "");

  try {
    return new URL(candidate).origin;
  } catch {
    if (/^[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(candidate)) {
      return new URL(`https://${candidate}`).origin;
    }
    return "http://localhost:3000";
  }
}

export function toIsoFromStripeSeconds(seconds?: number | null) {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

export function getStripeCustomerIdFromSubscription(subscription: StripeSubscriptionLike) {
  const customer = subscription.customer;
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id || null;
}

export function mapStripeSubscriptionStatus(status?: string | null): BusinessSubscriptionBillingStatus {
  switch (String(status || "").toLowerCase()) {
    case "active":
      return "subscription_active";
    case "trialing":
      return "subscription_trialing";
    case "past_due":
      return "subscription_past_due";
    case "unpaid":
      return "subscription_unpaid";
    case "incomplete":
      return "subscription_incomplete";
    case "canceled":
    case "cancelled":
    case "incomplete_expired":
      return "subscription_cancelled";
    default:
      return "subscription_required";
  }
}

export function entitlementAllowsBillingAccess(entitlement: BusinessEntitlement | null) {
  if (!entitlement) return false;
  return (
    entitlement.billingStatus === "subscription_active" ||
    entitlement.billingStatus === "subscription_trialing" ||
    entitlement.billingStatus === "subscription_past_due" ||
    entitlement.billingStatus === "subscription_unpaid" ||
    entitlement.billingStatus === "subscription_incomplete" ||
    Boolean(entitlement.stripeSubscriptionId)
  );
}

export function shouldPreserveAccessUntilPeriodEnd(subscription: StripeSubscriptionLike, now = new Date()) {
  if (!subscription.cancel_at_period_end) return false;
  const endSeconds = subscription.current_period_end || subscription.cancel_at || null;
  if (!endSeconds) return false;
  return endSeconds * 1000 > now.getTime();
}

export function resolveBillingStatusFromSubscription(subscription: StripeSubscriptionLike, now = new Date()) {
  const mapped = mapStripeSubscriptionStatus(subscription.status);

  if (
    mapped === "subscription_active" ||
    mapped === "subscription_trialing" ||
    mapped === "subscription_past_due" ||
    mapped === "subscription_unpaid" ||
    mapped === "subscription_incomplete"
  ) {
    return mapped;
  }

  if (shouldPreserveAccessUntilPeriodEnd(subscription, now)) {
    return "subscription_active";
  }

  return mapped;
}

export function getSubscriptionCurrentPeriodEnd(subscription: StripeSubscriptionLike) {
  return toIsoFromStripeSeconds(subscription.current_period_end || subscription.trial_end || subscription.cancel_at || null);
}

export function buildBusinessSubscriptionMetadata(params: {
  businessId: string;
  userId: string;
  businessEmail: string;
}) {
  return buildStripeMetadata({
    nettmark_platform: "nettmark",
    nettmark_action: "business_subscription",
    business_id: params.businessId,
    user_id: params.userId,
    business_email: params.businessEmail,
  });
}

export function createServerSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase server env for business subscription operations");
  }

  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

export async function getOwnedBusinessForUser(params: {
  supabase: SupabaseClient;
  businessId: string;
  userId: string;
  userEmail: string;
}) {
  const { data, error } = await params.supabase
    .from("business_profiles")
    .select("id,business_email,business_name,stripe_customer_id,billing_email")
    .eq("id", params.businessId)
    .eq("business_email", params.userEmail)
    .maybeSingle();

  if (error) throw new Error(`Failed to verify business ownership: ${error.message}`);
  return (data || null) as BusinessProfileForSubscription | null;
}

export async function ensureSubscriptionCustomer(params: {
  stripe: Stripe;
  supabase: SupabaseClient;
  business: BusinessProfileForSubscription;
  entitlement: BusinessEntitlement;
  userId: string;
}) {
  const existingCustomerId =
    params.entitlement.subscriptionStripeCustomerId || params.business.stripe_customer_id || null;

  if (existingCustomerId) {
    await params.supabase
      .from("business_entitlements")
      .update({ subscription_stripe_customer_id: existingCustomerId })
      .eq("business_id", params.business.id);
    return existingCustomerId;
  }

  const email = params.business.billing_email || params.business.business_email;
  const existing = await params.stripe.customers.search({
    query: `email:'${email.replace(/'/g, "\\'")}'`,
    limit: 1,
  });

  const customerId = existing.data[0]?.id || (await params.stripe.customers.create({
    email,
    name: params.business.business_name || undefined,
    metadata: buildBusinessSubscriptionMetadata({
      businessId: params.business.id,
      businessEmail: params.business.business_email,
      userId: params.userId,
    }),
  })).id;

  await params.supabase
    .from("business_entitlements")
    .update({ subscription_stripe_customer_id: customerId })
    .eq("business_id", params.business.id);

  return customerId;
}

export async function findExistingLiveSubscription(params: {
  stripe: Stripe;
  customerId: string;
  subscriptionId?: string | null;
}) {
  if (params.subscriptionId) {
    try {
      const subscription = await params.stripe.subscriptions.retrieve(params.subscriptionId);
      if (isLiveStripeSubscription(subscription.status)) return subscription;
    } catch {
      // fall through to customer subscription list
    }
  }

  const subscriptions = await params.stripe.subscriptions.list({
    customer: params.customerId,
    status: "all",
    limit: 20,
  });

  return subscriptions.data.find((subscription) => isLiveStripeSubscription(subscription.status)) || null;
}

export function isLiveStripeSubscription(status?: string | null) {
  return ["active", "trialing", "past_due", "unpaid", "incomplete"].includes(String(status || "").toLowerCase());
}

export async function syncBusinessEntitlementFromStripeSubscription(params: {
  supabase: SupabaseClient;
  subscription: StripeSubscriptionLike;
  fallbackBusinessId?: string | null;
  fallbackUserId?: string | null;
  sourceEventType: string;
}) {
  const subscription = params.subscription;
  const metadata = subscription.metadata || {};
  const businessId = metadata.business_id || params.fallbackBusinessId || null;
  const userId = metadata.user_id || params.fallbackUserId || null;
  const stripeCustomerId = getStripeCustomerIdFromSubscription(subscription);
  const billingStatus = resolveBillingStatusFromSubscription(subscription);
  const periodEnd = getSubscriptionCurrentPeriodEnd(subscription);
  const cancelledAt = toIsoFromStripeSeconds(subscription.canceled_at || null);
  const startedAt = toIsoFromStripeSeconds(subscription.created || null);

  let entitlementQuery = params.supabase
    .from("business_entitlements")
    .select("id,business_id,business_email,is_grandfathered,billing_status,subscription_required")
    .limit(1);

  if (businessId) {
    entitlementQuery = entitlementQuery.eq("business_id", businessId);
  } else if (stripeCustomerId) {
    entitlementQuery = entitlementQuery.eq("subscription_stripe_customer_id", stripeCustomerId);
  } else {
    throw new Error("Cannot sync subscription without business_id or Stripe customer id");
  }

  const { data: entitlementRow, error: entitlementError } = await entitlementQuery.maybeSingle();
  if (entitlementError) throw new Error(`Failed to load entitlement for subscription sync: ${entitlementError.message}`);
  if (!entitlementRow) throw new Error("No business entitlement matched Stripe subscription");

  const typedEntitlementRow = entitlementRow as EntitlementWithIdRow;
  const entitlement = evaluateBusinessEntitlement(typedEntitlementRow);
  if (entitlement.isGrandfathered) {
    return {
      businessId: entitlement.businessId,
      businessEmail: entitlement.businessEmail,
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      billingStatus: entitlement.billingStatus as BusinessSubscriptionBillingStatus,
      subscriptionRequired: false,
      subscriptionStartedAt: entitlement.subscriptionStartedAt,
      subscriptionCurrentPeriodEnd: entitlement.subscriptionCurrentPeriodEnd,
      subscriptionCancelledAt: entitlement.subscriptionCancelledAt,
    } satisfies BusinessSubscriptionSyncResult;
  }

  const { data: updated, error: updateError } = await params.supabase
    .from("business_entitlements")
    .update({
      billing_status: billingStatus,
      subscription_required: !["subscription_active", "subscription_trialing"].includes(billingStatus),
      subscription_stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: subscription.id,
      subscription_started_at: startedAt,
      subscription_current_period_end: periodEnd,
      subscription_cancelled_at: cancelledAt,
    })
    .eq("business_id", entitlement.businessId)
    .select("business_id,business_email,billing_status,subscription_required,subscription_stripe_customer_id,stripe_subscription_id,subscription_started_at,subscription_current_period_end,subscription_cancelled_at")
    .single();

  if (updateError) throw new Error(`Failed to update business entitlement from Stripe: ${updateError.message}`);

  await params.supabase.from("business_entitlement_events").insert({
    business_entitlement_id: typedEntitlementRow.id,
    business_id: entitlement.businessId,
    business_email: entitlement.businessEmail,
    event_type: "business_subscription_status_synced",
    billing_status: billingStatus,
    metadata: {
      source: "stripe_webhook",
      sourceEventType: params.sourceEventType,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId,
      userId,
      stripeStatus: subscription.status || null,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    },
  });

  return {
    businessId: updated.business_id,
    businessEmail: updated.business_email,
    stripeCustomerId: updated.subscription_stripe_customer_id,
    stripeSubscriptionId: updated.stripe_subscription_id,
    billingStatus: updated.billing_status,
    subscriptionRequired: Boolean(updated.subscription_required),
    subscriptionStartedAt: updated.subscription_started_at,
    subscriptionCurrentPeriodEnd: updated.subscription_current_period_end,
    subscriptionCancelledAt: updated.subscription_cancelled_at,
  } satisfies BusinessSubscriptionSyncResult;
}

export async function getEntitlementOrThrow(params: {
  supabase: SupabaseClient;
  businessId: string;
}) {
  const entitlement = await getBusinessEntitlement({ businessId: params.businessId, supabase: params.supabase });
  if (!entitlement) throw new Error("Business entitlement not found");
  return entitlement;
}

export { STRIPE_API_VERSION };

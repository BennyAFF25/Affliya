import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createStripeClient } from "./stripe";

export type BusinessPaymentReadiness = {
  hasPaymentMethod: boolean;
  reason?: string;
  customerId?: string | null;
  source?: "business_profile" | "business_entitlement" | null;
};

async function customerHasPaymentMethod(stripe: Stripe, customerId: string) {
  const customer = await stripe.customers.retrieve(customerId, {
    expand: ["invoice_settings.default_payment_method"],
  });

  if (customer.deleted) return false;

  const defaultPm = customer.invoice_settings?.default_payment_method;
  if (defaultPm) return true;

  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: "card",
    limit: 1,
  });

  return (paymentMethods.data?.length || 0) > 0;
}

export async function getBusinessPaymentReadiness(params: {
  supabase: SupabaseClient;
  businessEmail: string;
  stripe?: Stripe;
}): Promise<BusinessPaymentReadiness> {
  const businessEmail = params.businessEmail.trim();
  if (!businessEmail) return { hasPaymentMethod: false, reason: "missing_business_email" };

  const stripe = params.stripe || createStripeClient();

  const { data: profile, error: profileError } = await params.supabase
    .from("business_profiles")
    .select("stripe_customer_id")
    .eq("business_email", businessEmail)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Failed to load business profile payment readiness: ${profileError.message}`);
  }

  const { data: entitlement, error: entitlementError } = await params.supabase
    .from("business_entitlements")
    .select("subscription_stripe_customer_id")
    .eq("business_email", businessEmail)
    .maybeSingle();

  if (entitlementError) {
    throw new Error(`Failed to load business entitlement payment readiness: ${entitlementError.message}`);
  }

  const candidates = [
    {
      customerId: (profile as { stripe_customer_id?: string | null } | null)?.stripe_customer_id || null,
      source: "business_profile" as const,
    },
    {
      customerId: (entitlement as { subscription_stripe_customer_id?: string | null } | null)?.subscription_stripe_customer_id || null,
      source: "business_entitlement" as const,
    },
  ].filter((candidate, index, all) => {
    if (!candidate.customerId) return false;
    return all.findIndex((other) => other.customerId === candidate.customerId) === index;
  });

  if (candidates.length === 0) {
    return { hasPaymentMethod: false, reason: "missing_customer", customerId: null, source: null };
  }

  for (const candidate of candidates) {
    if (await customerHasPaymentMethod(stripe, candidate.customerId)) {
      return {
        hasPaymentMethod: true,
        customerId: candidate.customerId,
        source: candidate.source,
      };
    }
  }

  return {
    hasPaymentMethod: false,
    reason: "missing_payment_method",
    customerId: candidates[0]?.customerId || null,
    source: candidates[0]?.source || null,
  };
}

export async function assertBusinessPaymentReadyForCommission(params: {
  supabase: SupabaseClient;
  businessEmail: string;
}): Promise<BusinessPaymentReadiness & { ok: boolean; status: number; error?: string; message?: string }> {
  const readiness = await getBusinessPaymentReadiness(params);
  if (readiness.hasPaymentMethod) {
    return { ...readiness, ok: true, status: 200 };
  }

  return {
    ...readiness,
    ok: false,
    status: 402,
    error: "BUSINESS_PAYMENT_METHOD_REQUIRED",
    message:
      "Add a business payment method before launching affiliate campaigns. This protects affiliate commission payouts once tracked sales occur.",
  };
}

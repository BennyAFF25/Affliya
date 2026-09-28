import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createStripeClient } from "./stripe";

export type BusinessPaymentReadiness = {
  hasPaymentMethod: boolean;
  reason?: string;
  customerId?: string | null;
  source?: "business_profile" | "business_entitlement" | null;
};

function isMissingStripeCustomer(error: unknown) {
  const stripeError = error as { code?: string; message?: string };
  const message = String(stripeError?.message || "");
  return (
    (stripeError?.code === "resource_missing" && /customer/i.test(message)) ||
    /No such customer/i.test(message)
  );
}

async function customerHasPaymentMethod(stripe: Stripe, customerId: string) {
  try {
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
  } catch (error) {
    // A stale commission customer should be treated as billing not connected,
    // not as a fatal readiness error that prevents the proposal from opening.
    if (isMissingStripeCustomer(error)) return false;
    throw error;
  }
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

  // Commission/ad-spend billing is intentionally separate from the Nettmark
  // Business / Growth subscription. The Growth customer may live under a
  // different Stripe account/key and must never be treated as commission
  // payment readiness here.
  const customerId =
    (profile as { stripe_customer_id?: string | null } | null)?.stripe_customer_id || null;

  if (!customerId) {
    return {
      hasPaymentMethod: false,
      reason: "missing_customer",
      customerId: null,
      source: null,
    };
  }

  const hasPaymentMethod = await customerHasPaymentMethod(stripe, customerId);

  return {
    hasPaymentMethod,
    reason: hasPaymentMethod ? undefined : "missing_payment_method",
    customerId,
    source: "business_profile",
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

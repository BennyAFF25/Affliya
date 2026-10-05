import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import {
  BUSINESS_GROWTH_TRIAL_DAYS,
  buildBusinessSubscriptionMetadata,
  createBusinessSubscriptionStripeClient,
  createServerSupabaseClient,
  ensureSubscriptionCustomer,
  findExistingLiveSubscription,
  getBusinessSubscriptionBaseUrl,
  getBusinessSubscriptionPriceId,
  getGrowthTrialEligibility,
  getGrowthSubscriptionPrice,
  getEntitlementOrThrow,
  getSubscriptionCurrentPeriodEnd,
  getOwnedBusinessForUser,
  isBusinessSubscriptionCheckoutEnabled,
  resolveBillingStatusFromSubscription,
  toIsoFromStripeSeconds,
} from "../../../../utils/businessSubscriptions";
import { trackBusinessSubscriptionAnalytics } from "../../../../utils/businessSubscriptionAnalytics";

import { getBusinessFunnelMetadata } from "../../../../utils/businessOnboardingServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeReturnPath(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw || !raw.startsWith("/")) return "/business/settings";
  if (raw.startsWith("//") || raw.includes("\\")) return "/business/settings";
  return raw.slice(0, 500);
}

function appendReturnQuery(baseUrl: string, returnTo: string, query: string) {
  const separator = returnTo.includes("?") ? "&" : "?";
  return `${baseUrl}${returnTo}${separator}${query}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const businessId = String(body?.businessId || body?.business_id || "").trim();
    const returnTo = safeReturnPath(body?.returnTo || body?.return_to);
    const intendedAction = typeof body?.intendedAction === "string" ? body.intendedAction.slice(0, 120) : null;
    const submissionId = typeof body?.submissionId === "string" ? body.submissionId.slice(0, 120) : null;
    const campaignId = typeof body?.campaignId === "string" ? body.campaignId.slice(0, 120) : submissionId;
    const attribution = body?.attribution && typeof body.attribution === "object" ? body.attribution : {};

    if (!businessId) return NextResponse.json({ error: "businessId is required" }, { status: 400 });

    const userSupabase = createRouteHandlerClient({ cookies });
    const { data: authData, error: authError } = await userSupabase.auth.getUser();
    const user = authData?.user || null;
    if (authError || !user?.id || !user.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createServerSupabaseClient();
    const business = await getOwnedBusinessForUser({ supabase: admin, businessId, userId: user.id, userEmail: user.email });
    if (!business) return NextResponse.json({ error: "Business not found or not authorized" }, { status: 403 });

    const entitlement = await getEntitlementOrThrow({ supabase: admin, businessId: business.id });
    if (entitlement.isGrandfathered) {
      return NextResponse.json({ status: "grandfathered", message: "This business is grandfathered and does not require a Nettmark Business subscription.", entitlement });
    }
    if (!isBusinessSubscriptionCheckoutEnabled()) {
      return NextResponse.json({ status: "checkout_disabled", message: "Business subscription checkout is disabled.", entitlement }, { status: 403 });
    }

    const { data: trialHistory, error: trialHistoryError } = await admin
      .from("business_entitlements")
      .select("growth_trial_used,growth_trial_started_at")
      .eq("business_id", business.id)
      .maybeSingle();

    if (trialHistoryError) {
      throw new Error(`Failed to load Growth trial history: ${trialHistoryError.message}`);
    }

    const priceId = getBusinessSubscriptionPriceId();
    if (!priceId) return NextResponse.json({ error: "Missing STRIPE_NETTMARK_BUSINESS_MONTHLY_PRICE_ID" }, { status: 500 });

    const stripe = createBusinessSubscriptionStripeClient();
    if (body?.requireTrial === true) {
      const eligible = await getGrowthTrialEligibility({ stripe, supabase: admin, business, entitlement });
      if (!eligible) return NextResponse.json({ status: "trial_unavailable", error: "This business is no longer eligible for a free trial. No checkout was created. Refresh to see your options." }, { status: 409 });
      // Verify the same configured price advertised on the continuation screen.
      await getGrowthSubscriptionPrice(stripe);
    }
    const customerId = await ensureSubscriptionCustomer({ stripe, supabase: admin, business, entitlement, userId: user.id });
    const existingSubscription = await findExistingLiveSubscription({ stripe, customerId, subscriptionId: entitlement.stripeSubscriptionId });
    if (existingSubscription) {
      return NextResponse.json({ status: "already_subscribed", stripeSubscriptionId: existingSubscription.id, billingStatus: resolveBillingStatusFromSubscription(existingSubscription), currentPeriodEnd: getSubscriptionCurrentPeriodEnd(existingSubscription) });
    }

    const historicalSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
    });

    const priorNettmarkSubscription = historicalSubscriptions.data.find((subscription) => {
      const metadata = subscription.metadata || {};
      return metadata.nettmark_action === "business_subscription" || metadata.business_id === business.id;
    }) || null;

    const trialPreviouslyUsed = Boolean(trialHistory?.growth_trial_used) || Boolean(priorNettmarkSubscription);
    const trialEligible = !trialPreviouslyUsed && !historicalSubscriptions.has_more;
    if (body?.requireTrial === true && !trialEligible) return NextResponse.json({ status: "trial_unavailable", error: "A free trial is no longer available. No paid checkout was created." }, { status: 409 });

    if (priorNettmarkSubscription && !trialHistory?.growth_trial_used) {
      const inferredTrialStartedAt =
        trialHistory?.growth_trial_started_at ||
        toIsoFromStripeSeconds(priorNettmarkSubscription.trial_start || priorNettmarkSubscription.created || null);

      const { error: trialBackfillError } = await admin
        .from("business_entitlements")
        .update({
          growth_trial_used: true,
          growth_trial_started_at: inferredTrialStartedAt,
        })
        .eq("business_id", business.id);

      if (trialBackfillError) {
        console.warn("[business-subscription/create-checkout-session] failed to self-heal Growth trial history", {
          businessId: business.id,
          message: trialBackfillError.message,
        });
      }
    }

    const baseUrl = getBusinessSubscriptionBaseUrl();
    const cohort = await getBusinessFunnelMetadata(admin, business.id).catch(() => ({ business_id: business.id, business_onboarding_funnel: "unverified" }));
    const metadata = {
      ...cohort,
      ...buildBusinessSubscriptionMetadata({ businessId: business.id, userId: user.id, businessEmail: business.business_email }),
      returnTo,
      intendedAction: intendedAction || "",
      campaignId: campaignId || "",
      submissionId: submissionId || "",
      trialEligibleAtCheckout: trialEligible ? "true" : "false",
    };

    const subscriptionData = trialEligible
      ? {
          metadata,
          trial_period_days: BUSINESS_GROWTH_TRIAL_DAYS,
          trial_settings: { end_behavior: { missing_payment_method: "cancel" as const } },
        }
      : { metadata };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      metadata,
      payment_method_collection: "always",
      subscription_data: subscriptionData,
      success_url: appendReturnQuery(
        baseUrl,
        returnTo,
        "subscription=checkout_returned&session_id={CHECKOUT_SESSION_ID}",
      ),
      cancel_url: appendReturnQuery(
        baseUrl,
        returnTo,
        `subscription=cancelled${trialEligible ? "" : "&resume=1"}`,
      ),
    }, {
      idempotencyKey: `business_subscription_checkout:${business.id}:${customerId}:${entitlement.billingStatus}:${entitlement.stripeSubscriptionId || "none"}:${trialEligible ? "trial" : "paid"}:${intendedAction || "general"}:${submissionId || "none"}`,
    });

    await trackBusinessSubscriptionAnalytics({
      supabase: admin,
      eventType: "subscription_checkout_started",
      businessId: business.id,
      businessEmail: business.business_email,
      campaignId,
      intendedAction,
      submissionId,
      returnTo,
      attribution: attribution as Record<string, unknown>,
      metadata: { ...cohort, source: "checkout_endpoint", checkoutSessionId: session.id, stripeCustomerId: customerId, userId: user.id, trialDays: trialEligible ? BUSINESS_GROWTH_TRIAL_DAYS : 0, trialEligible },
    });

    await admin.from("business_entitlement_events").insert({
      business_id: business.id,
      business_email: business.business_email,
      event_type: "business_subscription_checkout_created",
      billing_status: entitlement.billingStatus,
      metadata: { source: "checkout_endpoint", checkoutSessionId: session.id, stripeCustomerId: customerId, userId: user.id, returnTo, intendedAction, campaignId, submissionId, attribution, trialDays: trialEligible ? BUSINESS_GROWTH_TRIAL_DAYS : 0, trialEligible },
    });

    const { error: productEventError } = await admin.from("product_events").insert({
      event_type: "plan_growth_checkout_started",
      actor_email: business.business_email,
      actor_role: "business",
      meta: {
        ...cohort,
        source: "checkout_endpoint",
        checkoutSessionId: session.id,
        trialEligible,
        trialDays: trialEligible ? BUSINESS_GROWTH_TRIAL_DAYS : 0,
        intendedAction,
        returnTo,
      },
    });

    if (productEventError) {
      console.warn("[business-subscription/create-checkout-session] failed to log product event", {
        businessId: business.id,
        message: productEventError.message,
      });
    }

    return NextResponse.json({
      status: "checkout_created",
      url: session.url,
      sessionId: session.id,
      trialEligible,
      trialDays: trialEligible ? BUSINESS_GROWTH_TRIAL_DAYS : 0,
    });
  } catch (err: unknown) {
    console.error("[business-subscription/create-checkout-session]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create business subscription checkout" }, { status: 500 });
  }
}

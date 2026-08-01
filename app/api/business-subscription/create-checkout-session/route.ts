import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import {
  buildBusinessSubscriptionMetadata,
  createBusinessSubscriptionStripeClient,
  createServerSupabaseClient,
  ensureSubscriptionCustomer,
  findExistingLiveSubscription,
  getBusinessSubscriptionBaseUrl,
  getBusinessSubscriptionPriceId,
  getEntitlementOrThrow,
  getSubscriptionCurrentPeriodEnd,
  getOwnedBusinessForUser,
  isBusinessSubscriptionCheckoutEnabled,
  resolveBillingStatusFromSubscription,
} from "../../../../utils/businessSubscriptions";
import { trackBusinessSubscriptionAnalytics } from "../../../../utils/businessSubscriptionAnalytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeReturnPath(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw || !raw.startsWith("/")) return "/business/settings";
  if (raw.startsWith("//") || raw.includes("\\")) return "/business/settings";
  return raw.slice(0, 500);
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

    if (!businessId) {
      return NextResponse.json({ error: "businessId is required" }, { status: 400 });
    }

    const userSupabase = createRouteHandlerClient({ cookies });
    const { data: authData, error: authError } = await userSupabase.auth.getUser();
    const user = authData?.user || null;

    if (authError || !user?.id || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createServerSupabaseClient();
    const business = await getOwnedBusinessForUser({
      supabase: admin,
      businessId,
      userId: user.id,
      userEmail: user.email,
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found or not authorized" }, { status: 403 });
    }

    const entitlement = await getEntitlementOrThrow({ supabase: admin, businessId: business.id });

    if (entitlement.isGrandfathered) {
      return NextResponse.json({
        status: "grandfathered",
        message: "This business is grandfathered and does not require a Nettmark Business subscription.",
        entitlement,
      });
    }

    if (!isBusinessSubscriptionCheckoutEnabled()) {
      return NextResponse.json(
        {
          status: "checkout_disabled",
          message: "Business subscription checkout is disabled.",
          entitlement,
        },
        { status: 403 },
      );
    }

    const priceId = getBusinessSubscriptionPriceId();
    if (!priceId) {
      return NextResponse.json(
        { error: "Missing STRIPE_NETTMARK_BUSINESS_MONTHLY_PRICE_ID" },
        { status: 500 },
      );
    }

    const stripe = createBusinessSubscriptionStripeClient();
    const customerId = await ensureSubscriptionCustomer({
      stripe,
      supabase: admin,
      business,
      entitlement,
      userId: user.id,
    });

    const existingSubscription = await findExistingLiveSubscription({
      stripe,
      customerId,
      subscriptionId: entitlement.stripeSubscriptionId,
    });

    if (existingSubscription) {
      return NextResponse.json({
        status: "already_subscribed",
        stripeSubscriptionId: existingSubscription.id,
        billingStatus: resolveBillingStatusFromSubscription(existingSubscription),
        currentPeriodEnd: getSubscriptionCurrentPeriodEnd(existingSubscription),
      });
    }

    const baseUrl = getBusinessSubscriptionBaseUrl();
    const metadata = {
      ...buildBusinessSubscriptionMetadata({
        businessId: business.id,
        userId: user.id,
        businessEmail: business.business_email,
      }),
      returnTo,
      intendedAction: intendedAction || "",
      campaignId: campaignId || "",
      submissionId: submissionId || "",
    };

    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        client_reference_id: user.id,
        metadata,
        subscription_data: { metadata },
        success_url: `${baseUrl}${returnTo}?subscription=checkout_returned&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}${returnTo}?subscription=cancelled`,
      },
      {
        idempotencyKey: `business_subscription_checkout:${business.id}:${customerId}:${entitlement.billingStatus}:${entitlement.stripeSubscriptionId || "none"}:${intendedAction || "general"}:${submissionId || "none"}`,
      },
    );

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
      metadata: {
        source: "checkout_endpoint",
        checkoutSessionId: session.id,
        stripeCustomerId: customerId,
        userId: user.id,
      },
    });

    await admin.from("business_entitlement_events").insert({
      business_id: business.id,
      business_email: business.business_email,
      event_type: "business_subscription_checkout_created",
      billing_status: entitlement.billingStatus,
      metadata: {
        source: "checkout_endpoint",
        checkoutSessionId: session.id,
        stripeCustomerId: customerId,
        userId: user.id,
        returnTo,
        intendedAction,
        campaignId,
        submissionId,
        attribution,
      },
    });

    return NextResponse.json({
      status: "checkout_created",
      url: session.url,
      sessionId: session.id,
    });
  } catch (err: unknown) {
    console.error("[business-subscription/create-checkout-session]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create business subscription checkout" },
      { status: 500 },
    );
  }
}

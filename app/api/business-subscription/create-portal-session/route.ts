import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import {
  createBusinessSubscriptionStripeClient,
  createServerSupabaseClient,
  entitlementAllowsBillingAccess,
  getBusinessSubscriptionBaseUrl,
  getEntitlementOrThrow,
  getOwnedBusinessForUser,
} from "../../../../utils/businessSubscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const businessId = String(body?.businessId || body?.business_id || "").trim();

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
    const customerId = entitlement.subscriptionStripeCustomerId;

    if (!customerId || entitlement.isGrandfathered || !entitlementAllowsBillingAccess(entitlement)) {
      return NextResponse.json(
        {
          error: "No business subscription billing portal is available for this business.",
          status: entitlement.isGrandfathered ? "grandfathered" : entitlement.billingStatus,
        },
        { status: 403 },
      );
    }

    const stripe = createBusinessSubscriptionStripeClient();
    const baseUrl = getBusinessSubscriptionBaseUrl();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/business/settings?subscription=portal_returned`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err: unknown) {
    console.error("[business-subscription/create-portal-session]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create business subscription portal session" },
      { status: 500 },
    );
  }
}

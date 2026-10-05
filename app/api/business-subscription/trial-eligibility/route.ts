import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import {
  BUSINESS_GROWTH_TRIAL_DAYS, createServerSupabaseClient, createBusinessSubscriptionStripeClient,
  getOwnedBusinessForUser, getEntitlementOrThrow, getGrowthTrialEligibility, getGrowthSubscriptionPrice,
  isBusinessSubscriptionCheckoutEnabled,
} from "../../../../utils/businessSubscriptions";
import { getBusinessFunnelMetadata } from "../../../../utils/businessOnboardingServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const userClient = createRouteHandlerClient({ cookies });
    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const businessId = new URL(req.url).searchParams.get("businessId") || "";
    const admin = createServerSupabaseClient();
    const business = await getOwnedBusinessForUser({ supabase: admin, businessId, userId: user.id, userEmail: user.email });
    if (!business) return NextResponse.json({ error: "Business not found" }, { status: 403 });
    const entitlement = await getEntitlementOrThrow({ supabase: admin, businessId });
    const cohort = await getBusinessFunnelMetadata(admin, businessId);
    const [{ data: offer, error: offerError }, { data: entry, error: entryError }, { data: freeChoice, error: choiceError }] = await Promise.all([
      admin.from("offers").select("id,participation_mode").eq("business_email", business.business_email).order("created_at", { ascending: true }).limit(1).maybeSingle(),
      admin.from("business_entitlements").select("billing_entry_mode").eq("business_id", businessId).maybeSingle(),
      admin.from("product_events").select("id").eq("actor_email", business.business_email).eq("event_type", "plan_free_clicked").contains("meta", { choice_confirmed: true }).limit(1).maybeSingle(),
    ]);
    if (offerError || entryError || choiceError) throw new Error("Could not verify onboarding progress.");
    const onboardingEligible = Boolean(offer && entry?.billing_entry_mode === "plan_choice" && !freeChoice && !entitlement.isGrandfathered && !entitlement.stripeSubscriptionId &&
      !["subscription_active", "subscription_trialing", "subscription_past_due", "subscription_unpaid", "subscription_incomplete"].includes(entitlement.billingStatus));
    const treatment = onboardingEligible && cohort.business_onboarding_funnel === "trial_first_v1";
    let price: Awaited<ReturnType<typeof getGrowthSubscriptionPrice>> | null = null;
    let trialEligible: boolean | null = null;
    let billingError: string | null = null;
    try {
      const stripe = createBusinessSubscriptionStripeClient();
      [price, trialEligible] = await Promise.all([
        getGrowthSubscriptionPrice(stripe),
        getGrowthTrialEligibility({ stripe, supabase: admin, business, entitlement }),
      ]);
    } catch {
      billingError = "We couldn't verify Growth pricing and trial eligibility. Please retry, or continue with Free.";
    }
    return NextResponse.json({
      ...cohort, treatment: treatment && trialEligible !== false, offerId: offer?.id || null, participationMode: offer?.participation_mode || "open",
      trialEligible, trialDays: BUSINESS_GROWTH_TRIAL_DAYS, price, billingError,
      checkoutEnabled: isBusinessSubscriptionCheckoutEnabled(),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not load your business continuation. Please retry." }, { status: 503 });
  }
}

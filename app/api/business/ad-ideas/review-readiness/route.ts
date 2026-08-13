import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "@/../utils/businessSubscriptions";
import { getBusinessPaymentReadiness } from "@/../utils/businessPaymentReadiness";
import { getBusinessEntitlement } from "@/../utils/businessEntitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userSupabase = createRouteHandlerClient({ cookies });
    const { data: authData, error: authError } = await userSupabase.auth.getUser();
    const user = authData?.user || null;

    if (authError || !user?.email) {
      return NextResponse.json({ success: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const admin = createServerSupabaseClient();
    const [payment, entitlement, profileResult] = await Promise.all([
      getBusinessPaymentReadiness({ supabase: admin as never, businessEmail: user.email }),
      getBusinessEntitlement({ supabase: admin as never, businessEmail: user.email }).catch((error) => {
        console.warn("[business/ad-ideas/review-readiness] entitlement lookup failed", error);
        return null;
      }),
      admin
        .from("business_profiles")
        .select("id")
        .eq("business_email", user.email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (profileResult.error) {
      console.warn("[business/ad-ideas/review-readiness] profile lookup failed", profileResult.error);
    }

    const fallbackBusinessId = (profileResult.data as { id?: string | null } | null)?.id || null;

    return NextResponse.json({
      success: true,
      businessEmail: user.email,
      billing: {
        ready: payment.hasPaymentMethod,
        reason: payment.reason || null,
        customerId: payment.customerId || null,
        source: payment.source || null,
      },
      subscription: {
        ready: Boolean(entitlement?.canLaunchCampaign),
        required: Boolean(entitlement?.subscriptionRequired ?? true),
        grandfathered: Boolean(entitlement?.isGrandfathered),
        status: entitlement?.billingStatus || "unknown",
        businessId: entitlement?.businessId || fallbackBusinessId,
      },
    });
  } catch (error) {
    console.error("[business/ad-ideas/review-readiness]", error);
    return NextResponse.json(
      { success: false, error: "REVIEW_READINESS_FAILED", message: error instanceof Error ? error.message : "Could not load review readiness." },
      { status: 500 },
    );
  }
}

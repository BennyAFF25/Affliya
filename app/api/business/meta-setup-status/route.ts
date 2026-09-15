import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "../../../../utils/businessSubscriptions";
import { getBusinessEntitlement } from "../../../../utils/businessEntitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userSupabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: authError,
    } = await userSupabase.auth.getUser();

    if (authError || !user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createServerSupabaseClient();

    const { data: business, error: businessError } = await admin
      .from("business_profiles")
      .select("id,business_email")
      .eq("business_email", user.email)
      .limit(1)
      .maybeSingle();

    if (businessError) {
      throw new Error(`Failed to load business profile: ${businessError.message}`);
    }

    if (!business?.id) {
      return NextResponse.json({
        isGrowth: false,
        hasMetaConnection: false,
        businessId: null,
        billingStatus: "free",
        currentPeriodEnd: null,
      });
    }

    const [entitlement, metaResult] = await Promise.all([
      getBusinessEntitlement({
        businessId: business.id,
        businessEmail: business.business_email,
        supabase: admin,
      }),
      admin
        .from("meta_connections")
        .select("ad_account_id,page_id")
        .eq("business_email", user.email)
        .limit(20),
    ]);

    if (metaResult.error) {
      throw new Error(`Failed to load Meta connection: ${metaResult.error.message}`);
    }

    const billingStatus = entitlement?.billingStatus || "free";
    const isGrowth =
      billingStatus === "subscription_trialing" ||
      billingStatus === "subscription_active";

    const hasMetaConnection = (metaResult.data || []).some(
      (row) => Boolean(row?.ad_account_id) && Boolean(row?.page_id),
    );

    return NextResponse.json({
      isGrowth,
      hasMetaConnection,
      businessId: business.id,
      billingStatus,
      currentPeriodEnd: entitlement?.subscriptionCurrentPeriodEnd || null,
    });
  } catch (error) {
    console.error("[business/meta-setup-status]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load Meta setup status" },
      { status: 500 },
    );
  }
}

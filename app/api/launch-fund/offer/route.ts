import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "../../../../utils/businessSubscriptions";
import { getActiveLaunchFundAllocation, trackLaunchFundViewed } from "../../../../utils/launchFund";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const userSupabase = createRouteHandlerClient({ cookies });
    const { data: authData } = await userSupabase.auth.getUser();
    const user = authData?.user || null;
    if (!user?.email) return NextResponse.json({ allocation: null }, { status: 401 });

    const url = new URL(req.url);
    const offerId = String(url.searchParams.get("offerId") || url.searchParams.get("offer_id") || "").trim();
    if (!offerId) return NextResponse.json({ allocation: null, error: "offerId is required" }, { status: 400 });

    const supabase = createServerSupabaseClient();
    const allocation = await getActiveLaunchFundAllocation({
      supabase: supabase as never,
      affiliateEmail: user.email,
      offerId,
    });

    if (allocation) {
      await trackLaunchFundViewed({ supabase: supabase as never, allocation, offerId }).catch(() => null);
    }

    return NextResponse.json({ allocation });
  } catch (err: unknown) {
    console.error("[launch-fund/offer]", err);
    return NextResponse.json(
      { allocation: null, error: err instanceof Error ? err.message : "Failed to load Launch Fund allocation" },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { isOfferTrackingDisplayReady } from "@/../utils/tracking/displayReadiness";
import { handleTrackingReadiness, type ReadinessDeps } from "@/../utils/tracking/readinessRequest";
import { assertOfferTrackingReady, type QueryClient } from "@/../utils/approvals/enforcement";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const result = await handleTrackingReadiness(body, {
      getUser: async () => {
        const { data, error } = await createRouteHandlerClient({ cookies }).auth.getUser();
        return error ? null : data.user;
      },
      admin: admin as unknown as ReadinessDeps["admin"],
      lookupOffers: async (offerIds) => {
        const { data, error } = await admin.from("offers").select("id,business_email").in("id", offerIds);
        if (error) throw new Error("Tracking readiness offer ownership lookup failed");
        return (data || []) as { id: string; business_email: string | null }[];
      },
      checkDisplay: isOfferTrackingDisplayReady,
      checkApproval: (client: QueryClient, offerId: string) => assertOfferTrackingReady(client, offerId),
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("[tracking-readiness] unexpected error", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

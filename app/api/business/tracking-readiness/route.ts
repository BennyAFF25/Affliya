import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const offerIds = Array.isArray(body?.offerIds)
      ? body.offerIds.filter((id: unknown): id is string => typeof id === "string")
      : [];

    if (!offerIds.length) {
      return NextResponse.json({ verifiedOfferIds: [] });
    }

    const { data, error } = await supabase
      .from("campaign_tracking_events")
      .select("offer_id")
      .in("offer_id", offerIds)
      .eq("event_type", "test_pixel");

    if (error) {
      console.error("[tracking-readiness] query failed", error);
      return NextResponse.json({ error: "query_failed" }, { status: 500 });
    }

    const verifiedOfferIds = Array.from(
      new Set(
        (data || [])
          .map((row: { offer_id?: string | null }) => row.offer_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    return NextResponse.json({ verifiedOfferIds });
  } catch (error) {
    console.error("[tracking-readiness] unexpected error", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

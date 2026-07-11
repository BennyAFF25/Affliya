import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  assertOfferTrackingReady,
  type QueryClient,
} from "@/../utils/approvals/enforcement";

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

    const verifiedOfferIds: string[] = [];

    for (const offerId of offerIds) {
      const readiness = await assertOfferTrackingReady(
        supabase as unknown as QueryClient,
        offerId,
      );
      if (readiness.ok) verifiedOfferIds.push(offerId);
    }

    return NextResponse.json({ verifiedOfferIds });
  } catch (error) {
    console.error("[tracking-readiness] unexpected error", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

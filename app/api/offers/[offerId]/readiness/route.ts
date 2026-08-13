import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveOfferPaidReadiness } from "@/../utils/offerReadiness";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ offerId: string }> },
) {
  try {
    const { offerId } = await params;
    const readiness = await resolveOfferPaidReadiness({ supabase, offerId });
    console.log("[offers/readiness] resolved", {
      offerId,
      businessEmail: readiness.businessEmail,
      metaReady: readiness.metaReady,
      metaReason: readiness.metaReason,
      metaSource: readiness.metaSource,
      trackingReady: readiness.trackingReady,
      pageId: readiness.resolvedMeta.pageId,
      adAccountId: readiness.resolvedMeta.adAccountId,
      pixelId: readiness.resolvedMeta.pixelId,
      counts: readiness.counts,
    });
    return NextResponse.json({ success: true, readiness });
  } catch (error) {
    console.error("[offers/readiness]", error);
    return NextResponse.json(
      {
        success: false,
        error: "READINESS_LOOKUP_FAILED",
        message: error instanceof Error ? error.message : "Failed to load offer readiness.",
      },
      { status: 500 },
    );
  }
}

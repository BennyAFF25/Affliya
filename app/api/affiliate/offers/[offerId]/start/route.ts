import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import supabaseAdmin from "@/../utils/supabase/server-client";
import { ensureAffiliateOfferParticipation, normalizeOfferParticipationMode } from "@/../utils/approvals/enforcement";

export async function POST(_req: Request, context: { params: Promise<{ offerId: string }> }) {
  try {
    const { offerId } = await context.params;
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: offer, error: offerError } = await (supabaseAdmin as any)
      .from("offers")
      .select("id, title, business_email, status, participation_mode")
      .eq("id", offerId)
      .maybeSingle();

    if (offerError) {
      throw new Error(offerError.message || "Failed to load offer.");
    }

    if (!offer?.id || !offer?.business_email) {
      return NextResponse.json({ ok: false, error: "Offer not found" }, { status: 404 });
    }

    const offerStatus = String(offer.status || "active").toLowerCase();
    if (!["active", "approved", "live", "published"].includes(offerStatus)) {
      return NextResponse.json({ ok: false, error: "offer_not_active", message: "This offer is not currently available." }, { status: 409 });
    }

    const participationMode = normalizeOfferParticipationMode(offer.participation_mode);

    const participation = await ensureAffiliateOfferParticipation(supabaseAdmin as any, {
      offerId,
      affiliateEmail: user.email,
      businessEmail: offer.business_email,
      participationMode,
      allowPendingCreation: participationMode === "approval_required",
    });

    if (!participation.ok) {
      return NextResponse.json(
        { ok: false, error: participation.error, message: participation.message },
        { status: participation.status },
      );
    }

    await (supabaseAdmin as any).from("product_events").insert({
      event_type: participation.created
        ? "affiliate_offer_participation_started"
        : "affiliate_offer_participation_resumed",
      actor_email: user.email,
      actor_role: "affiliate",
      offer_id: offerId,
      meta: {
        status: participation.status,
        source: "start_promoting",
        participationMode,
      },
    });

    return NextResponse.json({
      ok: true,
      offer: {
        id: offer.id,
        title: offer.title,
      },
      participation: {
        status: participation.status,
        created: participation.created,
      },
      participationMode,
      promotePath: participation.status === "approved" ? `/affiliate/dashboard/promote/${offerId}` : null,
      message:
        participation.status === "pending"
          ? "Request sent. This offer needs business approval before you can promote it."
          : "You can start promoting this offer now.",
    });
  } catch (error: unknown) {
    console.error("[affiliate/offers/start][POST] error", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

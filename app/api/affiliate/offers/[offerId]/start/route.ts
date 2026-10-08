import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import supabaseAdmin from "@/../utils/supabase/server-client";
import { ensureAffiliateOfferParticipation, normalizeOfferParticipationMode } from "@/../utils/approvals/enforcement";
import { sendEmail } from "@/../lib/email/send";
import { businessNewAffiliateRequestEmail } from "@/../lib/email/templates";
import { UUID } from "@/../utils/affiliate/onboarding";
import { getAffiliateUsername } from "@/../utils/profileIdentity";

export async function POST(_req: Request, context: { params: Promise<{ offerId: string }> }) {
  try {
    const { offerId } = await context.params;
    if (!UUID.test(offerId)) return NextResponse.json({ ok: false, error: "Invalid offer." }, { status: 400 });
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase.from("profiles").select("role,username").eq("id", user.id).maybeSingle();
    if (profileError) return NextResponse.json({ ok: false, error: "Could not verify account role." }, { status: 503 });
    if (profile?.role !== "affiliate") return NextResponse.json({ ok: false, error: "An affiliate account is required." }, { status: 403 });

    const offerSelectVariants = [
      "id, title, business_email, status, participation_mode",
      "id, title, business_email, participation_mode",
      "id, title, business_email, status",
      "id, title, business_email",
    ];

    let offer: any = null;
    let offerError: any = null;

    for (const columns of offerSelectVariants) {
      const result = await (supabaseAdmin as any)
        .from("offers")
        .select(columns)
        .eq("id", offerId)
        .maybeSingle();

      if (!result.error) {
        offer = result.data;
        offerError = null;
        break;
      }

      const message = String(result.error?.message || "").toLowerCase();
      if (!message.includes("status") && !message.includes("participation_mode")) {
        offerError = result.error;
        break;
      }

      offerError = result.error;
    }

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

    if (offer.participation_mode != null && !["open", "approval_required", "private"].includes(String(offer.participation_mode).toLowerCase())) {
      return NextResponse.json({ ok: false, error: "Offer access could not be verified." }, { status: 409 });
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

    if (participation.created) {
      try {
        const affiliateName = await getAffiliateUsername(supabaseAdmin as any, {
          userId: user.id,
          email: user.email,
        });
        const email = businessNewAffiliateRequestEmail({
          businessEmail: offer.business_email,
          affiliateEmail: user.email,
          affiliateName,
          offerTitle: offer.title || undefined,
          notes:
            participation.status === "approved"
              ? "This affiliate has joined your open offer and is approved to promote it."
              : "This affiliate is requesting approval to promote your offer.",
        });

        await sendEmail({
          to: offer.business_email,
          subject: email.subject,
          html: email.html,
        });
      } catch (emailError) {
        console.error("[affiliate/offers/start][business notification failed]", {
          businessEmail: offer.business_email,
          affiliateEmail: user.email,
          offerId,
          error: emailError instanceof Error ? emailError.message : emailError,
        });
      }
    }

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

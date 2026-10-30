import { resolveOfferCurrency } from "utils/currency/proposalCurrency";
import { promotionRequestId, PAID_DEMAND_WINDOW_MS } from "utils/affiliate/promotionRequests";
import { UUID } from "utils/affiliate/onboarding";
import { after, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import supabaseAdmin from "@/../utils/supabase/server-client";
import { sendEmail } from "@/../lib/email/send";
import { getBusinessEntitlement } from "@/../utils/businessEntitlements";
import { assertOfferTrackingReady } from "@/../utils/approvals/enforcement";
import { getAffiliateUsername } from "@/../utils/profileIdentity";
import { renderNettmarkEmail } from "@/../utils/email/renderNettmarkEmail";

export async function POST(req: Request, context: { params: Promise<{ offerId: string }> }) {
  try {
    const { offerId } = await context.params;
    if (!UUID.test(offerId)) return NextResponse.json({ ok: false, error: "Invalid offer." }, { status: 400 });
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError) throw profileError;
    if (profile?.role !== "affiliate") return NextResponse.json({ ok: false, error: "An affiliate account is required." }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const budget = Math.max(0, Number(body?.budget || 0));

    const { data: offer, error: offerError } = await (supabaseAdmin as any)
      .from("offers")
      .select("id,title,business_email,currency,meta_page_id,meta_ad_account_id").is("archived_at", null)
      .eq("id", offerId)
      .maybeSingle();

    if (offerError) throw offerError;
    if (!offer?.id || !offer?.business_email) {
      return NextResponse.json({ ok: false, error: "Offer not found" }, { status: 404 });
    }

    const { data: requestRow, error: requestError } = await (supabaseAdmin as any)
      .from("affiliate_requests")
      .select("id,status")
      .eq("offer_id", offerId)
      .eq("affiliate_email", user.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (requestError) throw requestError;
    if (requestRow && !["pending", "approved", "active", "accepted"].includes(String(requestRow.status).toLowerCase())) return NextResponse.json({ ok: false, error: "Offer access was rejected or is unavailable." }, { status: 403 });
    if (!requestRow?.id) {
      return NextResponse.json(
        { ok: false, error: "Start promoting this offer before requesting paid promotion." },
        { status: 409 },
      );
    }

    const now = Date.now();
    const { data: existing, error: existingError } = await supabaseAdmin.from("product_events").select("id,created_at,meta")
      .eq("event_type", "paid_promotion_meta_requested").eq("actor_email", user.email).eq("offer_id", offerId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existingError) throw existingError;
    if (existing && now - Date.parse(existing.created_at) < PAID_DEMAND_WINDOW_MS) return NextResponse.json({ ok: true, requested: true, existing: true, requestId: existing.id });

    const entitlement = await getBusinessEntitlement({
      supabase: supabaseAdmin as any,
      businessEmail: offer.business_email,
    });
    const growthReady = Boolean(entitlement?.canLaunchCampaign);
    const metaReady = Boolean(offer.meta_page_id && offer.meta_ad_account_id);

    let trackingReady = false;
    try {
      const tracking = await assertOfferTrackingReady(supabaseAdmin as any, offerId);
      trackingReady = tracking.ok;
    } catch (trackingError) {
      console.warn("[paid-promotion-request][tracking readiness failed]", trackingError);
    }

    if (growthReady && metaReady && trackingReady) {
      return NextResponse.json({ ok: true, alreadyEnabled: true });
    }

    const nextStep = !growthReady
      ? "growth"
      : !metaReady
        ? "meta"
        : "tracking";

    const eventId = promotionRequestId("paid-demand", offerId, user.email, existing?.id || "initial");
    const { error: eventError } = await (supabaseAdmin as any).from("product_events").insert({
      id: eventId,
      event_type: "paid_promotion_meta_requested",
      actor_email: user.email,
      actor_role: "affiliate",
      offer_id: offerId,
      meta: {
        budget,
        currency: resolveOfferCurrency(null, offer.currency).campaignCurrency || null,
        requestId: requestRow.id,
        source: "affiliate_promote",
        nextStep,
        growthReady,
        metaReady,
        trackingReady,
      },
    });

    if (eventError?.code === "23505") return NextResponse.json({ ok: true, requested: true, existing: true, requestId: eventId });
    if (eventError?.code === "23514") throw new Error("Paid-promotion requests could not be saved because the database event policy does not allow them. Contact support; the business has not been notified.");
    if (eventError) throw eventError;

    after(async () => {
      try {
        const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://www.nettmark.com").replace(/\/$/, "");
        const nextUrl = !growthReady
          ? `${appUrl}/business/choose-plan?source=affiliate-demand&offerId=${encodeURIComponent(offerId)}`
          : !metaReady
            ? `${appUrl}/business/my-business/connect-meta?offerId=${encodeURIComponent(offerId)}&source=affiliate-demand`
            : `${appUrl}/business/setup-tracking?offerId=${encodeURIComponent(offerId)}&source=affiliate-demand`;
        const affiliateName = await getAffiliateUsername(supabaseAdmin as any, { userId: user.id, email: user.email });
        const safeOffer = String(offer.title || "your offer");
        const ctaLabel = !growthReady ? "Start 14-day free trial" : !metaReady ? "Connect Meta" : "Set up tracking";
        const nextStepCopy = !growthReady
          ? "Affiliate-funded paid advertising is a Growth feature. Start the 14-day trial to unlock paid proposals, then complete Meta and tracking before anything can launch."
          : !metaReady
            ? "Your Growth access is ready. Connect your Meta Page and Ad Account next, then verify tracking before the campaign can launch."
            : "Your Growth access and Meta setup are ready. Verify Nettmark tracking so conversions can be attributed correctly before the campaign launches.";
        const html = renderNettmarkEmail({
          previewText: "An affiliate is ready to fund paid advertising for your offer.",
          badge: { text: "Affiliate-funded ads", tone: "info" },
          heading: `An affiliate is ready to advertise ${safeOffer}`,
          body: `${affiliateName} wants to fund paid advertising for your offer.`,
          rows: [
            { label: "Affiliate", value: affiliateName },
            ...(budget > 0 ? [{ label: "Planned daily budget", value: `${budget.toFixed(2)} funded by affiliate` }] : []),
            { label: "Ad spend", value: "Ad spend is funded from the affiliate’s wallet: Meta bills your connected ad account and Nettmark pays that spend back from the affiliate’s funds." },
          ],
          notice: { title: "Next step", body: nextStepCopy, tone: "info" },
          cta: { label: ctaLabel, href: nextUrl },
          footerNote: "Your brand · Your ad account · Your approval · Their ad spend. Communication stays inside Nettmark.",
        });
        await sendEmail({ to: offer.business_email, subject: `An affiliate wants to fund ads for ${offer.title || "your offer"}`, html });
      } catch (error) {
        console.error("[paid-promotion-request][notification failed]", error);
      }
    });

    return NextResponse.json({
      ok: true,
      requested: true,
      nextStep,
      requirements: {
        growthReady,
        metaReady,
        trackingReady,
      },
    });
  } catch (error) {
    console.error("[affiliate/offers/paid-promotion-request]", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

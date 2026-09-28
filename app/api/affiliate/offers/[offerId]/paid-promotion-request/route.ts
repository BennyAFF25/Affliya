import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import supabaseAdmin from "@/../utils/supabase/server-client";
import { sendEmail } from "@/../lib/email/send";
import { getBusinessEntitlement } from "@/../utils/businessEntitlements";
import { assertOfferTrackingReady } from "@/../utils/approvals/enforcement";

function escapeHtml(input: unknown) {
  return String(input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function POST(req: Request, context: { params: Promise<{ offerId: string }> }) {
  try {
    const { offerId } = await context.params;
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const budget = Math.max(0, Number(body?.budget || 0));

    const { data: offer, error: offerError } = await (supabaseAdmin as any)
      .from("offers")
      .select("id,title,business_email,meta_page_id,meta_ad_account_id")
      .eq("id", offerId)
      .maybeSingle();

    if (offerError) throw offerError;
    if (!offer?.id || !offer?.business_email) {
      return NextResponse.json({ ok: false, error: "Offer not found" }, { status: 404 });
    }

    const { data: requestRow } = await (supabaseAdmin as any)
      .from("affiliate_requests")
      .select("id,status")
      .eq("offer_id", offerId)
      .eq("affiliate_email", user.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!requestRow?.id) {
      return NextResponse.json(
        { ok: false, error: "Start promoting this offer before requesting paid promotion." },
        { status: 409 },
      );
    }

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

    await (supabaseAdmin as any).from("product_events").insert({
      event_type: "paid_promotion_meta_requested",
      actor_email: user.email,
      actor_role: "affiliate",
      offer_id: offerId,
      meta: {
        budget,
        currency: "AUD",
        requestId: requestRow.id,
        source: "affiliate_promote",
        nextStep,
        growthReady,
        metaReady,
        trackingReady,
      },
    });

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://www.nettmark.com").replace(/\/$/, "");
    const nextUrl = !growthReady
      ? `${appUrl}/business/choose-plan?source=affiliate-demand&offerId=${encodeURIComponent(offerId)}`
      : !metaReady
        ? `${appUrl}/business/my-business/connect-meta?offerId=${encodeURIComponent(offerId)}&source=affiliate-demand`
        : `${appUrl}/business/setup-tracking?offerId=${encodeURIComponent(offerId)}&source=affiliate-demand`;

    const safeAffiliate = escapeHtml(user.email);
    const safeOffer = escapeHtml(offer.title || "your offer");
    const safeUrl = escapeHtml(nextUrl);
    const budgetLine = budget > 0
      ? `<p style="margin:12px 0 0;"><b>Planned daily budget:</b> $${budget.toFixed(2)} funded by the affiliate.</p>`
      : "";

    const ctaLabel = !growthReady
      ? "Start 14-day free trial"
      : !metaReady
        ? "Connect Meta"
        : "Set up tracking";

    const nextStepCopy = !growthReady
      ? "Paid affiliate advertising is part of Nettmark Growth. Start your 14-day free trial first, then connect Meta and verify tracking before any campaign can launch."
      : !metaReady
        ? "Your Growth access is ready. Connect your Meta Page and Ad Account next, then verify tracking before the campaign can launch."
        : "Your Growth access and Meta setup are ready. Verify Nettmark tracking now so conversions can be attributed correctly before the campaign launches.";

    try {
      await sendEmail({
        to: offer.business_email,
        subject: `An affiliate wants to fund ads for ${offer.title || "your offer"}`,
        html: `
          <div style="font-family:Arial,sans-serif;background:#f4f6f8;padding:28px;">
            <div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:24px;color:#111827;">
              <div style="font-size:12px;letter-spacing:.14em;color:#6b7280;font-weight:700;">NETTMARK · PAID PROMOTION</div>
              <h1 style="font-size:22px;margin:12px 0 8px;">An affiliate is ready to advertise ${safeOffer}</h1>
              <p style="line-height:1.6;color:#4b5563;">${safeAffiliate} wants to fund paid advertising for your offer.</p>
              ${budgetLine}
              <div style="margin:18px 0;padding:14px;border-radius:12px;background:#f9fafb;border:1px solid #e5e7eb;line-height:1.7;">
                <b>Your brand · Your ad account · Your approval · Their ad spend</b><br/>
                <span style="color:#6b7280;">${escapeHtml(nextStepCopy)}</span>
              </div>
              <a href="${safeUrl}" style="display:inline-block;background:#00C2CB;color:#0b0b0b;text-decoration:none;font-weight:700;padding:12px 16px;border-radius:12px;">${ctaLabel}</a>
              <p style="font-size:12px;color:#6b7280;margin-top:14px;">No affiliate ad budget is charged until the campaign is approved and actually ready to launch.</p>
            </div>
          </div>
        `,
      });
    } catch (emailError) {
      console.error("[paid-promotion-request][email failed]", emailError);
    }

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

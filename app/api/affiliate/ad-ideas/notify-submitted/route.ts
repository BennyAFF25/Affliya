import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { Resend } from "resend";
import { createServerSupabaseClient } from "../../../../../utils/businessSubscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function POST(req: Request) {
  try {
    const userSupabase = createRouteHandlerClient({ cookies });
    const { data: authData, error: authError } = await userSupabase.auth.getUser();
    const user = authData?.user || null;

    if (authError || !user?.email) {
      return NextResponse.json(
        { success: false, error: "UNAUTHENTICATED" },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const adIdeaId = String(body?.adIdeaId || "").trim();
    if (!adIdeaId) {
      return NextResponse.json(
        { success: false, error: "INVALID_REQUEST", message: "adIdeaId is required." },
        { status: 400 },
      );
    }

    const affiliateEmail = user.email.trim().toLowerCase();
    const admin = createServerSupabaseClient();
    const { data: idea, error: ideaError } = await admin
      .from("ad_ideas")
      .select("id,offer_id,affiliate_email,business_email,status,campaign_name,budget_amount,budget_type,objective,created_at")
      .eq("id", adIdeaId)
      .maybeSingle();

    if (ideaError) throw new Error(`Failed to load proposal: ${ideaError.message}`);
    if (!idea || String(idea.affiliate_email || "").trim().toLowerCase() !== affiliateEmail) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED" },
        { status: 403 },
      );
    }

    if (String(idea.status || "").toLowerCase() !== "pending") {
      return NextResponse.json({ success: true, skipped: true, reason: "proposal_not_pending" });
    }

    const { data: offer, error: offerError } = await admin
      .from("offers")
      .select("id,title,business_email")
      .eq("id", idea.offer_id)
      .maybeSingle();

    if (offerError) throw new Error(`Failed to load offer: ${offerError.message}`);
    const businessEmail = String(idea.business_email || offer?.business_email || "").trim().toLowerCase();
    if (!businessEmail || businessEmail !== String(offer?.business_email || "").trim().toLowerCase()) {
      return NextResponse.json(
        { success: false, error: "BUSINESS_EMAIL_MISMATCH" },
        { status: 409 },
      );
    }

    if (!process.env.RESEND_API_KEY) {
      console.warn("[proposal-submitted] RESEND_API_KEY missing; proposal remains valid");
      return NextResponse.json({ success: true, skipped: true, reason: "email_not_configured" });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    const fromName = process.env.RESEND_FROM_NAME || "Nettmark";
    const offerTitle = escapeHtml(offer?.title || "your offer");
    const affiliate = escapeHtml(affiliateEmail);
    const campaignName = escapeHtml(idea.campaign_name || "Paid campaign proposal");
    const reviewUrl = `https://www.nettmark.com/business/my-business/ad-ideas?proposal=${encodeURIComponent(adIdeaId)}`;
    const budget = Number(idea.budget_amount || 0) > 0
      ? (Number(idea.budget_amount) / 100).toFixed(2)
      : null;
    const budgetType = String(idea.budget_type || "DAILY").toUpperCase() === "LIFETIME"
      ? "lifetime"
      : "daily";

    await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [businessEmail],
      subject: `An affiliate wants to fund ads for ${offer?.title || "your offer"}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.55;color:#111827;max-width:620px;margin:0 auto">
          <h2 style="margin:0 0 12px">A real paid campaign is ready for your review</h2>
          <p><strong>${affiliate}</strong> submitted an actual campaign proposal for <strong>${offerTitle}</strong>.</p>
          <div style="margin:18px 0;padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb">
            <div><strong>Campaign:</strong> ${campaignName}</div>
            ${budget ? `<div style="margin-top:6px"><strong>Affiliate budget:</strong> $${budget} ${budgetType}</div>` : ""}
            <div style="margin-top:6px"><strong>Your ad spend:</strong> $0</div>
          </div>
          <p>You can review or reject the proposal before completing any paid-promotion setup. Nothing launches until all Nettmark launch requirements are satisfied and you approve it.</p>
          <p style="margin-top:22px">
            <a href="${reviewUrl}" style="display:inline-block;background:#00C2CB;color:#001015;text-decoration:none;font-weight:700;padding:12px 16px;border-radius:10px">Review campaign</a>
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[affiliate/ad-ideas/notify-submitted]", error);
    return NextResponse.json(
      {
        success: false,
        error: "PROPOSAL_NOTIFICATION_FAILED",
        message: error instanceof Error ? error.message : "Could not send proposal notification.",
      },
      { status: 500 },
    );
  }
}

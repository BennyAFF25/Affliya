import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { Resend } from "resend";
import { createServerSupabaseClient } from "../../../../../utils/businessSubscriptions";
import { getAffiliateUsername } from "../../../../../utils/profileIdentity";
import { renderNettmarkEmail } from "../../../../../utils/email/renderNettmarkEmail";

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
    const affiliateName = await getAffiliateUsername(admin as any, {
      userId: user.id,
      email: affiliateEmail,
    });
    const offerTitle = String(offer?.title || "your offer");
    const campaignName = String(idea.campaign_name || "Paid campaign proposal");
    const reviewUrl = `https://www.nettmark.com/business/my-business/ad-ideas?proposal=${encodeURIComponent(adIdeaId)}`;
    const budget = Number(idea.budget_amount || 0) > 0
      ? (Number(idea.budget_amount) / 100).toFixed(2)
      : null;
    const budgetType = String(idea.budget_type || "DAILY").toUpperCase() === "LIFETIME"
      ? "lifetime"
      : "daily";

    const html = renderNettmarkEmail({
      previewText: "A funded campaign proposal is ready for your review.",
      badge: { text: "Paid proposal", tone: "info" },
      heading: "A funded campaign is ready for review",
      body: `${affiliateName} submitted a paid campaign proposal for ${offerTitle}. Nothing launches until you review it and all launch requirements are complete.`,
      rows: [
        { label: "Affiliate", value: affiliateName },
        { label: "Campaign", value: campaignName },
        ...(budget ? [{ label: "Affiliate budget", value: `${budget} ${budgetType}` }] : []),
        { label: "Your ad spend", value: "$0" },
      ],
      cta: { label: "Review campaign", href: reviewUrl },
      footerNote: "Communication stays inside Nettmark. Affiliate contact details are not shared.",
    });

    await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [businessEmail],
      subject: `An affiliate wants to fund ads for ${offer?.title || "your offer"}`,
      html,
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

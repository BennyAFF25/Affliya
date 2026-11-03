import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { sendProposalEmail } from "../../../../../utils/email/sendProposalEmail";
import { createServerSupabaseClient } from "../../../../../utils/businessSubscriptions";
import { getAffiliateUsername } from "../../../../../utils/profileIdentity";
import { renderNettmarkEmail } from "../../../../../utils/email/renderNettmarkEmail";
import { notifyProposal } from "../../../../../utils/affiliate/paidProposalNotification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const organicPostId = String(body?.organicPostId || "").trim();
    if (!organicPostId) {
      return NextResponse.json(
        { success: false, error: "INVALID_REQUEST", message: "organicPostId is required." },
        { status: 400 },
      );
    }

    const affiliateEmail = user.email.trim().toLowerCase();
    const admin = createServerSupabaseClient();
    const { data: idea, error: ideaError } = await admin
      .from("organic_posts")
      .select("id,offer_id,affiliate_email,business_email,status,caption,platform,image_url,created_at")
      .eq("id", organicPostId)
      .maybeSingle();

    if (ideaError) throw new Error(`Failed to load proposal: ${ideaError.message}`);
    if (!idea || String(idea.affiliate_email || "").trim().toLowerCase() !== affiliateEmail) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED" },
        { status: 403 },
      );
    }

    if (String(idea.status || "").toLowerCase() !== "pending") {
      return NextResponse.json({ success: true, emailSent: false, skipped: true, reason: "proposal_not_pending" });
    }

    const { data: offer, error: offerError } = await admin
      .from("offers")
      .select("id,title,business_email")
      .eq("id", idea.offer_id)
      .maybeSingle();

    if (offerError) throw new Error(`Failed to load offer: ${offerError.message}`);
    const businessEmail = String(idea.business_email || "").trim().toLowerCase();
    if (!businessEmail || businessEmail !== String(offer?.business_email || "").trim().toLowerCase()) {
      return NextResponse.json(
        { success: false, error: "BUSINESS_EMAIL_MISMATCH" },
        { status: 409 },
      );
    }

    const reviewPath = `/business/my-business/post-ideas?proposal=${encodeURIComponent(organicPostId)}`;
    await notifyProposal(admin, {
      user_email: businessEmail,
      title: "New organic post proposal",
      body: "An affiliate submitted an organic post for your review.",
      link_url: reviewPath,
    });

    const affiliateName = await getAffiliateUsername(admin, {
      userId: user.id,
      email: affiliateEmail,
    });
    const offerTitle = String(offer?.title || "your offer");
    const platform = String(idea.platform || "social media");
    const html = renderNettmarkEmail({
      badge: { text: "Organic proposal", tone: "info" },
      heading: `An affiliate wants to promote ${offerTitle}`,
      body: `${affiliateName} wants to post about ${offerTitle} on ${platform}. Nothing is posted until you approve it.`,
      image: idea.image_url ? { src: idea.image_url, alt: `Post for ${offerTitle}` } : undefined,
      rows: [
        { label: "Affiliate", value: affiliateName },
        { label: "Platform", value: platform },
        { label: "Caption", value: String(idea.caption || "").slice(0, 400) },
      ],
      cta: { label: "Review post", href: `https://www.nettmark.com${reviewPath}` },
    });

    const result = await sendProposalEmail(admin, {
      to: businessEmail,
      subject: `An affiliate wants to promote ${offer?.title || "your offer"}`,
      html, idempotencyKey: `organic-proposal-submitted/${organicPostId}`,
      proposalId: organicPostId, kind: "organic", stage: "submitted",
    });

    return NextResponse.json({ success: true, emailSent: result.ok });
  } catch (error) {
    console.error("[affiliate/organic-posts/notify-submitted]", error);
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

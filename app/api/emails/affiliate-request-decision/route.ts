import { NextResponse } from "next/server";
import { Resend } from "resend";
import { renderNettmarkEmail } from "../../../../utils/email/renderNettmarkEmail";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { to, affiliateEmail, businessEmail, offerTitle, decision } = body || {};

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ ok: false, error: "Missing RESEND_API_KEY" }, { status: 500 });
    }

    if (!to || !affiliateEmail || !businessEmail || !offerTitle || !decision) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "no-reply@nettmark.com";
    const fromName = process.env.RESEND_FROM_NAME || "Nettmark";
    const approved = String(decision).toLowerCase() === "approved";
    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      "https://www.nettmark.com"
    ).trim().replace(/\/$/, "");
    const ctaPath =
      approved && body?.offerId
        ? `/affiliate/dashboard/promote/${encodeURIComponent(String(body.offerId))}`
        : "/affiliate/dashboard";
    const ctaUrl = `${appUrl}${ctaPath}`;
    const subject = approved ? "Affiliate request approved" : "Affiliate request rejected";

    const html = renderNettmarkEmail({
      previewText: approved
        ? "Your request was approved. You can continue into the promotion flow."
        : "The business has reviewed your affiliate request.",
      badge: {
        text: approved ? "Request approved" : "Request declined",
        tone: approved ? "success" : "neutral",
      },
      heading: approved ? "You're approved to promote" : "Your request wasn't approved",
      body: approved
        ? "The business approved your request. Open the offer to continue into the promotion flow."
        : "The business has decided not to approve this promotion request right now.",
      rows: [
        { label: "Offer", value: String(offerTitle) },
        { label: "Business", value: String(businessEmail) },
      ],
      cta: {
        label: approved ? "Continue to promotion" : "Open dashboard",
        href: ctaUrl,
      },
      secondaryCta: approved
        ? undefined
        : { label: "Browse marketplace", href: `${appUrl}/affiliate/marketplace` },
    });

    const result = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      html,
    });

    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    console.error("[emails/affiliate-request-decision] error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 },
    );
  }
}

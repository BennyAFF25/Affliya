import { NextResponse } from "next/server";
import { Resend } from "resend";
import { renderNettmarkEmail } from "../../../../utils/email/renderNettmarkEmail";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { to, businessEmail, offerTitle, offerId } = body || {};

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ ok: false, error: "Missing RESEND_API_KEY" }, { status: 500 });
    }
    if (!to || !businessEmail || !offerTitle) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: to, businessEmail, offerTitle" },
        { status: 400 },
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    const fromName = process.env.RESEND_FROM_NAME || "Nettmark";
    const siteUrl = (
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://www.nettmark.com"
    ).trim().replace(/\/$/, "");
    const offerUrl = offerId
      ? `${siteUrl}/affiliate/marketplace/${encodeURIComponent(String(offerId))}`
      : `${siteUrl}/affiliate/marketplace`;
    const subject = "New offer is live on Nettmark";

    const html = renderNettmarkEmail({
      previewText: "A new offer has been published to the Nettmark marketplace.",
      badge: { text: "New offer", tone: "info" },
      heading: "A new offer just hit the marketplace",
      body:
        "Take a look at the offer and decide whether it fits the kind of distribution you want to run.",
      rows: [
        { label: "Offer", value: String(offerTitle) },
        { label: "Business", value: String(businessEmail) },
      ],
      cta: { label: "View offer", href: offerUrl },
      secondaryCta: {
        label: "Open marketplace",
        href: `${siteUrl}/affiliate/marketplace`,
      },
    });

    const result = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      html,
    });

    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    console.error("[emails/new-offer] error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}

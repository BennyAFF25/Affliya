import { NextResponse } from "next/server";
import { Resend } from "resend";
import { renderNettmarkEmail } from "../../../../utils/email/renderNettmarkEmail";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { to, businessEmail, businessName } = body || {};

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "Missing RESEND_API_KEY" },
        { status: 500 },
      );
    }

    if (!to || !businessEmail) {
      console.error("[emails/business-signup] Missing fields:", {
        toPresent: !!to,
        businessEmailPresent: !!businessEmail,
        body,
      });

      return NextResponse.json(
        { ok: false, error: "Missing required fields: to, businessEmail" },
        { status: 400 },
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    const fromName = process.env.RESEND_FROM_NAME || "Nettmark";
    const appUrl = "https://www.nettmark.com";
    const subject = "Welcome to Nettmark — publish your first offer";

    const html = renderNettmarkEmail({
      previewText: "Your business account is ready. Publish your first offer to become discoverable.",
      badge: { text: "Business account", tone: "success" },
      heading: businessName
        ? `Welcome, ${String(businessName)}`
        : "Your Nettmark account is ready",
      body:
        "Start by publishing the offer affiliates will promote. Choose what you are offering, what affiliates earn, and who can access it. Meta and tracking can wait until the next action actually needs them.",
      rows: [{ label: "Login email", value: String(businessEmail) }],
      notice: {
        title: "First milestone",
        body:
          "Publish your first offer so affiliates can discover your business and decide whether they want to promote it.",
        tone: "info",
      },
      cta: { label: "Create your first offer", href: `${appUrl}/onboarding/for-business` },
      secondaryCta: { label: "Open Nettmark", href: `${appUrl}/login/business` },
      footerNote:
        "Free remains available. Growth can be activated later when you want access to affiliate-funded paid advertising.",
    });

    const result = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [String(to)],
      subject,
      html,
    });

    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    console.error("[emails/business-signup] error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 },
    );
  }
}

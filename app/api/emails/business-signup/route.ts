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
    const subject = "Welcome to Nettmark — start your Growth trial";

    const html = renderNettmarkEmail({
      previewText: "Your account is ready. Start the 14-day Growth trial, then publish your offer.",
      badge: { text: "Business account", tone: "success" },
      heading: businessName
        ? `Welcome, ${String(businessName)}`
        : "Your Nettmark account is ready",
      body:
        "Next, choose your plan. Growth starts with a 14-day free trial and requires a card; it is A$49/month afterward unless cancelled. Once you choose Growth or Free, publish the offer affiliates will promote. Free supports organic promotion only.",
      notice: {
        title: "Your next step",
        body:
          "Start your Growth trial or choose Free, then create your first offer.",
        tone: "info",
      },
      cta: { label: "Start 14-day Growth trial", href: `${appUrl}/business/choose-plan` },
      secondaryCta: { label: "Open Nettmark", href: `${appUrl}/login/business` },
      footerNote:
        "Card required for Growth. Cancel anytime. Free remains available for organic affiliate promotion, without paid affiliate ads.",
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

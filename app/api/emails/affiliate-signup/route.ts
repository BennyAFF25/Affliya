import { NextResponse } from "next/server";
import { Resend } from "resend";
import { renderNettmarkEmail } from "../../../../utils/email/renderNettmarkEmail";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { to, affiliateEmail, username } = body || {};

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ ok: false, error: "Missing RESEND_API_KEY" }, { status: 500 });
    }

    if (!to || !affiliateEmail) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: to, affiliateEmail" },
        { status: 400 },
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    const fromName = process.env.RESEND_FROM_NAME || "Nettmark";
    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://www.nettmark.com"
    ).trim().replace(/\/$/, "");

    const subject = "Welcome to Nettmark — your affiliate account is live";
    const html = renderNettmarkEmail({
      previewText: "Your affiliate account is ready. Browse offers and start promoting.",
      badge: { text: "Affiliate account", tone: "success" },
      heading: username ? `Welcome, ${String(username)}` : "Welcome to Nettmark",
      body:
        "Your affiliate account is ready. Browse the marketplace, choose an offer that makes sense for you, and follow the promotion flow from there.",
      rows: [{ label: "Login email", value: String(affiliateEmail) }],
      notice: {
        title: "What happens next",
        body:
          "You can promote organically or use paid distribution where the business allows it. Nettmark will surface the setup you need only when it becomes relevant.",
        tone: "info",
      },
      cta: { label: "Open affiliate dashboard", href: `${appUrl}/affiliate/dashboard` },
      secondaryCta: { label: "Browse marketplace", href: `${appUrl}/affiliate/marketplace` },
      footerNote: "If you did not create a Nettmark account, you can ignore this email.",
    });

    const result = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      replyTo: "support@nettmark.com",
      to: [to],
      subject,
      html,
    });

    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    console.error("[emails/affiliate-signup] error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}

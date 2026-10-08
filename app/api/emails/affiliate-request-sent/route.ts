import { NextResponse } from "next/server";
import { Resend } from "resend";
import { renderNettmarkEmail } from "../../../../utils/email/renderNettmarkEmail";

export const runtime = "nodejs";

function getBaseUrl(req: Request) {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL;

  if (envUrl) return envUrl.trim().replace(/\/$/, "");

  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "www.nettmark.com";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`.replace(/\/$/, "");
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      to,
      businessEmail,
      affiliateEmail,
      offerTitle,
      notes,
      offerId,
      requestId,
    } = body || {};

    console.log("[affiliate-request-sent] body:", body);

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "Missing RESEND_API_KEY" },
        { status: 500 },
      );
    }

    const resolvedTo = String(to || businessEmail || "").trim();

    if (!resolvedTo || !businessEmail || !affiliateEmail) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Missing required fields: businessEmail, affiliateEmail (and recipient via to or businessEmail)",
          received: {
            to,
            businessEmail,
            affiliateEmail,
            offerTitle,
            offerId,
            requestId,
          },
        },
        { status: 400 },
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "no-reply@nettmark.com";
    const fromName = process.env.RESEND_FROM_NAME || "Nettmark";
    const baseUrl = getBaseUrl(req);

    const ctaUrl =
      `${baseUrl}/business/my-business/affiliate-requests` +
      (offerId ? `?offerId=${encodeURIComponent(String(offerId))}` : "") +
      (offerId && requestId
        ? `&requestId=${encodeURIComponent(String(requestId))}`
        : requestId && !offerId
          ? `?requestId=${encodeURIComponent(String(requestId))}`
          : "");

    const subject = "New affiliate request";
    const html = renderNettmarkEmail({
      previewText: "An affiliate wants to promote one of your offers.",
      badge: { text: "Affiliate request", tone: "info" },
      heading: "An affiliate wants to promote your offer",
      body:
        "Review the request and decide whether this affiliate should be able to promote your business.",
      rows: [
        { label: "Offer", value: String(offerTitle || "Your offer") },
        { label: "Affiliate", value: String(affiliateEmail) },
        ...(notes ? [{ label: "Notes", value: String(notes) }] : []),
      ],
      cta: { label: "Review request", href: ctaUrl },
      footerNote: "Approve or reject the request from your Nettmark dashboard.",
    });

    const result = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [resolvedTo],
      subject,
      html,
    });

    console.log("[affiliate-request-sent] resend result:", result);
    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    console.error("[emails/affiliate-request-sent] error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 },
    );
  }
}

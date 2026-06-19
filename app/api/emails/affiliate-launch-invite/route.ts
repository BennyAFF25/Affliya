import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { Resend } from "resend";
import { renderNettmarkEmail } from "../../../../utils/email/renderNettmarkEmail";

export const runtime = "nodejs";

function normalizeEmail(value: unknown) {
  const email = String(value ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.APP_URL ||
    "https://www.nettmark.com"
  ).replace(/\/$/, "");
}

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const affiliateEmail = normalizeEmail(body?.affiliateEmail || body?.to);
  const businessEmail = normalizeEmail(body?.businessEmail);
  const offerId = String(body?.offerId || "").trim();
  const offerTitle = String(body?.offerTitle || "this offer").trim();
  const requestId = body?.requestId ? String(body.requestId) : null;

  if (!affiliateEmail || !businessEmail || !offerId) {
    return NextResponse.json(
      { error: "missing_required_fields" },
      { status: 400 },
    );
  }

  if (businessEmail !== user.email) {
    return NextResponse.json({ error: "sender_mismatch" }, { status: 403 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "missing_resend_api_key" },
      { status: 500 },
    );
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!fromEmail) {
    return NextResponse.json(
      { error: "missing_resend_from_email" },
      { status: 500 },
    );
  }

  const appUrl = getAppUrl();
  const launchUrl = `${appUrl}/affiliate/dashboard/promote/${encodeURIComponent(
    offerId,
  )}`;
  const fromName = process.env.RESEND_FROM_NAME || "Nettmark";
  const subject = `You're invited to promote ${offerTitle}`;

  const html = renderNettmarkEmail({
    previewText: `Your request was approved. Launch a campaign for ${offerTitle} in Nettmark.`,
    badge: { text: "Launch invite", tone: "success" },
    heading: `You're invited to promote ${offerTitle}`,
    body:
      "Good news — the business has approved your promotion request and invited you to launch. Open the offer in Nettmark to create a paid ad or organic campaign and start promoting.",
    rows: [
      { label: "Offer", value: offerTitle },
      { label: "Business", value: businessEmail },
      { label: "Affiliate", value: affiliateEmail },
      ...(requestId ? [{ label: "Request ID", value: requestId }] : []),
    ],
    cta: { label: "Launch campaign", href: launchUrl },
    footerNote:
      "If you are not logged in, Nettmark will take you to the affiliate login page first and then return you to this launch page.",
  });

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to: [affiliateEmail],
    subject,
    html,
  });

  if (error) {
    console.error("[affiliate-launch-invite] send failed", error);
    return NextResponse.json({ error: "send_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, id: (data as { id?: string } | null)?.id || null });
}

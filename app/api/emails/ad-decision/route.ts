import { NextResponse } from "next/server";
import { Resend } from "resend";
import { renderNettmarkEmail } from "../../../../utils/email/renderNettmarkEmail";
import { createServerSupabaseClient } from "../../../../utils/businessSubscriptions";
import { getBusinessDisplayName } from "../../../../utils/profileIdentity";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { to, affiliateEmail, businessEmail, offerTitle, decision, adTitle, note } = body || {};

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
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    const fromName = process.env.RESEND_FROM_NAME || "Nettmark";
    const normalizedDecision = String(decision).toLowerCase();
    const approved = normalizedDecision === "approved";
    const paused = normalizedDecision === "paused";

    const businessName = await getBusinessDisplayName(
      createServerSupabaseClient() as any,
      String(businessEmail),
    );

    const subject = approved
      ? "Ad approved"
      : paused
        ? "Ad paused by business"
        : "Ad rejected";

    const html = renderNettmarkEmail({
      previewText: approved
        ? "Your ad was approved by the business."
        : paused
          ? "The business paused this ad."
          : "The business reviewed and rejected this ad.",
      badge: {
        text: approved ? "Ad approved" : paused ? "Ad paused" : "Ad rejected",
        tone: approved ? "success" : paused ? "warning" : "danger",
      },
      heading: approved
        ? "Your ad is approved"
        : paused
          ? "Your ad has been paused"
          : "Your ad wasn't approved",
      body: approved
        ? "The business approved your creative. Open Nettmark to continue with the campaign."
        : paused
          ? "The business has paused this campaign. Open Nettmark to review the current status."
          : "The business has rejected this creative. Review any feedback before creating the next version.",
      rows: [
        { label: "Offer", value: String(offerTitle) },
        ...(adTitle ? [{ label: "Ad", value: String(adTitle) }] : []),
        { label: "Business", value: businessName },
        ...(note ? [{ label: "Business note", value: String(note) }] : []),
      ],
      cta: {
        label: "Open Nettmark",
        href: "https://www.nettmark.com/affiliate/dashboard",
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
    console.error("[emails/ad-decision] error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}

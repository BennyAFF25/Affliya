import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

function escapeHtml(input: any) {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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
        { status: 400 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    const fromName = process.env.RESEND_FROM_NAME || "Nettmark";

    const safeAffiliate = escapeHtml(affiliateEmail);
    const safeBusiness = escapeHtml(businessEmail);
    const safeOffer = escapeHtml(offerTitle);
    const safeAd = escapeHtml(adTitle);
    const safeNote = escapeHtml(note);
    const safeDecision = String(decision).toLowerCase();

    const LOGO_URL = "https://www.nettmark.com/icon.png";

    const subjectMap: Record<string, string> = {
      approved: "Ad approved",
      rejected: "Ad rejected",
      paused: "Ad paused by business",
    };

    const subject = subjectMap[safeDecision] || "Ad update";

    const statusColor =
      safeDecision === "approved"
        ? "#16a34a"
        : safeDecision === "rejected"
        ? "#dc2626"
        : "#f59e0b";

    const html = `
<!doctype html>
<html>
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f7;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px;background:#f4f4f7;">
<tr>
<td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;">

<!-- Header -->
<tr>
<td style="padding:6px 6px 14px 6px;">
<table cellpadding="0" cellspacing="0">
<tr>
<td width="38" style="padding-right:12px;">
<img src="${LOGO_URL}" width="38" height="38" style="display:block;border-radius:10px;" />
</td>
<td style="font-family:Arial,Helvetica,sans-serif;">
<div style="font-size:18px;font-weight:700;color:#0b0b0b;">Nettmark</div>
<div style="font-size:12px;color:#6b7280;margin-top:3px;">Ad status update</div>
</td>
</tr>
</table>
</td>
</tr>

<!-- Card -->
<tr>
<td style="padding:0 6px;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e7e7ee;">
<tr>
<td style="padding:22px;font-family:Arial,Helvetica,sans-serif;color:#0b0b0b;">
<div style="font-size:22px;font-weight:800;">${subject}</div>

<div style="margin-top:10px;font-size:14px;line-height:1.6;">
Your ad has been <b style="color:${statusColor};">${safeDecision}</b> by the business.
</div>

<div style="margin-top:16px;background:#f8fafc;border:1px solid #eef2f7;border-radius:12px;padding:14px;">
<div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;font-weight:700;">
Ad details
</div>
<ul style="margin:10px 0 0 18px;font-size:14px;line-height:1.7;">
<li><b>Offer:</b> ${safeOffer}</li>
${safeAd ? `<li><b>Ad:</b> ${safeAd}</li>` : ""}
<li><b>Affiliate:</b> ${safeAffiliate}</li>
<li><b>Business:</b> ${safeBusiness}</li>
</ul>
</div>

${safeNote ? `
<div style="margin-top:14px;font-size:14px;line-height:1.6;color:#374151;">
<b>Business note:</b><br/>${safeNote}
</div>
` : ""}

<table cellpadding="0" cellspacing="0" style="margin-top:18px;">
<tr>
<td>
<a href="https://www.nettmark.com/login/affiliate"
style="display:inline-block;background:#00C2CB;color:#001015;text-decoration:none;font-weight:700;
font-size:14px;padding:12px 16px;border-radius:12px;border:1px solid rgba(0,0,0,0.08);">
Open Nettmark
</a>
</td>
</tr>
</table>

</td>
</tr>
</table>
</td>
</tr>

<!-- Footer -->
<tr>
<td style="padding:16px 8px 0 8px;font-family:Arial,Helvetica,sans-serif;color:#6b7280;">
<div style="font-size:12px;">
Need help? Use the Nettmark chatbot inside the app or contact
<a href="mailto:support@nettmark.com" style="color:#0ea5a4;text-decoration:none;font-weight:700;">
support@nettmark.com
</a>.
</div>
<div style="margin-top:6px;font-size:12px;">
© 2026 Nettmark. All rights reserved.
</div>
</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>
    `.trim();

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

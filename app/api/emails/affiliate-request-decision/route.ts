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
    const { to, affiliateEmail, businessEmail, offerTitle, decision, note } = body || {};

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
    const fromEmail = process.env.RESEND_FROM_EMAIL || "no-reply@nettmark.com";
    const fromName = process.env.RESEND_FROM_NAME || "Nettmark";

    const safeAffiliate = escapeHtml(affiliateEmail);
    const safeBusiness = escapeHtml(businessEmail);
    const safeOffer = escapeHtml(offerTitle);
    const safeDecision = String(decision).toLowerCase() === "approved" ? "APPROVED" : "REJECTED";
    const safeNote = escapeHtml(note);

    const LOGO_URL = "https://www.nettmark.com/icon.png";
    const subject = `Affiliate request ${safeDecision}`;
    const ctaUrl = "https://www.nettmark.com/business/affiliate-requests";
    const helpEmail = "support@nettmark.com";

    const html = `
<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:28px 12px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="padding:6px 6px 14px 6px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:10px;">
                    <img src="${LOGO_URL}" width="38" height="38" style="border-radius:10px;display:block;" alt="Nettmark" />
                  </td>
                  <td style="font-family:Arial,Helvetica,sans-serif;">
                    <div style="font-size:18px;font-weight:700;color:#0b0b0b;line-height:1;">Nettmark</div>
                    <div style="font-size:12px;color:#6b7280;margin-top:3px;">Business notifications</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="padding:0 6px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e7e7ee;border-radius:16px;">
                <tr>
                  <td style="padding:22px;font-family:Arial,Helvetica,sans-serif;color:#0b0b0b;">
                    <div style="font-size:22px;font-weight:800;">Affiliate request ${safeDecision}</div>

                    <div style="margin-top:12px;font-size:14px;line-height:1.6;color:#111827;">
                      The affiliate request for <b>${safeOffer}</b> has been <b>${safeDecision.toLowerCase()}</b>.
                    </div>

                    <div style="margin-top:16px;background:#f8fafc;border:1px solid #eef2f7;border-radius:12px;padding:14px;">
                      <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;font-weight:700;">
                        Request details
                      </div>
                      <div style="margin-top:8px;font-size:14px;line-height:1.6;color:#111827;">
                        <div><b>Affiliate:</b> ${safeAffiliate}</div>
                        <div><b>Business:</b> ${safeBusiness}</div>
                        <div><b>Offer:</b> ${safeOffer}</div>
                        ${safeNote ? `<div><b>Note:</b> ${safeNote}</div>` : ""}
                      </div>
                    </div>

                    <table cellpadding="0" cellspacing="0" style="margin-top:18px;">
                      <tr>
                        <td>
                          <a href="${ctaUrl}" style="display:inline-block;background:#00C2CB;color:#001015;text-decoration:none;font-weight:700;font-size:14px;padding:12px 16px;border-radius:12px;">
                            View in dashboard
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
                Need help? Use the Nettmark chatbot inside the app or email
                <a href="mailto:${helpEmail}" style="color:#0ea5a4;font-weight:700;text-decoration:none;">
                  ${helpEmail}
                </a>.
              </div>
              <div style="margin-top:6px;font-size:12px;">© 2026 Nettmark. All rights reserved.</div>
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
    console.error("[emails/affiliate-request-decision] error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}

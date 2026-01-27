import { NextResponse } from "next/server";
import { Resend } from "resend";

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
        { status: 400 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    const fromName = process.env.RESEND_FROM_NAME || "Nettmark";

    const escapeHtml = (input: any) => {
      const str = String(input ?? "");
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
    };

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.nettmark.com").replace(/\/$/, "");
    const safeOfferId = offerId ? escapeHtml(offerId) : "";
    const offerUrl = offerId ? `${siteUrl}/affiliate/marketplace/${encodeURIComponent(String(offerId))}` : `${siteUrl}/affiliate/marketplace`;

    const subject = "New offer is live on Nettmark";

    const safeBusinessEmail = escapeHtml(businessEmail);
    const safeOfferTitle = escapeHtml(offerTitle);

    const html = `
<!doctype html>
<html>
  <head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;background:#F6F8FB;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0B0B0B;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F6F8FB;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;">
            <tr>
              <td style="padding:0 6px 12px 6px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="vertical-align:middle;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="vertical-align:middle;padding-right:10px;">
                            <img src="${siteUrl}/icon.png" width="34" height="34" alt="Nettmark" style="display:block;border-radius:10px;" />
                          </td>
                          <td style="vertical-align:middle;">
                            <div style="font-weight:800;font-size:16px;line-height:18px;color:#0B0B0B;">Nettmark</div>
                            <div style="font-size:12px;line-height:14px;color:#6B7280;">Marketplace update</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <span style="display:inline-block;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#6B7280;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:999px;padding:8px 10px;">NEW OFFER</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:0 6px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:16px;box-shadow:0 8px 24px rgba(0,0,0,0.06);">
                  <tr>
                    <td style="padding:22px 22px 18px 22px;">
                      <h1 style="margin:0 0 10px 0;font-size:22px;line-height:28px;color:#0B0B0B;">A new offer just hit the Nettmark marketplace</h1>
                      <p style="margin:0 0 14px 0;font-size:14px;line-height:20px;color:#374151;">
                        Be one of the first affiliates to request access and start promoting. If approved, you’ll be able to run Facebook ads on the brand’s ad account — with tracking + payouts handled inside Nettmark.
                      </p>

                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ECFEFF;border-left:4px solid #00C2CB;border-radius:12px;">
                        <tr>
                          <td style="padding:14px 14px;">
                            <div style="font-size:13px;line-height:18px;color:#0B0B0B;font-weight:700;margin-bottom:6px;">Offer details</div>
                            <div style="font-size:13px;line-height:18px;color:#111827;"><b>Offer:</b> ${safeOfferTitle}</div>
                            <div style="font-size:13px;line-height:18px;color:#111827;"><b>Business:</b> ${safeBusinessEmail}</div>
                            ${offerId ? `<div style="font-size:13px;line-height:18px;color:#111827;"><b>Offer ID:</b> ${safeOfferId}</div>` : ""}
                          </td>
                        </tr>
                      </table>

                      <div style="height:16px;"></div>

                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="padding-right:10px;">
                            <a href="${offerUrl}" style="display:inline-block;background:#00C2CB;color:#0B0B0B;text-decoration:none;font-weight:800;font-size:14px;line-height:16px;padding:12px 16px;border-radius:12px;border:1px solid rgba(0,0,0,0.08);">View offer</a>
                          </td>
                          <td>
                            <a href="${siteUrl}/affiliate/marketplace" style="display:inline-block;background:#FFFFFF;color:#0B0B0B;text-decoration:none;font-weight:700;font-size:14px;line-height:16px;padding:12px 16px;border-radius:12px;border:1px solid #E5E7EB;">Open marketplace</a>
                          </td>
                        </tr>
                      </table>

                      <div style="height:14px;"></div>
                      <p style="margin:0;font-size:12px;line-height:18px;color:#6B7280;">
                        If you didn’t request this update, you can ignore this email.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:14px 6px 0 6px;text-align:center;">
                <p style="margin:0;font-size:12px;line-height:18px;color:#6B7280;">Need help? Contact <a href="mailto:support@nettmark.com" style="color:#00A8B0;text-decoration:none;font-weight:700;">support@nettmark.com</a>.</p>
                <p style="margin:6px 0 0 0;font-size:12px;line-height:18px;color:#9CA3AF;">© 2026 Nettmark. All rights reserved.</p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
    `;

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

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
    const { to, businessEmail, affiliateEmail, offerTitle, notes, requestId } = body || {};

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "Missing RESEND_API_KEY" },
        { status: 500 }
      );
    }

    if (!to || !businessEmail || !affiliateEmail) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Missing required fields: to, businessEmail, affiliateEmail",
        },
        { status: 400 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    const fromName = process.env.RESEND_FROM_NAME || "Nettmark";

    const safeTo = escapeHtml(to);
    const safeBusinessEmail = escapeHtml(businessEmail);
    const safeAffiliateEmail = escapeHtml(affiliateEmail);
    const safeOfferTitle = escapeHtml(offerTitle || "Your offer");
    const safeNotes = notes ? escapeHtml(notes) : "";

    // Use a public, absolute URL so email clients can load it.
    const LOGO_URL = "https://www.nettmark.com/icon.png";

    const subject = `New affiliate request — ${safeOfferTitle}`;

    // Deep link into your dashboard affiliate-requests page.
    // If you pass a requestId, we’ll include it as a query param for future UX.
    const baseCtaUrl = "https://www.nettmark.com/business/my-business/affiliate-requests";
    const ctaUrl = requestId
      ? `${baseCtaUrl}?request=${encodeURIComponent(String(requestId))}`
      : baseCtaUrl;

    const helpEmail = "support@nettmark.com";

    const html = `
<!doctype html>
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f7;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      A new affiliate wants to promote one of your offers.
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f4f7;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;">

            <!-- Header (matches business-signup) -->
            <tr>
              <td style="padding:6px 6px 14px 6px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td>
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td style="padding-right:12px;">
                            <img src="${LOGO_URL}" width="38" height="38" alt="Nettmark" style="display:block;border-radius:10px;" />
                          </td>
                          <td style="font-family:Arial,Helvetica,sans-serif;">
                            <div style="font-size:18px;font-weight:700;line-height:1;color:#0b0b0b;">Nettmark</div>
                            <div style="font-size:12px;color:#6b7280;margin-top:3px;">Business notifications</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td align="right" style="font-family:Arial,Helvetica,sans-serif;">
                      <span style="display:inline-block;padding:6px 10px;border-radius:999px;border:1px solid #e5e7eb;background:#ffffff;color:#6b7280;font-size:11px;font-weight:700;letter-spacing:0.12em;">
                        REQUEST
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Card -->
            <tr>
              <td style="padding:0 6px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border:1px solid #e7e7ee;border-radius:16px;overflow:hidden;">
                  <tr>
                    <td style="padding:22px 22px 18px 22px;font-family:Arial,Helvetica,sans-serif;color:#0b0b0b;">
                      <div style="font-size:22px;font-weight:800;">New affiliate request</div>
                      <div style="margin-top:10px;font-size:14px;line-height:1.6;color:#111827;">
                        A new affiliate wants to promote one of your offers. Review it inside your dashboard.
                      </div>

                      <!-- Details -->
                      <div style="margin-top:16px;background:#f8fafc;border:1px solid #eef2f7;border-radius:12px;padding:14px 14px;">
                        <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;font-weight:700;">Request details</div>

                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:10px;font-size:14px;line-height:1.7;color:#111827;">
                          <tr>
                            <td style="color:#6b7280;width:120px;padding:2px 0;">Business:</td>
                            <td style="padding:2px 0;"><a href="mailto:${safeBusinessEmail}" style="color:#0ea5a4;text-decoration:none;font-weight:700;">${safeBusinessEmail}</a></td>
                          </tr>
                          <tr>
                            <td style="color:#6b7280;width:120px;padding:2px 0;">Affiliate:</td>
                            <td style="padding:2px 0;"><a href="mailto:${safeAffiliateEmail}" style="color:#0ea5a4;text-decoration:none;font-weight:700;">${safeAffiliateEmail}</a></td>
                          </tr>
                          <tr>
                            <td style="color:#6b7280;width:120px;padding:2px 0;">Offer:</td>
                            <td style="padding:2px 0;"><b>${safeOfferTitle}</b></td>
                          </tr>
                          ${safeNotes
                            ? `<tr>
                                <td style="color:#6b7280;width:120px;padding:2px 0;vertical-align:top;">Notes:</td>
                                <td style="padding:2px 0;">${safeNotes}</td>
                              </tr>`
                            : ``}
                        </table>
                      </div>

                      <!-- CTA -->
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:18px;">
                        <tr>
                          <td>
                            <a href="${ctaUrl}" style="display:inline-block;background:#00C2CB;color:#001015;text-decoration:none;font-weight:700;font-size:14px;padding:12px 16px;border-radius:12px;border:1px solid rgba(0,0,0,0.08);">
                              See request
                            </a>
                          </td>
                        </tr>
                      </table>

                      <div style="margin-top:14px;color:#6b7280;font-size:12px;">
                        Approve or reject it inside your dashboard.
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer (matches business-signup) -->
            <tr>
              <td style="padding:16px 8px 0 8px;font-family:Arial,Helvetica,sans-serif;color:#6b7280;">
                <div style="font-size:12px;line-height:1.6;">
                  Need help? Use the Nettmark chatbot inside the app or contact <a href="mailto:${helpEmail}" style="color:#0ea5a4;text-decoration:none;font-weight:700;">${helpEmail}</a>.
                </div>
                <div style="margin-top:6px;font-size:12px;">© 2026 Nettmark. Performance marketing under one roof.</div>
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
    console.error("[emails/business-new-affiliate-request] error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}

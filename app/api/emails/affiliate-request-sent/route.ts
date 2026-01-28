// app/api/emails/affiliate-request-sent/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

const LOGO_URL = "https://www.nettmark.com/icon.png";

// Simple HTML escaping so user-provided strings can’t break the email
function escapeHtml(input: unknown) {
  const s = String(input ?? "");
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getBaseUrl(req: Request) {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL;

  if (envUrl) return envUrl.replace(/\/$/, "");

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

    // 🔎 Debug (so we stop guessing)
    console.log("[affiliate-request-sent] body:", body);

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "Missing RESEND_API_KEY" },
        { status: 500 }
      );
    }

    // ✅ Make recipient robust: default to businessEmail
    const resolvedTo = (to || businessEmail || "").trim();

    // ✅ Only truly required fields
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
        { status: 400 }
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

    const safeBusinessEmail = escapeHtml(businessEmail);
    const safeAffiliateEmail = escapeHtml(affiliateEmail);
    const safeOfferTitle = escapeHtml(offerTitle || "Your offer"); // ✅ fallback
    const safeNotes = notes ? escapeHtml(notes) : "";

    const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f6f8;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      A new affiliate wants to promote one of your offers.
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4f6f8;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="max-width:640px;width:100%;">
            <!-- Header -->
            <tr>
              <td style="padding:0 0 14px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="width:38px;vertical-align:middle;">
                      <img src="${LOGO_URL}" width="38" height="38" alt="Nettmark" style="display:block;border-radius:10px;" />
                    </td>

                    <td style="padding-left:12px;vertical-align:middle;font-family:Arial,Helvetica,sans-serif;">
                      <div style="font-size:18px;font-weight:700;line-height:1;color:#0b0b0b;">Nettmark</div>
                      <div style="font-size:12px;color:#6b7280;margin-top:3px;">Business notifications</div>
                    </td>

                    <td align="right" style="vertical-align:middle;">
                      <span style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:0.12em;color:#6b7280;border:1px solid #e5e7eb;background:#ffffff;padding:7px 10px;border-radius:999px;">
                        REQUEST
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Card -->
            <tr>
              <td style="background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;padding:22px 22px 18px 22px;">
                <div style="font-family:Arial,sans-serif;">
                  <h1 style="margin:0 0 8px 0;font-size:22px;line-height:1.25;color:#0b0b0b;">
                    New affiliate request
                  </h1>
                  <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#4b5563;">
                    A new affiliate wants to promote one of your offers. Review it inside your dashboard.
                  </p>

                  <!-- Details box -->
                  <div style="border:1px solid #e5e7eb;background:#f9fafb;border-radius:14px;padding:14px 14px;margin:0 0 16px 0;">
                    <div style="font-size:12px;letter-spacing:0.14em;color:#6b7280;margin-bottom:10px;font-weight:700;">
                      REQUEST DETAILS
                    </div>

                    <div style="font-size:14px;color:#111827;line-height:1.7;">
                      <div><span style="color:#6b7280;">Business:</span> <a href="mailto:${safeBusinessEmail}" style="color:#00AAB2;text-decoration:none;">${safeBusinessEmail}</a></div>
                      <div><span style="color:#6b7280;">Affiliate:</span> <a href="mailto:${safeAffiliateEmail}" style="color:#00AAB2;text-decoration:none;">${safeAffiliateEmail}</a></div>
                      <div><span style="color:#6b7280;">Offer:</span> <strong>${safeOfferTitle}</strong></div>
                      ${
                        safeNotes
                          ? `<div style="margin-top:8px;"><span style="color:#6b7280;">Notes:</span> ${safeNotes}</div>`
                          : ""
                      }
                    </div>
                  </div>

                  <!-- CTA -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px 0;">
                    <tr>
                      <td>
                        <a href="${escapeHtml(ctaUrl)}"
                           style="display:inline-block;background:#00C2CB;color:#0b0b0b;text-decoration:none;font-family:Arial,sans-serif;font-weight:700;font-size:14px;padding:12px 16px;border-radius:12px;">
                          See request
                        </a>
                      </td>
                    </tr>
                  </table>

                  <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6;">
                    Approve or reject it inside your dashboard.
                  </p>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:14px 8px 0 8px;">
                <div style="font-family:Arial,sans-serif;font-size:12px;color:#6b7280;line-height:1.6;">
                  Need help? Use the Nettmark chatbot inside the app.<br/>
                  <span style="color:#9ca3af;">© ${new Date().getFullYear()} Nettmark. Performance marketing under one roof.</span>
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
      { status: 500 }
    );
  }
}
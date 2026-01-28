// app/api/emails/business-signup/route.ts
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
    const { to, businessEmail, businessName } = body || {};

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "Missing RESEND_API_KEY" },
        { status: 500 }
      );
    }

    // Only require fields this endpoint is responsible for.
    if (!to || !businessEmail) {
      console.error("[emails/business-signup] Missing fields:", {
        toPresent: !!to,
        businessEmailPresent: !!businessEmail,
        body,
      });

      return NextResponse.json(
        { ok: false, error: "Missing required fields: to, businessEmail" },
        { status: 400 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    const fromName = process.env.RESEND_FROM_NAME || "Nettmark";

    const safeBusinessEmail = escapeHtml(businessEmail);
    const safeBusinessName = businessName ? escapeHtml(businessName) : "";

    // Public absolute URL so email clients can load it.
    const LOGO_URL = "https://www.nettmark.com/icon.png";

    const subject = "Welcome to Nettmark (Business)";

    // Keep URLs absolute for email clients.
    const ctaUrl = "https://www.nettmark.com/login/business";
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
      Your business account is set up — next steps inside Nettmark.
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f4f7;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;">

            <!-- Header -->
            <tr>
              <td style="padding:6px 6px 14px 6px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="padding-right:12px;">
                      <img src="${LOGO_URL}" width="38" height="38" alt="Nettmark" style="display:block;border-radius:10px;" />
                    </td>
                    <td style="font-family:Arial,Helvetica,sans-serif;">
                      <div style="font-size:18px;font-weight:700;line-height:1;color:#0b0b0b;">Nettmark</div>
                      <div style="font-size:12px;color:#6b7280;margin-top:3px;">Business onboarding</div>
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
                      <div style="font-size:22px;font-weight:800;">Welcome${safeBusinessName ? `, ${safeBusinessName}` : ""}</div>
                      <div style="margin-top:10px;font-size:14px;line-height:1.6;color:#111827;">
                        Your business account is set up. Inside Nettmark you’ll find an onboarding flow that guides you through connecting Meta, creating an offer, and reviewing affiliate requests.
                      </div>

                      <!-- Checklist -->
                      <div style="margin-top:16px;background:#f8fafc;border:1px solid #eef2f7;border-radius:12px;padding:14px 14px;">
                        <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;font-weight:700;">Next steps</div>
                        <ul style="margin:10px 0 0 18px;padding:0;color:#111827;font-size:14px;line-height:1.7;">
                          <li><b>Create your first offer</b> (commission + payout rules)</li>
                          <li><b>Connect your Meta ad account</b> (so affiliates can run ads on your account)</li>
                          <li><b>Approve affiliates</b> and review ad ideas</li>
                        </ul>
                      </div>

                      <!-- Chatbot note -->
                      <div style="margin-top:14px;font-size:13px;line-height:1.6;color:#374151;">
                        If you hit any setup issues, use the Nettmark chatbot inside your dashboard — it’s built to guide you through each step.
                      </div>

                      <!-- Account email -->
                      <div style="margin-top:16px;font-size:12px;color:#6b7280;">Your login email</div>
                      <div style="margin-top:4px;font-size:14px;font-weight:700;">
                        <a href="mailto:${safeBusinessEmail}" style="color:#0ea5a4;text-decoration:none;">${safeBusinessEmail}</a>
                      </div>

                      <!-- Buttons -->
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:18px;">
                        <tr>
                          <td>
                            <a href="${ctaUrl}" style="display:inline-block;background:#00C2CB;color:#001015;text-decoration:none;font-weight:700;font-size:14px;padding:12px 16px;border-radius:12px;border:1px solid rgba(0,0,0,0.08);">
                              Open Nettmark
                            </a>
                          </td>
                          <td style="width:10px;"></td>
                          <td>
                            <a href="https://www.nettmark.com" style="display:inline-block;background:#ffffff;color:#111827;text-decoration:none;font-weight:700;font-size:14px;padding:12px 16px;border-radius:12px;border:1px solid #e5e7eb;">
                              Learn more
                            </a>
                          </td>
                        </tr>
                      </table>

                      <div style="margin-top:18px;color:#6b7280;font-size:12px;">
                        If you didn’t sign up for Nettmark, you can ignore this email.
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:16px 8px 0 8px;font-family:Arial,Helvetica,sans-serif;color:#6b7280;">
                <div style="font-size:12px;line-height:1.6;">
                  Need help? Reply to this email or contact <a href="mailto:${helpEmail}" style="color:#0ea5a4;text-decoration:none;font-weight:700;">${helpEmail}</a>.
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
      to: [String(to)],
      subject,
      html,
    });

    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    console.error("[emails/business-signup] error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { Resend } from "resend";

function escapeHtml(input: any) {
  const str = String(input ?? "");
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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
        { status: 400 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    const fromName = process.env.RESEND_FROM_NAME || "Nettmark";

    const safeUsername = escapeHtml(username);
    const safeAffiliateEmail = escapeHtml(affiliateEmail);

    const subject = "Welcome to Nettmark — your affiliate account is live";

    const brand = {
      name: fromName || "Nettmark",
      accent: "#00C2CB",
      text: "#0b0b0b",
      muted: "#6b7280",
      bg: "#f6f7f9",
      card: "#ffffff",
      border: "#e5e7eb",
    };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.nettmark.com";
    const ctaUrl = `${appUrl}/login/affiliate`;
    const logoUrl = `${appUrl}/icon.png`;

    const preheader = "You're approved to start running campaigns inside Nettmark.";

    const html = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${brand.name}</title>
  </head>
  <body style="margin:0;padding:0;background:${brand.bg};font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${brand.text};">
    <!-- Preheader (hidden) -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${preheader}
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${brand.bg};padding:28px 14px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;">
            <!-- Header -->
            <tr>
              <td style="padding:0 6px 14px 6px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="left" style="vertical-align:middle;">
                      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                        <tr>
                          <td style="padding:0 12px 0 0;vertical-align:middle;">
                            <img src="${logoUrl}" width="34" height="34" alt="${brand.name} logo" style="display:block;border-radius:10px;" />
                          </td>
                          <td style="vertical-align:middle;">
                            <div style="font-weight:800;letter-spacing:-0.02em;font-size:16px;line-height:1;">${brand.name}</div>
                            <div style="margin-top:4px;font-size:12px;color:${brand.muted};">Affiliate onboarding</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <span style="display:inline-block;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${brand.muted};border:1px solid ${brand.border};background:#fff;border-radius:999px;padding:8px 10px;">Welcome</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Card -->
            <tr>
              <td style="background:${brand.card};border:1px solid ${brand.border};border-radius:18px;padding:22px 20px;box-shadow:0 10px 30px rgba(0,0,0,0.06);">
                <div style="font-size:22px;font-weight:900;letter-spacing:-0.03em;margin:0 0 8px 0;">
                  Welcome${safeUsername ? `, ${safeUsername}` : ""}
                </div>
                <div style="font-size:14px;line-height:1.6;color:#111827;margin:0 0 14px 0;">
                  Your <b>affiliate account</b> is set up. You can now browse offers, request access, and run campaigns — all in one place.
                </div>

                <div style="border-left:4px solid ${brand.accent};background:#f0feff;border-radius:12px;padding:12px 12px;margin:14px 0 16px 0;">
                  <div style="font-weight:700;margin:0 0 4px 0;">Early access perk</div>
                  <div style="font-size:13px;color:#0f172a;line-height:1.55;">We’re onboarding the <b>first 150 users</b> as <b>free for life</b> in exchange for early feedback.</div>
                </div>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;">
                  <tr>
                    <td style="font-size:12px;color:${brand.muted};padding:0 0 6px 0;">Your login email</td>
                  </tr>
                  <tr>
                    <td style="font-size:14px;font-weight:700;color:#0f172a;padding:0 0 14px 0;">${safeAffiliateEmail}</td>
                  </tr>
                </table>

                <!-- CTA -->
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0 0 0;">
                  <tr>
                    <td>
                      <a href="${ctaUrl}" style="display:inline-block;background:${brand.accent};color:#001314;text-decoration:none;font-weight:800;font-size:14px;padding:12px 16px;border-radius:12px;">
                        Open Nettmark
                      </a>
                    </td>
                    <td style="padding-left:10px;">
                      <a href="${appUrl}" style="display:inline-block;background:#ffffff;color:#0f172a;text-decoration:none;font-weight:700;font-size:14px;padding:12px 16px;border-radius:12px;border:1px solid ${brand.border};">
                        Learn more
                      </a>
                    </td>
                  </tr>
                </table>

                <div style="margin-top:16px;font-size:12px;color:${brand.muted};line-height:1.6;">
                  If you didn’t sign up for Nettmark, you can ignore this email.
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:16px 8px 0 8px;">
                <div style="font-size:12px;color:${brand.muted};line-height:1.7;">
                  Need help? Reply to this email or contact <a href="mailto:support@nettmark.com" style="color:${brand.accent};text-decoration:none;font-weight:700;">support@nettmark.com</a>.
                  <br />
                  <span style="color:#9ca3af;">© ${new Date().getFullYear()} Nettmark. All rights reserved.</span>
                </div>
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

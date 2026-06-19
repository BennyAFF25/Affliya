import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const runtime = "nodejs";

function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.APP_URL ||
    "https://www.nettmark.com"
  ).replace(/\/$/, "");
}

function escapeHtml(input: unknown) {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || "").trim().toLowerCase();

  // Avoid account enumeration. The client should show the same success message.
  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: true });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[send-password-reset] Missing SUPABASE_SERVICE_ROLE_KEY");
    return NextResponse.json({ ok: true });
  }

  if (!process.env.RESEND_API_KEY) {
    console.error("[send-password-reset] Missing RESEND_API_KEY");
    return NextResponse.json({ ok: true });
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

  if (!supabaseUrl) {
    console.error("[send-password-reset] Missing Supabase URL");
    return NextResponse.json({ ok: true });
  }

  const appUrl = getAppUrl();
  const redirectTo = `${appUrl}/auth/update-password`;

  try {
    const supabaseAdmin = createClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });

    if (error) {
      console.error("[send-password-reset] Supabase generateLink error", error);
      return NextResponse.json({ ok: true });
    }

    const actionLink = data?.properties?.action_link;
    const tokenHash = data?.properties?.hashed_token;
    const resetUrl = tokenHash
      ? `${appUrl}/auth/update-password?token_hash=${encodeURIComponent(
          tokenHash,
        )}&type=recovery`
      : actionLink;

    if (!resetUrl) {
      console.error("[send-password-reset] Supabase did not return reset link data");
      return NextResponse.json({ ok: true });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "no-reply@nettmark.com";
    const fromName = process.env.RESEND_FROM_NAME || "Nettmark";
    const safeEmail = escapeHtml(email);
    const logoUrl = `${appUrl}/icon.png`;

    await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: email,
      subject: "Reset your Nettmark password",
      html: `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Reset your Nettmark password</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f7f8;font-family:Inter,Arial,sans-serif;color:#101828;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Use this secure link to reset your Nettmark password.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f8;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #dce8ea;box-shadow:0 18px 60px rgba(16,24,40,0.08);">
            <tr>
              <td style="background:#061415;padding:28px 28px 24px;text-align:center;">
                <img src="${logoUrl}" width="54" height="54" alt="Nettmark" style="display:block;margin:0 auto 14px;border-radius:14px;" />
                <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#7ff5fb;">Nettmark</div>
                <h1 style="margin:10px 0 0;font-size:25px;line-height:1.2;color:#ffffff;">Reset your password</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 28px;">
                <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#344054;">We received a request to reset the password for <strong>${safeEmail}</strong>.</p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#344054;">Click the button below to choose a new password. If you didn’t request this, you can safely ignore this email.</p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                  <tr>
                    <td align="center" bgcolor="#00C2CB" style="border-radius:999px;">
                      <a href="${resetUrl}" style="display:inline-block;padding:13px 24px;font-size:14px;font-weight:700;color:#031314;text-decoration:none;border-radius:999px;">Set a new password</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:#667085;">Button not working? Copy and paste this link into your browser:</p>
                <p style="margin:0;word-break:break-all;font-size:12px;line-height:1.5;color:#008c94;"><a href="${resetUrl}" style="color:#008c94;">${resetUrl}</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;background:#f8fbfb;border-top:1px solid #e5eef0;text-align:center;">
                <p style="margin:0;font-size:12px;color:#667085;">Nettmark account security</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
    });
  } catch (err) {
    console.error("[send-password-reset] Unexpected error", err);
  }

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { renderNettmarkEmail } from "../../../../utils/email/renderNettmarkEmail";

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
    const html = renderNettmarkEmail({
      previewText: "Use this secure link to reset your Nettmark password.",
      badge: { text: "Account security", tone: "info" },
      heading: "Reset your password",
      body: `We received a request to reset the password for ${email}.\n\nUse the button below to choose a new password. If you didn't request this, you can ignore this email.`,
      cta: { label: "Set a new password", href: resetUrl },
      rows: [{ label: "Reset link", value: "Open secure reset link", href: resetUrl }],
      footerNote: "For your security, never share your reset link with anyone.",
    });

    await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: email,
      subject: "Reset your Nettmark password",
      html,
    });
  } catch (err) {
    console.error("[send-password-reset] Unexpected error", err);
  }

  return NextResponse.json({ ok: true });
}

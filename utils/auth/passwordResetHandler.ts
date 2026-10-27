import { authJson, readAuthBody, validEmail } from "./request";
import { authRateLimit, authLog, type AuthLimiter } from "./rateLimit";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { renderNettmarkEmail } from "../email/renderNettmarkEmail";

function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.APP_URL ||
    "https://www.nettmark.com"
  ).replace(/\/$/, "");
}

export function createPasswordResetHandler(deps: { limit: AuthLimiter; createAdmin: typeof createClient; createResend: (key: string) => Pick<Resend, "emails">; log: typeof authLog } = { limit: authRateLimit, createAdmin: createClient, createResend: key => new Resend(key), log: authLog }) {
  return async function POST(req: Request) {
    let body;
    try { body = await readAuthBody(req); } catch { return authJson({ error: 'Please enter valid details and try again.' }, 400); }
    if (!validEmail(body.email)) return authJson({ error: 'Please enter a valid email address.' }, 400);
    const email = body.email.trim().toLowerCase();
    if (!await deps.limit(req, 'reset', email)) {
      deps.log('password_reset', email, 'limited_or_unavailable');
      return authJson({ ok: true });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      deps.log('password_reset', email, 'configuration_or_link_unavailable');
      return authJson({ ok: true });
    }

    if (!process.env.RESEND_API_KEY) {
      deps.log('password_reset', email, 'configuration_or_link_unavailable');
      return authJson({ ok: true });
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

    if (!supabaseUrl) {
      deps.log('password_reset', email, 'configuration_or_link_unavailable');
      return authJson({ ok: true });
    }

    const appUrl = getAppUrl();
    const redirectTo = `${appUrl}/auth/update-password`;

    try {
      const supabaseAdmin = deps.createAdmin(
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
        deps.log('password_reset', email, `generate_link:${error.code || error.status || 'failed'}`);
        return authJson({ ok: true });
      }

      const actionLink = data?.properties?.action_link;
      const tokenHash = data?.properties?.hashed_token;
      const resetUrl = tokenHash
        ? `${appUrl}/auth/update-password?token_hash=${encodeURIComponent(
            tokenHash,
          )}&type=recovery`
        : actionLink;

      if (!resetUrl) {
        deps.log('password_reset', email, 'configuration_or_link_unavailable');
        return authJson({ ok: true });
      }

      const resend = deps.createResend(process.env.RESEND_API_KEY);
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

      const result = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: email,
        subject: "Reset your Nettmark password",
        html,
      });
      if (result.error) deps.log('password_reset', email, 'email_delivery_failed');
    } catch {
      deps.log('password_reset', email, 'provider_failure');
    }

    return authJson({ ok: true });
  };
}

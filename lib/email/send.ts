import { Resend } from "resend";

export function getEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const fromName = process.env.RESEND_FROM_NAME || "Nettmark";
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL;

  if (!apiKey) throw new Error("Missing RESEND_API_KEY");
  if (!fromEmail) throw new Error("Missing RESEND_FROM_EMAIL");

  return { apiKey, fromEmail, fromName, adminEmail };
}

export async function sendEmail(opts: { to: string; subject: string; html: string }) {
  const { apiKey, fromEmail, fromName } = getEmailConfig();
  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });

  if (error) {
    console.error("[❌ email] Resend error:", error);
    throw new Error(typeof error === "string" ? error : "Resend send failed");
  }

  console.log("[✅ email] sent", { to: opts.to, subject: opts.subject, id: (data as any)?.id });
  return data;
}
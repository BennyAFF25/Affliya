import { Resend } from "resend";

// Shared internal transport; callers retain their existing error/response policy.
export async function sendFounderNotification(
  message: { subject: string; html: string },
  idempotencyKey?: string,
) {
  if (!process.env.ADMIN_NOTIFY_EMAIL) return null;
  const resend = new Resend(process.env.RESEND_API_KEY);
  return resend.emails.send({
    from: `${process.env.RESEND_FROM_NAME || "Nettmark"} <${process.env.RESEND_FROM_EMAIL}>`,
    to: [process.env.ADMIN_NOTIFY_EMAIL],
    ...message,
  }, idempotencyKey ? { idempotencyKey } : undefined);
}

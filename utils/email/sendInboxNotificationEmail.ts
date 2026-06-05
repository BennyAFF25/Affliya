import { Resend } from "resend";
import { renderNettmarkEmail } from "./renderNettmarkEmail";

export type SendInboxNotificationEmailArgs = {
  to: string;
  title: string;
  body?: string | null;
  linkUrl?: string | null;
};

export function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  const safeLocal = local.length <= 2 ? `${local[0] ?? ""}***` : `${local.slice(0, 2)}***`;
  return domain ? `${safeLocal}@${domain}` : "***";
}

export function normalizeEmail(value: unknown) {
  const email = String(value ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function getSiteUrl() {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "https://www.nettmark.com";

  return configured.replace(/\/+$/, "");
}

function toAbsoluteUrl(linkUrl?: string | null) {
  if (!linkUrl) return `${getSiteUrl()}/affiliate/inbox`;

  try {
    const parsed = new URL(linkUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : `${getSiteUrl()}/affiliate/inbox`;
  } catch {
    const path = linkUrl.startsWith("/") ? linkUrl : `/${linkUrl}`;
    return `${getSiteUrl()}${path}`;
  }
}

export async function sendInboxNotificationEmail(args: SendInboxNotificationEmailArgs) {
  const to = normalizeEmail(args.to);
  const title = String(args.title ?? "").trim();
  const messageBody = args.body ? String(args.body).trim() : "You have a new inbox update in Nettmark.";

  if (!to || !title) {
    return { ok: false as const, error: "missing_required_fields" };
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn("[emails/inbox-notification] RESEND_API_KEY missing; skipped", { to: maskEmail(to) });
    return { ok: true as const, skipped: true as const, reason: "missing_resend_api_key" };
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!fromEmail) {
    console.warn("[emails/inbox-notification] RESEND_FROM_EMAIL missing; skipped", { to: maskEmail(to) });
    return { ok: true as const, skipped: true as const, reason: "missing_resend_from_email" };
  }

  const fromName = process.env.RESEND_FROM_NAME || "Nettmark";
  const subject = `Nettmark inbox: ${title}`;
  const html = renderNettmarkEmail({
    previewText: messageBody,
    badge: { text: "Inbox update", tone: "info" },
    heading: title,
    body: messageBody,
    rows: [{ label: "Recipient", value: to }],
    cta: { label: "Open inbox update", href: toAbsoluteUrl(args.linkUrl) },
    footerNote: "This email mirrors a Nettmark inbox notification so you do not miss important campaign updates.",
  });

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to: [to],
    subject,
    html,
  });

  if (error) {
    throw new Error(typeof error === "string" ? error : "Resend send failed");
  }

  console.log("[emails/inbox-notification] sent", {
    to: maskEmail(to),
    subject,
    id: (data as any)?.id,
  });

  return { ok: true as const, data };
}

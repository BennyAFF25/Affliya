import { NextResponse } from "next/server";
import { Resend } from "resend";
import { renderNettmarkEmail } from "../../../../utils/email/renderNettmarkEmail";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { type, email, role } = body;

    if (!process.env.RESEND_API_KEY || !process.env.ADMIN_NOTIFY_EMAIL) {
      return NextResponse.json(
        { ok: false, error: "Missing env vars" },
        { status: 500 },
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const subject = `🚀 New ${role} signup on Nettmark`;

    const html = renderNettmarkEmail({
      previewText: `New ${role} activity on Nettmark.`,
      badge: { text: "Founder alert", tone: "info" },
      heading: `New ${role} just joined`,
      body: "A new user has entered Nettmark.",
      rows: [
        { label: "Type", value: String(type || "signup") },
        { label: "Role", value: String(role || "unknown") },
        { label: "Email", value: String(email || "unknown") },
      ],
      notice: {
        title: "Internal",
        body: "Founder-only system notification.",
        tone: "neutral",
      },
      cta: { label: "Open Nettmark", href: "https://www.nettmark.com" },
      recipientNote: "Internal Nettmark notification.",
    });

    await resend.emails.send({
      from: `${process.env.RESEND_FROM_NAME || "Nettmark"} <${process.env.RESEND_FROM_EMAIL}>`,
      to: [process.env.ADMIN_NOTIFY_EMAIL],
      subject,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[founder-notify]", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 },
    );
  }
}

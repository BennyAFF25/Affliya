import { NextResponse } from "next/server";
import { sendFounderNotification } from "../../../../utils/email/sendFounderNotification";
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

    await sendFounderNotification({ subject, html });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[founder-notify]", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 },
    );
  }
}

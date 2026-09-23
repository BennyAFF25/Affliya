import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { Resend } from "resend";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user?.email) {
      return NextResponse.json({ ok: false, error: "Please sign in and try again." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const section = body?.section;
    if ((section !== "business" && section !== "affiliate") || !message || message.length > 4000) {
      return NextResponse.json({ ok: false, error: "Enter a message of up to 4,000 characters." }, { status: 400 });
    }

    const to = "contact@nettmark.com";
    const fromEmail = process.env.RESEND_FROM_EMAIL;
    if (!process.env.RESEND_API_KEY || !fromEmail) {
      console.error("[support/message] Email configuration missing");
      return NextResponse.json({ ok: false, error: "Support email is temporarily unavailable. Please try again later." }, { status: 503 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: `${process.env.RESEND_FROM_NAME || "Nettmark"} <${fromEmail}>`,
      to: [to],
      replyTo: user.email,
      subject: `Nettmark ${section} support request`,
      text: `New ${section} support request\n\nFrom: ${user.email}\nUser ID: ${user.id}\n\n${message}`,
    });

    if (error) {
      console.error("[support/message] Resend rejected message", error);
      return NextResponse.json({ ok: false, error: "We could not send your message. Please try again." }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[support/message] Unexpected error", error);
    return NextResponse.json({ ok: false, error: "We could not send your message. Please try again." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Svix-verified Resend delivery status; cannot send email or modify finances. */
export async function POST(req: Request) {
  if (!process.env.RESEND_WEBHOOK_SECRET || !process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  const raw = await req.text();
  let event: { type: string; data?: { email_id?: string } };
  try {
    event = new Resend(process.env.RESEND_API_KEY).webhooks.verify({
      payload: raw,
      headers: {
        id: req.headers.get("svix-id") || "",
        timestamp: req.headers.get("svix-timestamp") || "",
        signature: req.headers.get("svix-signature") || "",
      },
      webhookSecret: process.env.RESEND_WEBHOOK_SECRET,
    }) as typeof event;
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }
  const eventId = req.headers.get("svix-id");
  const emailId = event.data?.email_id;
  if (!eventId || !emailId || !/^email\.(delivered|bounced|failed|suppressed|complained)$/.test(event.type)) {
    return NextResponse.json({ received: true, ignored: true });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const db = createClient(url, secret, { auth: { persistSession: false } });
  const { data: row, error: lookupError } = await db.from("notification_outbox")
    .select("id").eq("provider_message_id", emailId).maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Lookup error" }, { status: 503 });
  if (!row) return NextResponse.json({ received: true, ignored: true });
  const { error: logError } = await db.from("notification_delivery_events").insert({
    provider_event_id: eventId,
    provider_message_id: emailId,
    event_type: event.type,
  });
  if (logError && logError.code !== "23505")
    return NextResponse.json({ error: "Unable to record delivery event" }, { status: 503 });
  // Still apply the state update on a duplicate delivery, in case the earlier write failed.
  const { error } = await db.from("notification_outbox").update({
    delivery_status: event.type.slice("email.".length), updated_at: new Date().toISOString(),
  }).eq("id", row.id);
  if (error) return NextResponse.json({ error: "Unable to update delivery status" }, { status: 503 });
  return NextResponse.json({ received: true });
}

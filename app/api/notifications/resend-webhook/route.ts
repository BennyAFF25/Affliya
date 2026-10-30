import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OK_IGNORED = { received: true, ignored: true };

/** Svix-verified Resend delivery status; cannot send email or modify finances. */
export async function POST(req: Request) {
  if (!process.env.RESEND_WEBHOOK_SECRET || !process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing webhook signature" }, { status: 401 });
  }
  const raw = await req.text();
  let event: { type: string; data?: { email_id?: string } };
  try {
    event = new Resend(process.env.RESEND_API_KEY).webhooks.verify({
      payload: raw,
      headers: { id: svixId, timestamp: svixTimestamp, signature: svixSignature },
      webhookSecret: process.env.RESEND_WEBHOOK_SECRET,
    }) as typeof event;
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }
  const emailId = event.data?.email_id;
  if (!emailId || !/^email\.(delivered|bounced|failed|suppressed|complained)$/.test(event.type)) {
    return NextResponse.json(OK_IGNORED);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return NextResponse.json(OK_IGNORED);
  const db = createClient(url, secret, { auth: { persistSession: false } });
  // Delivery tracking tables may not exist yet; acknowledge rather than make Resend retry/disable.
  const { data: row, error: lookupError } = await db.from("notification_outbox")
    .select("id").eq("provider_message_id", emailId).maybeSingle();
  if (lookupError || !row) return NextResponse.json(OK_IGNORED);
  const { error: logError } = await db.from("notification_delivery_events").insert({
    provider_event_id: svixId,
    provider_message_id: emailId,
    event_type: event.type,
  });
  if (logError && logError.code !== "23505")
    return NextResponse.json({ error: "Unable to record delivery event" }, { status: 503 });
  const { error } = await db.from("notification_outbox").update({
    delivery_status: event.type.slice("email.".length), updated_at: new Date().toISOString(),
  }).eq("id", row.id);
  if (error) return NextResponse.json({ error: "Unable to update delivery status" }, { status: 503 });
  return NextResponse.json({ received: true });
}

const notAllowed = () => NextResponse.json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "POST" } });
export const GET = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;

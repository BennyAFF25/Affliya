import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Minimal internal delivery dashboard API. Never expose recipients or message payloads. */
export async function GET(req: Request) {
  const token = process.env.CRON_SECRET;
  if (!token || req.headers.get("authorization") !== "Bearer " + token)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const db = createClient(url, key, { auth: { persistSession: false } });
  const states = ["queued", "processing", "sent", "cancelled", "dead"] as const;
  const deliveries = ["delivered", "bounced", "failed", "suppressed", "complained"] as const;
  const [stateCounts, deliveryCounts] = await Promise.all([
    Promise.all(states.map(async status => {
      const result = await db.from("notification_outbox").select("id", { head: true, count: "exact" }).eq("status", status);
      if (result.error) throw result.error;
      return [status, result.count || 0] as const;
    })),
    Promise.all(deliveries.map(async status => {
      const result = await db.from("notification_outbox").select("id", { head: true, count: "exact" }).eq("delivery_status", status);
      if (result.error) throw result.error;
      return [status, result.count || 0] as const;
    })),
  ]).catch(() => [null, null] as const);
  if (!stateCounts || !deliveryCounts) return NextResponse.json({ error: "Metrics unavailable" }, { status: 503 });
  return NextResponse.json({
    enqueue_enabled: process.env.NETTMARK_NOTIFICATION_ENQUEUE_ENABLED === "true",
    send_enabled: process.env.NETTMARK_NOTIFICATION_SEND_ENABLED === "true",
    queue: Object.fromEntries(stateCounts), delivery: Object.fromEntries(deliveryCounts),
  }, { headers: { "Cache-Control": "no-store" } });
}

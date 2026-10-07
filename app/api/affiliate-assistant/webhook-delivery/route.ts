import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../utils/businessSubscriptions";
import {
  deliverPendingAffiliateWebhookEvents,
  enqueueInactiveBrandEvents,
} from "../../../../utils/affiliateAssistantWebhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function cronAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET || "";
  const expected = secret ? "Bearer " + secret : "";
  const actual = req.headers.get("authorization") || "";

  if (!expected || Buffer.byteLength(actual) !== Buffer.byteLength(expected)) {
    return false;
  }

  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export async function GET(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServerSupabaseClient();
    const inactiveQueued = await enqueueInactiveBrandEvents(supabase, 7);
    const delivery = await deliverPendingAffiliateWebhookEvents(supabase);
    return NextResponse.json({ ok: true, inactiveQueued, ...delivery });
  } catch (error) {
    console.warn("[affiliate-webhook] worker failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Affiliate webhook worker failed" },
      { status: 500 },
    );
  }
}

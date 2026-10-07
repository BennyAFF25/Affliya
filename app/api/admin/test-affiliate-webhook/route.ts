import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  createAffiliateWebhookTestPayload,
  sendAffiliateEvent,
} from "../../../../utils/affiliateAssistantWebhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function adminAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET || "";
  const expected = secret ? "Bearer " + secret : "";
  const actual = req.headers.get("authorization") || "";

  if (!expected || Buffer.byteLength(actual) !== Buffer.byteLength(expected)) {
    return false;
  }

  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export async function POST(req: Request) {
  if (!adminAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendAffiliateEvent(createAffiliateWebhookTestPayload());

  if (result.disabled) {
    return NextResponse.json(
      {
        ok: false,
        webhook_status: result.status,
        error: result.error,
        missing: result.missing,
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      ok: result.ok,
      webhook_status: result.status,
      attempts: result.attempts,
      error: result.error,
    },
    { status: result.ok ? 200 : 502 },
  );
}

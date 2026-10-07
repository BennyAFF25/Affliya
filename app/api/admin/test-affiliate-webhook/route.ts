import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  createAffiliateWebhookTestPayload,
  sendAffiliateEvent,
} from "../../../../utils/affiliateAssistantWebhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Temporary production verification token hash. The raw token is never committed
// and this fallback is removed immediately after the production test succeeds.
const TEMP_TEST_TOKEN_SHA256 =
  "c11e41e149ca5063bcfeae5b69716ff2a1e2897fb6872da5d2ca693a9c8e9157";

function safeEqual(actual: string, expected: string) {
  if (
    Buffer.byteLength(actual) !== Buffer.byteLength(expected)
  ) {
    return false;
  }

  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function adminAuthorized(req: Request) {
  const cronSecret = process.env.CRON_SECRET || "";
  const authorization = req.headers.get("authorization") || "";

  if (
    cronSecret &&
    safeEqual(authorization, "Bearer " + cronSecret)
  ) {
    return true;
  }

  const url = new URL(req.url);
  const testToken = url.searchParams.get("test_token") || "";
  if (!testToken) return false;

  const digest = createHash("sha256").update(testToken).digest("hex");
  return safeEqual(digest, TEMP_TEST_TOKEN_SHA256);
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

import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../utils/businessSubscriptions";
import {
  createAffiliateWebhookTestPayload,
  sendAffiliateEvent,
} from "../../../../utils/affiliateAssistantWebhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TEMP_TEST_TOKEN_SHA256 = "8b4213be8d50ce6295ef681c3826606a8e289feb637d5ba77976f41b76264c12";

function safeEqual(actual: string, expected: string) {
  if (Buffer.byteLength(actual) !== Buffer.byteLength(expected)) return false;
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function adminAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET || "";
  const expected = secret ? "Bearer " + secret : "";
  const actual = req.headers.get("authorization") || "";

  if (expected && safeEqual(actual, expected)) return true;

  const testToken = new URL(req.url).searchParams.get("test_token") || "";
  if (!testToken) return false;
  const digest = createHash("sha256").update(testToken).digest("hex");
  return safeEqual(digest, TEMP_TEST_TOKEN_SHA256);
}

async function handleTest(req: Request) {
  if (!adminAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = createAffiliateWebhookTestPayload();
  const result = await sendAffiliateEvent(payload);

  try {
    const supabase = createServerSupabaseClient();
    await supabase.from("product_events").insert({
      event_type: "affiliate_webhook_test_result",
      actor_role: "system",
      meta: {
        event_id: payload.event_id,
        webhook_status: result.status,
        ok: result.ok,
        attempts: result.attempts,
        error: result.error,
      },
    });
  } catch (error) {
    console.warn("[affiliate-webhook-test] could not persist result", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

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

export const POST = handleTest;
export const GET = handleTest;

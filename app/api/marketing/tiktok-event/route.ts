import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const TIKTOK_PIXEL_ID = "DAOA0D3C77U5VV2VBMNG";
const TIKTOK_EVENTS_API_URL =
  "https://business-api.tiktok.com/open_api/v1.3/event/track/";

type TikTokEventName = "ViewContent" | "ClickButton" | "Lead" | "Search";

type TikTokEventRequest = {
  eventName?: TikTokEventName;
  eventId?: string;
  properties?: Record<string, unknown>;
  pageUrl?: string;
  referrer?: string;
  email?: string;
  externalId?: string;
  ttclid?: string;
  ttp?: string;
  testEventCode?: string;
};

function sha256(value: string) {
  return createHash("sha256")
    .update(value.trim().toLowerCase(), "utf8")
    .digest("hex");
}

export async function POST(request: NextRequest) {
  const token = process.env.TIKTOK_EVENTS_API_ACCESS_TOKEN;

  if (!token) {
    console.error("[TikTok Events API] Missing TIKTOK_EVENTS_API_ACCESS_TOKEN");
    return NextResponse.json(
      { ok: false, error: "TikTok Events API token is not configured." },
      { status: 503 },
    );
  }

  let body: TikTokEventRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const {
    eventName,
    eventId,
    properties,
    pageUrl,
    referrer,
    email,
    externalId,
    ttclid,
    ttp,
    testEventCode,
  } = body;

  if (!eventName || !eventId) {
    return NextResponse.json(
      { ok: false, error: "eventName and eventId are required." },
      { status: 400 },
    );
  }

  if (!["ViewContent", "ClickButton", "Lead", "Search"].includes(eventName)) {
    return NextResponse.json({ ok: false, error: "Unsupported event." }, { status: 400 });
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || undefined;
  const userAgent = request.headers.get("user-agent") || undefined;

  const user = {
    ...(email ? { email: sha256(email) } : {}),
    ...(externalId ? { external_id: sha256(externalId) } : {}),
    ...(ttclid ? { ttclid } : {}),
    ...(ttp ? { ttp } : {}),
    ...(ip ? { ip } : {}),
    ...(userAgent ? { user_agent: userAgent } : {}),
  };

  const event = {
    event: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    user,
    ...(properties && Object.keys(properties).length > 0 ? { properties } : {}),
    ...(pageUrl || referrer
      ? {
          page: {
            ...(pageUrl ? { url: pageUrl } : {}),
            ...(referrer ? { referrer } : {}),
          },
        }
      : {}),
  };

  const payload = {
    event_source: "web",
    event_source_id: TIKTOK_PIXEL_ID,
    data: [event],
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  };

  try {
    const tiktokResponse = await fetch(TIKTOK_EVENTS_API_URL, {
      method: "POST",
      headers: {
        "Access-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const responseText = await tiktokResponse.text();
    let responseBody: unknown = null;

    try {
      responseBody = responseText ? JSON.parse(responseText) : null;
    } catch {
      responseBody = responseText;
    }

    const apiCode =
      responseBody && typeof responseBody === "object" && "code" in responseBody
        ? Number((responseBody as { code?: unknown }).code)
        : undefined;

    if (!tiktokResponse.ok || (apiCode !== undefined && apiCode !== 0)) {
      console.error("[TikTok Events API] Event rejected", {
        status: tiktokResponse.status,
        eventName,
        eventId,
        response: responseBody,
      });

      return NextResponse.json(
        { ok: false, error: "TikTok rejected the event.", tiktok: responseBody },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, tiktok: responseBody });
  } catch (error) {
    console.error("[TikTok Events API] Request failed", error);
    return NextResponse.json(
      { ok: false, error: "Could not send TikTok event." },
      { status: 502 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";

const REDDIT_PIXEL_ID = "a2_jpxi5jrkyvlx";
const REDDIT_CAPI_URL = `https://ads-api.reddit.com/api/v3/pixels/${REDDIT_PIXEL_ID}/conversion_events`;

type RedditConversionName = "SignUp" | "CreateOffer";

type RedditConversionRequest = {
  eventName?: RedditConversionName;
  conversionId?: string;
  eventSourceUrl?: string;
  email?: string;
  externalId?: string;
  clickId?: string;
  screenWidth?: number;
  screenHeight?: number;
};

export async function POST(request: NextRequest) {
  const token = process.env.REDDIT_CONVERSION_ACCESS_TOKEN;

  if (!token) {
    console.error("[Reddit CAPI] Missing REDDIT_CONVERSION_ACCESS_TOKEN");
    return NextResponse.json(
      { ok: false, error: "Reddit conversion token is not configured." },
      { status: 503 },
    );
  }

  let body: RedditConversionRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const {
    eventName,
    conversionId,
    eventSourceUrl,
    email,
    externalId,
    clickId,
    screenWidth,
    screenHeight,
  } = body;

  if (!eventName || !conversionId) {
    return NextResponse.json(
      { ok: false, error: "eventName and conversionId are required." },
      { status: 400 },
    );
  }

  if (eventName !== "SignUp" && eventName !== "CreateOffer") {
    return NextResponse.json({ ok: false, error: "Unsupported event." }, { status: 400 });
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor?.split(",")[0]?.trim() || undefined;
  const userAgent = request.headers.get("user-agent") || undefined;
  const hasScreenDimensions =
    Number.isFinite(screenWidth) &&
    Number.isFinite(screenHeight) &&
    Number(screenWidth) > 0 &&
    Number(screenHeight) > 0;

  const event = {
    event_at: Date.now(),
    action_source: "WEBSITE",
    ...(eventSourceUrl ? { event_source_url: eventSourceUrl } : {}),
    ...(clickId ? { click_id: clickId } : {}),
    type:
      eventName === "SignUp"
        ? { tracking_type: "SIGN_UP" }
        : { tracking_type: "CUSTOM", custom_event_name: "CreateOffer" },
    metadata: {
      conversion_id: conversionId,
    },
    user: {
      ...(ipAddress ? { ip_address: ipAddress } : {}),
      ...(userAgent ? { user_agent: userAgent } : {}),
      ...(hasScreenDimensions
        ? {
            screen_dimensions: {
              width: Number(screenWidth),
              height: Number(screenHeight),
            },
          }
        : {}),
      ...(email ? { email: email.trim().toLowerCase() } : {}),
      ...(externalId ? { external_id: externalId } : {}),
    },
  };

  try {
    const redditResponse = await fetch(REDDIT_CAPI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: { events: [event] } }),
      cache: "no-store",
    });

    const responseText = await redditResponse.text();
    let responseBody: unknown = null;

    try {
      responseBody = responseText ? JSON.parse(responseText) : null;
    } catch {
      responseBody = responseText;
    }

    if (!redditResponse.ok) {
      console.error("[Reddit CAPI] Event rejected", {
        status: redditResponse.status,
        eventName,
        conversionId,
        response: responseBody,
      });

      return NextResponse.json(
        { ok: false, error: "Reddit rejected the conversion event." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, reddit: responseBody });
  } catch (error) {
    console.error("[Reddit CAPI] Request failed", error);
    return NextResponse.json(
      { ok: false, error: "Could not send Reddit conversion." },
      { status: 502 },
    );
  }
}

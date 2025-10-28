import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Setup your Supabase client (use env vars)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use the service role for inserts
);

function normalizeUrl(url: string) {
  return url.toLowerCase().replace(/\/+$/, "");
}

async function getAllowOrigin(origin: string | null) {
  if (!origin) return "*";
  const normalizedOrigin = normalizeUrl(origin);

  // Query all websites from offers table
  const { data: offers, error } = await supabase.from("offers").select("website");
  if (error) {
    // If error querying offers, fallback to original logic
    return "*";
  }

  const offerWebsites = offers?.map((o) => normalizeUrl(o.website)) || [];

  // Check if origin matches any offer website
  if (offerWebsites.includes(normalizedOrigin)) return origin;

  // Also allow nettmark.com, affliya.com, and localhost for dev
  if (
    normalizedOrigin.includes("nettmark.com") ||
    normalizedOrigin.includes("affliya.com") ||
    normalizedOrigin.includes("localhost")
  ) {
    return origin;
  }

  return "*";
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") || req.headers.get("Origin") || "null";
  const allowOrigin = await getAllowOrigin(origin);
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin") || req.headers.get("Origin") || "null";
  const allowOrigin = await getAllowOrigin(origin);

  try {
    const body = await req.json();
    // Debug log for payloads
    console.log("[TRACK EVENT] Incoming:", JSON.stringify(body));

    const { business, offer_id, event_type, url, amount, user_email, campaign_id, affiliate_email } = body;

    if (!affiliate_email) {
      return new Response(
        JSON.stringify({ error: "affiliate_email is required" }),
        { status: 400, headers: { "Access-Control-Allow-Origin": allowOrigin, "Content-Type": "application/json" } }
      );
    }

    const { error } = await supabase.from("campaign_tracking_events").insert({
      offer_id,
      campaign_id,
      affiliate_email,
      event_type,
      event_data: { url, amount, user_email },
    });

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Access-Control-Allow-Origin": allowOrigin, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 400, headers: { "Access-Control-Allow-Origin": allowOrigin, "Content-Type": "application/json" } }
    );
  }
}
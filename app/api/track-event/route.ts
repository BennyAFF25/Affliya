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
    console.log("[CORS] Error querying offers:", error);
    return "*";
  }

  const offerWebsites = offers?.map((o) => normalizeUrl(o.website)) || [];
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
  console.log("[CORS] OPTIONS Origin:", origin, "| Allow:", allowOrigin);
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
  console.log("[CORS] POST Origin:", origin, "| Allow:", allowOrigin);

  try {
    const rawBody = await req.text();
    console.log("[TRACK EVENT] Raw body:", rawBody);

    const body = JSON.parse(rawBody);
    console.log("[TRACK EVENT] Parsed body:", body);

    const { business, offer_id, event_type, url, amount, user_email, campaign_id, affiliate_email } = body;

    if (!affiliate_email) {
      console.log("[ERROR] Missing affiliate_email");
      return new Response(
        JSON.stringify({ error: "affiliate_email is required" }),
        { status: 400, headers: { "Access-Control-Allow-Origin": allowOrigin, "Content-Type": "application/json" } }
      );
    }

    const insertPayload = {
      offer_id,
      campaign_id,
      affiliate_email,
      event_type,
      event_data: { url, amount, user_email },
    };
    console.log("[SUPABASE] Insert payload:", insertPayload);

    const { error } = await supabase.from("campaign_tracking_events").insert(insertPayload);

    if (error) {
      console.log("[SUPABASE] Insert error:", error);
      throw error;
    }

    console.log("[SUPABASE] Inserted successfully!");
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Access-Control-Allow-Origin": allowOrigin, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.log("[ERROR] Catch block:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 400, headers: { "Access-Control-Allow-Origin": allowOrigin, "Content-Type": "application/json" } }
    );
  }
}
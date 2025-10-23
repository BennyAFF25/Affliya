// /app/api/track-event/route.ts

import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Setup your Supabase client (use env vars)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use the service role for inserts
);

// CORS headers (must be present on every response)
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  // Empty 200 response for preflight, with CORS
  return new Response(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { business, offer_id, event_type, url, amount, user_email, campaign_id, affiliate_email } = body;

    if (!affiliate_email) {
      return new Response(
        JSON.stringify({ error: "affiliate_email is required" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
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
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
}
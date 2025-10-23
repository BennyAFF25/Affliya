// /app/api/track-event/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Setup your Supabase client (use env vars)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use the service role for inserts
);

// CORS middleware
function setCorsHeaders(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*"); // For production, specify trusted domains
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

// Handle preflight OPTIONS request
export async function OPTIONS() {
  const response = NextResponse.json({}, { status: 200 });
  return setCorsHeaders(response);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { business, offer_id, event_type, url, amount, user_email, campaign_id, affiliate_email } = body;

    if (!affiliate_email) {
      const res = NextResponse.json({ error: "affiliate_email is required" }, { status: 400 });
      return setCorsHeaders(res);
    }

    const { error } = await supabase.from("campaign_tracking_events").insert({
      offer_id,
      campaign_id,
      affiliate_email,
      event_type,
      event_data: { url, amount, user_email },
    });

    if (error) throw error;

    const res = NextResponse.json({ success: true });
    return setCorsHeaders(res);
  } catch (err) {
    const res = NextResponse.json({ error: String(err) }, { status: 400 });
    return setCorsHeaders(res);
  }
}
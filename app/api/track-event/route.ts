// /app/api/track-event/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Setup your Supabase client (use env vars)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use the service role for inserts
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { business, offer_id, event_type, url, amount, user_email, campaign_id, affiliate_email } = body;

    if (!affiliate_email) {
      return NextResponse.json({ error: "affiliate_email is required" }, { status: 400 });
    }

    const { error } = await supabase.from("campaign_tracking_events").insert({
      offer_id,
      campaign_id,
      affiliate_email,
      event_type,
      event_data: { url, amount, user_email },
    });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
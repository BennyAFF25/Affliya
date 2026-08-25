/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import supabaseAdmin from "@/../utils/supabase/server-client";

export async function GET(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const campaignId = String(searchParams.get("campaignId") || "").trim();

    let query = (supabaseAdmin as any)
      .from("live_campaigns")
      .select("id, type, offer_id, business_email, affiliate_email, media_url, caption, platform, created_from, status, created_at, business_id, affiliate_user_id")
      .eq("affiliate_email", user.email)
      .order("created_at", { ascending: false });

    if (campaignId) {
      query = query.eq("id", campaignId).limit(1).maybeSingle();
      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return NextResponse.json({ ok: true, campaign: data || null });
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true, campaigns: data || [] });
  } catch (error: any) {
    console.error("[affiliate/live-campaigns][GET] error", error);
    return NextResponse.json({ ok: false, error: error?.message || "Unexpected error" }, { status: 500 });
  }
}

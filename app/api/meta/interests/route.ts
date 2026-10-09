import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "../../../../../utils/businessSubscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Official Meta interests only; returns labels + numeric IDs, never business tokens. */
export async function GET(req: NextRequest) {
  const client = createRouteHandlerClient({ cookies });
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user?.email) {
    return NextResponse.json({ error: "Sign in to search interests." }, { status: 401 });
  }
  const offerId = String(req.nextUrl.searchParams.get("offerId") || "");
  const q = String(req.nextUrl.searchParams.get("q") || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(offerId) || q.length < 2 || q.length > 80) {
    return NextResponse.json({ error: "Enter at least two characters." }, { status: 400 });
  }
  try {
    const admin = createServerSupabaseClient();
    const { data: offer, error: offerError } = await admin.from("offers")
      .select("id,business_email,meta_page_id,meta_ad_account_id")
      .eq("id", offerId).maybeSingle();
    if (offerError || !offer?.business_email || !offer?.meta_page_id || !offer?.meta_ad_account_id) {
      return NextResponse.json({ error: "This offer needs a connected Meta account to search interests." }, { status: 409 });
    }
    const { data: connections, error: connectionError } = await admin
      .from("meta_connections")
      .select("access_token,ad_account_id,page_id,created_at")
      .eq("business_email", offer.business_email)
      .eq("page_id", offer.meta_page_id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (connectionError) throw connectionError;
    const account = String(offer.meta_ad_account_id).replace(/^act_/, "");
    const connection = (connections || []).find((item) =>
      item.access_token && String(item.ad_account_id || "").replace(/^act_/, "") === account,
    );
    if (!connection?.access_token) {
      return NextResponse.json({ error: "The business must reconnect Meta before interests can be searched." }, { status: 409 });
    }
    const url = new URL("https://graph.facebook.com/v19.0/search");
    url.searchParams.set("type", "adinterest");
    url.searchParams.set("q", q);
    url.searchParams.set("limit", "15");
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${connection.access_token}` },
      cache: "no-store",
    });
    const json = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(json?.data)) {
      return NextResponse.json({
        error: "Meta interest search is unavailable. Retry or ask the business to reconnect Meta.",
      }, { status: 502 });
    }
    const interests = json.data
      .map((item: { id?: unknown; name?: unknown }) => ({
        id: String(item.id || ""), name: String(item.name || ""),
      }))
      .filter((item: { id: string; name: string }) => /^\d{2,30}$/.test(item.id) && item.name);
    return NextResponse.json({ interests }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[meta/interests] interest lookup failed", error);
    return NextResponse.json({ error: "Meta interest search failed." }, { status: 500 });
  }
}

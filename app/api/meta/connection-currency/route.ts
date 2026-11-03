import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "../../../../utils/supabase/createServerClient";

export const dynamic = "force-dynamic";

/** Display currency of the latest Meta connection for a live ad's business. Caller must be that ad's affiliate or business. */
export async function GET(req: Request) {
  const liveAdId = new URL(req.url).searchParams.get("liveAdId") || "";
  if (!/^[0-9a-f-]{36}$/i.test(liveAdId)) return NextResponse.json({ error: "invalid_live_ad" }, { status: 400 });

  const userSupabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await userSupabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createServerSupabaseClient();
  const { data: ad } = await admin
    .from("live_ads")
    .select("business_email,affiliate_email")
    .eq("id", liveAdId)
    .maybeSingle();
  const businessEmail = String(ad?.business_email || "");
  const allowed = [businessEmail, String(ad?.affiliate_email || "")].some((value) => value && value.toLowerCase() === email);
  if (!ad || !allowed) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data } = await admin
    .from("meta_connections")
    .select("ad_account_currency")
    .eq("business_email", businessEmail)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const currency = typeof data?.ad_account_currency === "string" ? data.ad_account_currency.toUpperCase() : null;
  return NextResponse.json({ currency }, { headers: { "Cache-Control": "no-store" } });
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import supabaseAdmin from "@/../utils/supabase/server-client";
import {
  visibleOnboardingOffer, rankOnboardingOffers, type OnboardingOffer,
} from "@/../utils/affiliate/onboarding";
import { eligibleCreative } from "@/../utils/affiliate/promotionPack";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user?.email) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("role, terms_accepted").eq("id", user.id).maybeSingle();
  if (profileError) return NextResponse.json({ error: "Could not load your profile." }, { status: 503 });
  if (profile?.role !== "affiliate") return NextResponse.json({ error: "An affiliate account is required." }, { status: 403 });
  const [offerResult, requestResult] = await Promise.all([
    supabase.from("offers").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("affiliate_requests").select("offer_id, status").eq("affiliate_email", user.email),
  ]);
  if (offerResult.error || requestResult.error) return NextResponse.json({ error: "Could not load marketplace offers. Please try again." }, { status: 503 });
  const requests = new Map<string, string>((requestResult.data || []).map(row => [String(row.offer_id), String(row.status).toLowerCase()]));
  const rows = ((offerResult.data || []) as Record<string, unknown>[]).filter(row => visibleOnboardingOffer(row, requests.get(String(row.id))));
  // Only counts are exposed here; brand captions require approved offer access.
  const emails = [...new Set(rows.map(row => String(row.business_email)))];
  let assets: Record<string, unknown>[] | null = null;
  if (emails.length) {
    const result = await supabaseAdmin.from("business_creatives").select("id,business_email,offer_id,allow_organic,organic_preapproved,is_active,archived_at,media_url")
      .in("business_email", emails).eq("is_active", true).is("archived_at", null);
    if (!result.error) assets = result.data as Record<string, unknown>[];
  }
  const numberOrNull = (value: unknown) => value != null && Number.isFinite(Number(value)) ? Number(value) : null;
  const textOrNull = (value: unknown) => typeof value === "string" && value.trim() ? value : null;
  const offers: OnboardingOffer[] = rows.map(row => ({
    id: String(row.id), title: textOrNull(row.title) || "Brand offer",
    description: textOrNull(row.description) || "", logoUrl: textOrNull(row.logo_url),
    commission: numberOrNull(row.commission), commissionValue: numberOrNull(row.commission_value),
    currency: textOrNull(row.currency), type: textOrNull(row.type),
    participationMode: (row.participation_mode || "open") as OnboardingOffer["participationMode"],
    requestStatus: requests.get(String(row.id)) || null,
    readyOrganicCount: assets === null ? null : assets.filter(asset =>
      eligibleCreative(asset, row, "organic") && asset.organic_preapproved === true && !!asset.media_url).length,
  }));
  return NextResponse.json({
    offers: rankOnboardingOffers(offers), termsAccepted: profile.terms_accepted === true,
    userId: user.id,
  }, { headers: { "Cache-Control": "private, no-store" } });
}

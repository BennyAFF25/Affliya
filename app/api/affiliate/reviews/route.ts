import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import supabaseAdmin from "@/../utils/supabase/server-client";

export const dynamic = "force-dynamic";

type ReviewRow = {
  id: string;
  kind: "paid" | "organic";
  offerId: string;
  offerTitle: string;
  status: string;
  createdAt: string | null;
  businessViewedAt: string | null;
  title: string;
  previewUrl: string | null;
  platform?: string | null;
};

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const email = user.email;
    const [{ data: ads, error: adsError }, { data: organic, error: organicError }] =
      await Promise.all([
        (supabaseAdmin as any)
          .from("ad_ideas")
          .select("id,offer_id,status,created_at,headline,caption,file_url")
          .eq("affiliate_email", email)
          .order("created_at", { ascending: false })
          .limit(50),
        (supabaseAdmin as any)
          .from("organic_posts")
          .select("id,offer_id,status,created_at,caption,platform,image_url,video_url")
          .eq("affiliate_email", email)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

    if (adsError) throw adsError;
    if (organicError) throw organicError;

    const allRows = [...(ads || []), ...(organic || [])];
    const submissionIds = Array.from(
      new Set(allRows.map((row: any) => String(row.id || "")).filter(Boolean)),
    );
    const offerIds = Array.from(
      new Set(allRows.map((row: any) => String(row.offer_id || "")).filter(Boolean)),
    );

    const offerTitleById = new Map<string, string>();
    if (offerIds.length) {
      const { data: offers, error: offersError } = await (supabaseAdmin as any)
        .from("offers")
        .select("id,title")
        .in("id", offerIds);
      if (offersError) throw offersError;
      for (const offer of offers || []) {
        offerTitleById.set(String(offer.id), String(offer.title || "Offer"));
      }
    }

    const viewedAtBySubmission = new Map<string, string>();
    if (submissionIds.length) {
      const { data: events, error: eventsError } = await (supabaseAdmin as any)
        .from("business_subscription_gate_events")
        .select("submission_id,created_at")
        .eq("event_type", "campaign_review_opened")
        .in("submission_id", submissionIds)
        .order("created_at", { ascending: true });

      if (eventsError) throw eventsError;
      for (const event of events || []) {
        const id = String(event.submission_id || "");
        if (id && !viewedAtBySubmission.has(id) && event.created_at) {
          viewedAtBySubmission.set(id, event.created_at);
        }
      }
    }

    const rows: ReviewRow[] = [
      ...(ads || []).map((row: any) => ({
        id: String(row.id),
        kind: "paid" as const,
        offerId: String(row.offer_id || ""),
        offerTitle: offerTitleById.get(String(row.offer_id || "")) || "Offer",
        status: String(row.status || "pending").toLowerCase(),
        createdAt: row.created_at || null,
        businessViewedAt: viewedAtBySubmission.get(String(row.id)) || null,
        title: String(row.headline || row.caption || "Paid ad submission"),
        previewUrl: row.file_url || null,
      })),
      ...(organic || []).map((row: any) => ({
        id: String(row.id),
        kind: "organic" as const,
        offerId: String(row.offer_id || ""),
        offerTitle: offerTitleById.get(String(row.offer_id || "")) || "Offer",
        status: String(row.status || "pending").toLowerCase(),
        createdAt: row.created_at || null,
        businessViewedAt: viewedAtBySubmission.get(String(row.id)) || null,
        title: String(row.caption || "Organic promotion submission"),
        previewUrl: row.image_url || row.video_url || null,
        platform: row.platform || null,
      })),
    ].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    return NextResponse.json({ ok: true, submissions: rows });
  } catch (error) {
    console.error("[affiliate/reviews]", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

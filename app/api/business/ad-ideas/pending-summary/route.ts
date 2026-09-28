import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "@/../utils/businessSubscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userSupabase = createRouteHandlerClient({ cookies });
    const { data: authData, error: authError } = await userSupabase.auth.getUser();
    const user = authData?.user || null;

    if (authError || !user?.email) {
      return NextResponse.json(
        { success: false, error: "UNAUTHENTICATED" },
        { status: 401 },
      );
    }

    const admin = createServerSupabaseClient();
    const { data: ideas, error: ideasError } = await admin
      .from("ad_ideas")
      .select("id,offer_id,affiliate_email,status,created_at,budget_amount,budget_type,daily_budget")
      .eq("business_email", user.email)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5);

    if (ideasError) {
      throw new Error(`Failed to load pending campaigns: ${ideasError.message}`);
    }

    const offerIds = Array.from(
      new Set((ideas || []).map((idea: any) => String(idea.offer_id || "")).filter(Boolean)),
    );
    const titleByOffer: Record<string, string> = {};

    if (offerIds.length > 0) {
      const { data: offers, error: offersError } = await admin
        .from("offers")
        .select("id,title")
        .in("id", offerIds)
        .eq("business_email", user.email);

      if (offersError) {
        console.warn("[business/ad-ideas/pending-summary] offer titles failed", offersError);
      } else {
        (offers || []).forEach((offer: any) => {
          titleByOffer[String(offer.id)] = String(offer.title || "Untitled offer");
        });
      }
    }

    return NextResponse.json({
      success: true,
      campaigns: (ideas || []).map((idea: any) => ({
        ...idea,
        offer_title: titleByOffer[String(idea.offer_id)] || "Untitled offer",
      })),
    });
  } catch (error) {
    console.error("[business/ad-ideas/pending-summary]", error);
    return NextResponse.json(
      {
        success: false,
        error: "PENDING_CAMPAIGNS_FAILED",
        message: error instanceof Error ? error.message : "Could not load pending campaigns.",
      },
      { status: 500 },
    );
  }
}

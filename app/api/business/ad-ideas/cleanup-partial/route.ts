import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "../../../../../utils/businessSubscriptions";
import { resolveOfferPaidReadiness } from "../../../../../utils/offerReadiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function safeParse(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { _raw: text };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const adIdeaId = String(body?.adIdeaId || "").trim();
    if (!adIdeaId) {
      return NextResponse.json(
        { success: false, error: "INVALID_REQUEST", message: "adIdeaId is required." },
        { status: 400 },
      );
    }

    const userSupabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await userSupabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json(
        { success: false, error: "UNAUTHENTICATED" },
        { status: 401 },
      );
    }

    const admin = createServerSupabaseClient();
    const { data: idea, error: ideaError } = await admin
      .from("ad_ideas")
      .select("id,offer_id,business_email,meta_campaign_id")
      .eq("id", adIdeaId)
      .maybeSingle();

    if (ideaError) {
      throw new Error(`Failed to load proposal: ${ideaError.message}`);
    }
    if (!idea || idea.business_email !== user.email) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED" },
        { status: 403 },
      );
    }

    const { data: existingLive, error: liveError } = await admin
      .from("live_ads")
      .select("id")
      .eq("ad_idea_id", adIdeaId)
      .limit(1)
      .maybeSingle();

    if (liveError) {
      throw new Error(`Failed to check live campaign state: ${liveError.message}`);
    }
    if (existingLive?.id) {
      return NextResponse.json(
        {
          success: false,
          error: "CAMPAIGN_ALREADY_LIVE",
          message: "This proposal already has a live campaign and cannot be cleaned up as a partial launch.",
        },
        { status: 409 },
      );
    }

    const metaCampaignId = String(idea.meta_campaign_id || "").trim();
    if (!metaCampaignId) {
      return NextResponse.json({ success: true, alreadyClean: true });
    }

    const offerId = String(idea.offer_id || "").trim();
    const paidReadiness = await resolveOfferPaidReadiness({
      supabase: admin as never,
      offerId,
    });

    const selectedPageId = paidReadiness.resolvedMeta.pageId;
    const selectedAdAccountId = paidReadiness.resolvedMeta.adAccountId;
    if (!selectedPageId || !selectedAdAccountId) {
      return NextResponse.json(
        {
          success: false,
          error: "META_CONNECTION_REQUIRED",
          message: "Reconnect Meta before cleaning up this partial campaign.",
        },
        { status: 409 },
      );
    }

    const { data: connection, error: connectionError } = await admin
      .from("meta_connections")
      .select("access_token")
      .eq("business_email", user.email)
      .eq("page_id", selectedPageId)
      .eq("ad_account_id", selectedAdAccountId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (connectionError || !connection?.access_token) {
      return NextResponse.json(
        {
          success: false,
          error: "META_CONNECTION_REQUIRED",
          message: "Nettmark could not access the connected Meta account for cleanup.",
        },
        { status: 409 },
      );
    }

    const deleteResponse = await fetch(
      `https://graph.facebook.com/v19.0/${encodeURIComponent(metaCampaignId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
        },
      },
    );
    const deleteJson = await safeParse(deleteResponse);

    if (!deleteResponse.ok || deleteJson?.success === false || deleteJson?.error) {
      return NextResponse.json(
        {
          success: false,
          error: "META_CLEANUP_FAILED",
          message:
            deleteJson?.error?.error_user_msg ||
            deleteJson?.error?.message ||
            "Meta would not remove the partial campaign.",
          meta: deleteJson,
        },
        { status: 502 },
      );
    }

    const { error: clearError } = await admin
      .from("ad_ideas")
      .update({ meta_campaign_id: null, meta_status: null })
      .eq("id", adIdeaId)
      .eq("business_email", user.email)
      .eq("meta_campaign_id", metaCampaignId);

    if (clearError) {
      throw new Error(`Meta campaign was removed but Nettmark could not clear the stored ID: ${clearError.message}`);
    }

    return NextResponse.json({
      success: true,
      cleanedCampaignId: metaCampaignId,
    });
  } catch (error) {
    console.error("[business/ad-ideas/cleanup-partial]", error);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Could not clean up the partial campaign.",
      },
      { status: 500 },
    );
  }
}

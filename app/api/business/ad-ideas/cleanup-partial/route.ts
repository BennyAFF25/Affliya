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
      .select("id,offer_id,business_email,status,meta_campaign_id")
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

    if (idea.status !== "pending") {
      return NextResponse.json({
        success: false, error: "INVALID_PROPOSAL_STATE",
        message: "Only pending proposals can recover a partial Meta campaign.",
      }, { status: 409 });
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

    // Verify the exact Meta object is an orphan in the expected ad account.
    // Do not delete a running campaign or one with any ad sets / ads.
    const inspectResponse = await fetch(
      `https://graph.facebook.com/v19.0/${encodeURIComponent(metaCampaignId)}?fields=id,account_id,status,effective_status,adsets.limit(1){id},ads.limit(1){id}`,
      { headers: { Authorization: `Bearer ${connection.access_token}` } },
    );
    const metaCampaign = await safeParse(inspectResponse);
    if (!inspectResponse.ok || metaCampaign?.error) {
      return NextResponse.json({
        success: false, error: "META_INSPECTION_FAILED",
        message: "Nettmark could not verify the Meta campaign before cleanup. Check Ads Manager before retrying.",
      }, { status: 409 });
    }
    const expectedAccount = String(selectedAdAccountId).replace(/^act_/, "");
    const actualAccount = String(metaCampaign?.account_id || "").replace(/^act_/, "");
    if (
      String(metaCampaign?.id || "") !== metaCampaignId ||
      actualAccount !== expectedAccount ||
      String(metaCampaign?.status || "").toUpperCase() !== "PAUSED" ||
      (metaCampaign?.adsets?.data?.length ?? 0) > 0 ||
      (metaCampaign?.ads?.data?.length ?? 0) > 0
    ) {
      return NextResponse.json({
        success: false, error: "META_CLEANUP_UNSAFE",
        message: "Meta campaign ownership, paused state or empty children could not be confirmed. Nothing was deleted; review it in Ads Manager.",
      }, { status: 409 });
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

    const { data: cleared, error: clearError } = await admin
      .from("ad_ideas")
      .update({ meta_campaign_id: null, meta_status: null })
      .eq("id", adIdeaId)
      .eq("business_email", user.email)
      .eq("status", "pending")
      .eq("meta_campaign_id", metaCampaignId)
      .select("id")
      .maybeSingle();

    if (clearError || !cleared?.id) {
      console.error("[business/ad-ideas/cleanup-partial] Meta removed but DB state update not confirmed", clearError);
      return NextResponse.json({
        success: false, error: "META_CLEANUP_STATE_UNCONFIRMED",
        message: "Meta confirmed deletion, but Nettmark could not confirm its saved state. Do not retry; contact support.",
      }, { status: 409 });
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

/// app/api/meta/callback/upload-video/route.ts
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.",
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { Resend } from "resend";
import {
  assertAdIdeaLaunchApproved,
  assertOfferTrackingReady,
  type QueryClient,
} from "@/../utils/approvals/enforcement";
import { buildTrackingUrl } from "@/../utils/tracking/buildTrackingUrl";
import { requireBusinessCampaignLaunchEntitlement, isSubscriptionRequiredError, buildSubscriptionRequiredResponse } from "@/../utils/businessSubscriptionGate";
import { trackBusinessSubscriptionAnalytics } from "@/../utils/businessSubscriptionAnalytics";
import { markLaunchFundCampaignWentLive } from "@/../utils/launchFund";
import { assertBusinessPaymentReadyForCommission } from "@/../utils/businessPaymentReadiness";
import { resolveOfferPaidReadiness } from "@/../utils/offerReadiness";
import {
  getAffiliateCampaignFundingReadiness,
  getExistingPaidCampaignLaunch,
  validatePaidCampaignTiming,
} from "@/../utils/paidCampaignLaunchReadiness";
import { enqueueAffiliateWebhookEvent } from "@/../utils/affiliateAssistantWebhook";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Needs elevated RLS access
);

async function safeParse(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { _raw: text };
  }
}

// Prefer-first helper to resolve from payload, then DB, then default
const prefer = <T>(...vals: Array<T | null | undefined>) =>
  vals.find((v) => v !== undefined && v !== null) as T | undefined;

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

async function sendEmailSafe(args: {
  to: string;
  subject: string;
  html: string;
}) {
  try {
    if (!resend) {
      console.warn("[email] RESEND_API_KEY missing – skipping email");
      return;
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || "no-reply@nettmark.com";
    const fromName = process.env.RESEND_FROM_NAME || "Nettmark";

    await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: args.to,
      subject: args.subject,
      html: args.html,
    });

    console.log("[email] sent", { to: args.to, subject: args.subject });
  } catch (e: any) {
    console.warn("[email] send failed", e?.message || e);
  }
}

function metaFailureMessage(payload: any, fallback: string) {
  return (
    payload?.error?.error_user_msg ||
    payload?.error?.message ||
    payload?.message ||
    fallback
  );
}

async function cleanupPartialMetaCampaign(params: {
  campaignId: string;
  accessToken: string;
  adIdeaId: string;
}) {
  const { campaignId, accessToken, adIdeaId } = params;
  try {
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${campaignId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    const payload = await safeParse(response);
    const cleaned = response.ok && payload?.success !== false;

    if (!cleaned) {
      console.error("[meta-cleanup] campaign cleanup failed", {
        campaignId,
        status: response.status,
        payload,
      });
      return false;
    }

    const { error: clearError } = await supabase
      .from("ad_ideas")
      .update({ meta_campaign_id: null, meta_status: null })
      .eq("id", adIdeaId)
      .eq("meta_campaign_id", campaignId);

    if (clearError) {
      console.error("[meta-cleanup] failed clearing stored campaign id", clearError);
      return false;
    }

    console.log("[meta-cleanup] removed partial campaign", campaignId);
    return true;
  } catch (error) {
    console.error("[meta-cleanup] unexpected cleanup error", error);
    return false;
  }
}

export async function POST(req: Request) {
  let liveAdRow: any = null;
  let createdCampaignId: string | null = null;
  let cleanupAccessToken: string | null = null;
  let cleanupAdIdeaId: string | null = null;

  try {
    const body = await req.json();
    console.log("[meta-upload] request body", body);

    const { adIdeaId, offerId, ...rest } = body;
    cleanupAdIdeaId = String(adIdeaId || "").trim() || null;

    // Fetch the ad_ideas row (we'll use it as fallback for dynamic fields)
    const { data: adIdea, error: adIdeaError } = await supabase
      .from("ad_ideas")
      .select("*")
      .eq("id", adIdeaId)
      .maybeSingle();

    if (adIdeaError) {
      console.warn("[⚠️ ad_ideas lookup warning]", adIdeaError.message);
    }

    const userSupabase = createRouteHandlerClient({ cookies });
    const { data: authData, error: authError } = await userSupabase.auth.getUser();
    const launchUser = authData?.user || null;
    if (authError || !launchUser?.email) {
      return NextResponse.json(
        { success: false, error: "UNAUTHENTICATED", message: "Sign in as the business before launching this campaign." },
        { status: 401 },
      );
    }
    if (!adIdea || String((adIdea as any).business_email || "").trim().toLowerCase() !== launchUser.email.trim().toLowerCase()) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Only the offer business can launch this campaign." },
        { status: 403 },
      );
    }

    const fallback_image_url = (adIdea as any)?.thumbnail_url || rest.thumbnail_url;
    let image_hash: string | null = null;

    const affiliateEmail =
      (body as any)?.affiliate_email ?? (adIdea as any)?.affiliate_email ?? null;

    if (!adIdeaId || !offerId || !affiliateEmail) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required approval context for Meta launch",
        },
        { status: 400 },
      );
    }

    const existingLive = await getExistingPaidCampaignLaunch({
      supabase,
      adIdeaId,
    });
    if (existingLive?.id) {
      return NextResponse.json({
        success: true,
        alreadyLive: true,
        campaignId: existingLive.meta_campaign_id || (adIdea as any)?.meta_campaign_id || null,
        liveAdId: existingLive.id,
        metaAdId: existingLive.meta_ad_id || null,
      });
    }

    if ((adIdea as any)?.meta_campaign_id) {
      return NextResponse.json(
        {
          success: false,
          error: "CAMPAIGN_PARTIAL_META_STATE",
          message: "A previous launch created a Meta campaign but did not complete. Automatic retry is blocked to prevent duplication.",
          metaCampaignId: (adIdea as any).meta_campaign_id,
        },
        { status: 409 },
      );
    }

    const timingReady = validatePaidCampaignTiming(adIdea as any);
    if (!timingReady.ok) {
      return NextResponse.json(
        { success: false, error: timingReady.error, message: timingReady.message, reason: timingReady.reason },
        { status: 409 },
      );
    }

    const fundingReady = await getAffiliateCampaignFundingReadiness({
      supabase,
      affiliateEmail,
      offerId,
      adIdea: adIdea as any,
    });
    if (!fundingReady.ready) {
      return NextResponse.json(
        {
          success: false,
          error: "AFFILIATE_CAMPAIGN_FUNDING_REQUIRED",
          message: `Affiliate campaign funding is short by ${fundingReady.deficit.toFixed(2)}.`,
          funding: { requiredAmount: fundingReady.requiredAmount, deficit: fundingReady.deficit },
        },
        { status: 409 },
      );
    }

    const launchApproval = await assertAdIdeaLaunchApproved(supabase as any, {
      adIdeaId,
      offerId,
      affiliateEmail,
    });

    if (!launchApproval.ok) {
      return NextResponse.json(
        {
          success: false,
          error: launchApproval.error,
          message: launchApproval.message,
        },
        { status: launchApproval.status },
      );
    }

    // 1. Fetch the offer from Supabase (offer is source of truth for Meta IDs)
    const { data: offer, error: offerError } = await supabase
      .from("offers")
      .select(
        "business_email, website, meta_pixel_id, meta_page_id, meta_ad_account_id, title",
      )
      .eq("id", offerId)
      .single();

    if (offerError || !offer) {
      console.error(
        "[❌ Offer Lookup Error]",
        offerError?.message || "No offer found",
      );
      return NextResponse.json(
        { success: false, error: "Offer lookup failed" },
        { status: 400 },
      );
    }

    const gate = await requireBusinessCampaignLaunchEntitlement({
      supabase: supabase as never,
      businessEmail: (offer as any).business_email,
      returnTo: "/business/my-business/ad-ideas",
      intendedAction: "launch_paid_meta_ad",
      campaignId: adIdeaId,
      submissionId: adIdeaId,
      attribution: {
        source: "meta_upload_route",
        offerId,
        affiliateEmail,
        campaignType: "paid_meta",
      },
    });
    if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });

    const trackingReady = await assertOfferTrackingReady(
      supabase as unknown as QueryClient,
      offerId,
    );
    if (!trackingReady.ok) {
      return NextResponse.json(
        {
          success: false,
          error: trackingReady.error,
          message: trackingReady.message,
        },
        { status: trackingReady.status },
      );
    }

    const businessEmail = (offer as any).business_email;
    const paymentReady = await assertBusinessPaymentReadyForCommission({
      supabase: supabase as never,
      businessEmail,
    });
    if (!paymentReady.ok) {
      return NextResponse.json(
        {
          success: false,
          error: paymentReady.error,
          message: paymentReady.message,
          reason: paymentReady.reason,
        },
        { status: paymentReady.status },
      );
    }

    const offerWebsite = (offer as any)?.website || null;
    const paidReadiness = await resolveOfferPaidReadiness({
      supabase: supabase as never,
      offerId,
    });
    const offerPixelId = paidReadiness.resolvedMeta.pixelId || null;

    console.log("[meta-upload] business_email", businessEmail);
    console.log("[meta-upload] offer_website", offerWebsite);
    console.log("[meta-upload] resolved_meta_pixel_id", offerPixelId);

    const selectedPageId = paidReadiness.resolvedMeta.pageId;
    const selectedAdAccountId = paidReadiness.resolvedMeta.adAccountId;

    if (!selectedPageId || !selectedAdAccountId) {
      console.error("[❌ Offer missing Meta selections]", {
        selectedPageId,
        selectedAdAccountId,
        reason: paidReadiness.metaReason,
        counts: paidReadiness.counts,
      });
      return NextResponse.json(
        {
          success: false,
          error:
            paidReadiness.metaReason === "needs_offer_selection"
              ? "Meta is connected, but this offer needs a selected Page and Ad Account before launching paid ads."
              : "This offer is organic-only right now. Attach a Meta Page and Ad Account on the offer before launching paid ads.",
        },
        { status: 400 },
      );
    }

    console.log("[✅ Resolved Meta IDs]", {
      meta_page_id: selectedPageId,
      meta_ad_account_id: selectedAdAccountId,
      meta_pixel_id: offerPixelId,
      source: paidReadiness.metaSource,
    });

    // 2. Lookup the access token for the exact Page + Ad Account selected on this offer.
    let { data: connection, error: connectionError } = await supabase
      .from("meta_connections")
      .select("access_token, created_at")
      .eq("business_email", businessEmail)
      .eq("page_id", selectedPageId)
      .eq("ad_account_id", selectedAdAccountId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (connectionError || !connection) {
      console.error(
        "[❌ Meta Connection Lookup Error]",
        connectionError?.message || "No connection found",
      );
      return NextResponse.json(
        { success: false, error: "Meta connection lookup failed" },
        { status: 400 },
      );
    }

    const { access_token } = connection as any;
    cleanupAccessToken = access_token || null;

    if (!access_token) {
      console.error("[❌ Missing Access Token]");
      return NextResponse.json(
        { success: false, error: "No Meta access token found" },
        { status: 400 },
      );
    }

    // Map user-friendly objective to Meta-compatible enum
    const objectiveMap: Record<string, string> = {
      Traffic: "OUTCOME_TRAFFIC",
      Leads: "OUTCOME_LEADS",
      Sales: "OUTCOME_SALES",
      Engagement: "OUTCOME_ENGAGEMENT",
      Awareness: "OUTCOME_AWARENESS",
      "Video Views": "VIDEO_VIEWS",
      Conversions: "CONVERSIONS",
      "App Installs": "APP_INSTALLS",
    };

    // Accept Meta enums coming from the UI/DB (e.g. OUTCOME_SALES) as-is.
    const normalizeObjective = (obj: any): string => {
      const o = String(obj ?? "").trim();
      if (!o) return "OUTCOME_TRAFFIC";
      if (o.startsWith("OUTCOME_")) return o;
      if (["CONVERSIONS", "VIDEO_VIEWS", "APP_INSTALLS"].includes(o)) return o;
      return objectiveMap[o] || "OUTCOME_TRAFFIC";
    };

    const rawObjective = prefer(adIdea?.objective, rest.objective, "Traffic");
    const mappedObjective = normalizeObjective(rawObjective);
    const isSalesObjective = mappedObjective === "OUTCOME_SALES";

    // 3. Build payload for Meta API (keep misc fields)
    const payload = {
      ...(adIdea || {}),
      adIdeaId,
      offerId,
      metaAdAccountId: selectedAdAccountId,
      metaPageId: selectedPageId,
    };

    // ----- Dynamic field resolution (payload overrides DB; DB overrides defaults) -----
    const campaignName = prefer(
      adIdea?.campaign_name,
      body.campaign_name,
      "Affliya Campaign",
    );
    const adsetName = prefer(
      adIdea?.adset_name,
      body.adset_name,
      `${campaignName || "Affliya Campaign"} – Ad Set`,
    );
    const adName = prefer(
      adIdea?.ad_name,
      body.ad_name,
      `${campaignName || "Affliya Campaign"} – Ad`,
    );

    // Budget (Meta expects cents as integer strings)
    const budgetType = prefer(adIdea?.budget_type, body.budget_type, "DAILY"); // DAILY | LIFETIME
    const budgetAmountRaw = prefer(
      adIdea?.budget_amount,
      body.budget_amount,
      (adIdea as any)?.daily_budget,
      1000,
    );
    const budgetAmountStr = String(
      Math.max(100, parseInt(String(budgetAmountRaw ?? 1000), 10) || 1000),
    );

    // Timing
    const startTimeISO = prefer(adIdea?.start_time, body.start_time, null);
    const endTimeISO = prefer(adIdea?.end_time, body.end_time, null);

    // Creative fields
    const headline = prefer(adIdea?.headline, body.headline, "");
    const caption = prefer(adIdea?.caption, body.caption, "");
    const description = prefer(
      body.description,
      adIdea?.description,
      adIdea?.caption,
      "",
    );
    const ctaType = prefer(
      body.call_to_action,
      (body as any).cta,
      adIdea?.call_to_action,
      (adIdea as any)?.cta,
      "LEARN_MORE",
    );

    // 🔗 LINKS: unified tracking vs display logic
    const trackingLink =
      (adIdea as any)?.tracking_link || (body as any)?.tracking_link || null;

    const displayLink =
      offerWebsite || (body as any)?.display_link || trackingLink || null;

    const destinationLink =
      trackingLink || offerWebsite || displayLink || "https://nettmark.com";

    // Media
    const mediaType = String(
      prefer((body as any).media_type, adIdea?.media_type, "VIDEO") ||
        "VIDEO",
    ).toUpperCase();
    const fileUrl = prefer(
      (body as any).file_url,
      adIdea?.file_url,
      rest.file_url,
      (body as any).videoUrl,
    );
    const videoUrl =
      mediaType === "VIDEO"
        ? prefer(
            (body as any).videoUrl,
            fileUrl,
            adIdea?.file_url,
            rest.file_url,
          )
        : null;
    const thumbnailUrl = prefer(
      (body as any).thumbnail_url,
      adIdea?.thumbnail_url,
      null,
    );

    console.log("[Dynamic fields]", {
      campaignName,
      adsetName,
      adName,
      mappedObjective,
      budgetType,
      budgetAmountStr,
      startTimeISO,
      endTimeISO,
      ctaType,
      trackingLink,
      displayLink,
      destinationLink,
      mediaType,
      fileUrl,
      videoUrl,
    });

    console.log("[meta-upload] final payload", payload);

    // Resolve every affiliate-selected interest *before creating a Meta campaign.
    // Never silently drop free-text interests and broaden the funded audience.
    let flexible_spec: { interests: { id: string }[] }[] | undefined;
    const rawInterests = (payload as any).interests;
    let selectedInterests: unknown[] = [];
    try {
      const parsed = typeof rawInterests === "string"
        ? (rawInterests.trim() ? JSON.parse(rawInterests) : [])
        : rawInterests ?? [];
      if (!Array.isArray(parsed)) throw new Error("not an array");
      selectedInterests = parsed;
    } catch {
      return NextResponse.json({
        success: false,
        error: "META_INTERESTS_INVALID",
        stage: "targeting",
        message: "The affiliate's interest targeting could not be read. Ask the affiliate to review their selected interests before launching.",
      }, { status: 409 });
    }

    const resolvedInterests: { id: string }[] = [];
    for (const entry of selectedInterests) {
      const suppliedId = typeof entry === "object" && entry !== null
        ? String((entry as { id?: unknown }).id ?? "").trim()
        : String(entry ?? "").trim();
      if (!suppliedId) {
        return NextResponse.json({
          success: false, error: "META_INTERESTS_INVALID", stage: "targeting",
          message: "An empty interest was selected. Ask the affiliate to update their targeting.",
        }, { status: 409 });
      }
      if (/^\d+$/.test(suppliedId)) {
        resolvedInterests.push({ id: suppliedId });
        continue;
      }
      const interestResponse = await fetch(
        `https://graph.facebook.com/v19.0/search?type=adinterest&q=${encodeURIComponent(suppliedId)}&limit=100`,
        { headers: { Authorization: `Bearer ${access_token}` } },
      );
      const interestPayload = await safeParse(interestResponse);
      if (!interestResponse.ok || !Array.isArray(interestPayload?.data)) {
        return NextResponse.json({
          success: false, error: "META_INTEREST_LOOKUP_FAILED", stage: "targeting",
          message: `Meta couldn't validate the interest "${suppliedId}". Try again after checking the Meta connection.`,
        }, { status: 409 });
      }
      const match = interestPayload.data.find((candidate: { id?: string; name?: string }) =>
        String(candidate.name || "").trim().toLocaleLowerCase("en") === suppliedId.toLocaleLowerCase("en")
        && /^\d+$/.test(String(candidate.id || "")),
      );
      if (!match) {
        return NextResponse.json({
          success: false, error: "META_INTEREST_UNRESOLVED", stage: "targeting",
          message: `Meta does not recognise the exact interest "${suppliedId}". Ask the affiliate to choose a valid Meta interest before launching.`,
        }, { status: 409 });
      }
      resolvedInterests.push({ id: String(match.id) });
    }
    if (resolvedInterests.length) {
      flexible_spec = [{ interests: Array.from(new Map(resolvedInterests.map((item) => [item.id, item])).values()) }];
    }


    // 5. Create campaign
    const cleanAdAccountId = String(selectedAdAccountId).startsWith("act_")
      ? String(selectedAdAccountId)
      : `act_${selectedAdAccountId}`;

    console.log("[meta-upload] clean_ad_account_id", cleanAdAccountId);

    const createCampaignRes = await fetch(
      `https://graph.facebook.com/v19.0/${cleanAdAccountId}/campaigns`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: campaignName || "Affliya Campaign",
          objective: mappedObjective,
          // Keep the parent campaign paused until every child object and the
          // local live_ads row are durable. This prevents untracked spend if a
          // downstream Meta or database step fails.
          status: "PAUSED",
          special_ad_categories: [payload.special_ad_category || "NONE"],
          // Required by current Meta Marketing API when budget lives on the ad set.
          // Keep sharing disabled so the affiliate's configured ad-set budget remains explicit.
          is_adset_budget_sharing_enabled: false,
        }),
      },
    );
    console.log("[HTTP] campaign", createCampaignRes.status);
    const campaignData = await safeParse(createCampaignRes);
    if (!campaignData?.id) {
      console.error("[❌ Campaign Creation Failed]", campaignData);
      return NextResponse.json(
        {
          success: false,
          error: "Campaign creation failed",
          message:
            campaignData?.error?.error_user_msg ||
            campaignData?.error?.message ||
            "Meta rejected campaign creation.",
          meta: campaignData,
        },
        { status: 400 },
      );
    }

    console.log("[✅ Campaign Created]", campaignData);
    createdCampaignId = String(campaignData.id);

    // Update ad_ideas with the new Meta campaign ID
    const updateRes = await supabase
      .from("ad_ideas")
      .update({ meta_campaign_id: campaignData.id })
      .eq("id", adIdeaId);

    if (updateRes.error) {
      console.error(
        "[❌ Failed to Update Campaign ID in Supabase]",
        updateRes.error.message,
      );
      const cleanupSucceeded = await cleanupPartialMetaCampaign({
        campaignId: String(campaignData.id),
        accessToken: access_token,
        adIdeaId,
      });
      return NextResponse.json(
        {
          success: false,
          error: "CAMPAIGN_STATE_PERSIST_FAILED",
          message: "Meta created the campaign, but Nettmark could not safely persist its ID. The partial campaign was cleaned up where possible.",
          cleanupSucceeded,
        },
        { status: 500 },
      );
    }
    console.log("[✅ Campaign ID Updated in Supabase]", updateRes.data);

    // --- Build Ad Set targeting ---
    const countryMap: Record<string, string> = {
      Australia: "AU",
      "United States": "US",
      Canada: "CA",
      "United Kingdom": "GB",
      Germany: "DE",
      France: "FR",
      India: "IN",
    };
    const countries = (() => {
      const src = (
        payload.location ??
        (adIdea as any)?.location ??
        "AU"
      ).toString();
      return src
        .split(/[\s,]+/)
        .map((s: string) => s.trim())
        .filter(Boolean)
        .map((s: string) =>
          s.length === 2 ? s.toUpperCase() : countryMap[s] || s.toUpperCase(),
        );
    })();

    const rawPlacements: string[] = Array.isArray(
      (payload as any).manual_placements,
    )
      ? (payload as any).manual_placements
      : [];
    const mapFB: Record<string, string> = {
      facebook_feed: "feed",
      facebook_stories: "story",
      facebook_reels: "reels",
    };
    const mapIG: Record<string, string> = {
      instagram_feed: "stream",
      instagram_stories: "story",
      instagram_reels: "reels",
    };
    const facebook_positions = rawPlacements
      .filter((p) => p in mapFB)
      .map((p) => mapFB[p]);
    const instagram_positions = rawPlacements
      .filter((p) => p in mapIG)
      .map((p) => mapIG[p]);
    const publisher_platforms: string[] = [];
    if (facebook_positions.length) publisher_platforms.push("facebook");
    if (instagram_positions.length) publisher_platforms.push("instagram");

    // ---- Optimisation & bidding (from ad_ideas) ----
    const optimisationGoal =
      isSalesObjective || adIdea?.performance_goal === "OFFSITE_CONVERSIONS"
        ? "OFFSITE_CONVERSIONS"
        : "REACH";

    // --- PATCH: Bid Cap Logic ---
    const isBidCap =
      (payload as any)?.bid_strategy === "BID_CAP" ||
      adIdea?.bid_strategy === "BID_CAP";

    const rawBidCap = (payload as any)?.bid_cap ?? adIdea?.bid_cap ?? null;

    const toMinorUnits = (
      v: any,
    ): {
      minor: string | null;
      inferred: "major" | "minor" | "none" | "invalid";
    } => {
      if (v === null || v === undefined || v === "")
        return { minor: null, inferred: "none" };

      const str = typeof v === "string" ? v.trim() : null;
      const num = Number(str ?? v);
      if (!Number.isFinite(num)) return { minor: null, inferred: "invalid" };

      const isInt = Number.isInteger(num);
      if (isInt && num >= 100 && num <= 5000) {
        return { minor: String(Math.round(num)), inferred: "minor" };
      }

      return { minor: String(Math.round(num * 100)), inferred: "major" };
    };

    const bidCapInfo = isBidCap
      ? toMinorUnits(rawBidCap)
      : { minor: null, inferred: "none" as const };
    const bidAmount = isBidCap ? bidCapInfo.minor : null;

    if (isBidCap) {
      console.log("[🎯 Bid Cap]", {
        rawBidCap,
        inferredUnit: bidCapInfo.inferred,
        bid_amount_minor_units: bidAmount,
      });
    }

    if (isBidCap && !bidAmount) {
      console.error("[❌ BID_CAP selected but no bid amount provided]");
      return NextResponse.json(
        {
          success: false,
          error: "Bid cap selected but no bid amount provided",
        },
        { status: 400 },
      );
    }

    const metaBidStrategy = isBidCap
      ? "LOWEST_COST_WITH_BID_CAP"
      : "LOWEST_COST_WITHOUT_CAP";

    const advantageAudienceRaw =
      (payload as any)?.advantage_audience ??
      (adIdea as any)?.advantage_audience ??
      0;
    const advantageAudienceFlag =
      advantageAudienceRaw === true ||
      advantageAudienceRaw === "1" ||
      advantageAudienceRaw === 1 ||
      advantageAudienceRaw === "enable";

    const requestedAgeMin = parseInt(
      (payload as any).age_range?.[0] ||
        (adIdea as any)?.age_range?.[0] ||
        "18",
      10,
    );
    const requestedAgeMax = parseInt(
      (payload as any).age_range?.[1] ||
        (adIdea as any)?.age_range?.[1] ||
        "65",
      10,
    );

    // Meta requires max age 65+ when Advantage+ Audience is enabled.
    // Preserve the affiliate's explicit age range rather than silently widening it.
    const useAdvantageAudience =
      advantageAudienceFlag && requestedAgeMax >= 65;

    if (advantageAudienceFlag && !useAdvantageAudience) {
      console.log("[meta-upload] Advantage Audience disabled to preserve explicit age controls", {
        requestedAgeMin,
        requestedAgeMax,
      });
    }

    const targetingPayload = {
      geo_locations: { countries },
      age_min: requestedAgeMin,
      age_max: requestedAgeMax,
      genders:
        (payload as any).gender === "Male"
          ? [1]
          : (payload as any).gender === "Female"
            ? [2]
            : (adIdea as any)?.gender === "Male"
              ? [1]
              : (adIdea as any)?.gender === "Female"
                ? [2]
                : [1, 2],
      ...(publisher_platforms.length ? { publisher_platforms } : {}),
      ...(facebook_positions.length ? { facebook_positions } : {}),
      ...(instagram_positions.length ? { instagram_positions } : {}),
      ...(flexible_spec ? { flexible_spec } : {}),
      targeting_automation: {
        advantage_audience: useAdvantageAudience ? 1 : 0,
      },
    };

    const adsetParams: Record<string, string> = {
      name: adsetName || `Ad Set – ${campaignData.id}`,
      campaign_id: campaignData.id,
      billing_event: "IMPRESSIONS",
      optimization_goal: optimisationGoal,
      bid_strategy: metaBidStrategy,
      ...(bidAmount ? { bid_amount: bidAmount } : {}),
      targeting: JSON.stringify(targetingPayload),
      pacing_type: JSON.stringify(["standard"]),
      status: "ACTIVE",
    };

    // 🔥 REQUIRED: promoted_object when optimising for OFFSITE_CONVERSIONS (includes Sales)
    const resolvedPixelId = prefer(offerPixelId, null);
    if (optimisationGoal === "OFFSITE_CONVERSIONS") {
      if (!resolvedPixelId) {
        console.error("[❌ OFFSITE_CONVERSIONS blocked: no pixel_id on offer]");
        return NextResponse.json(
          {
            success: false,
            error:
              "Sales/Conversion campaigns require a Meta Pixel selected on the Offer.",
          },
          { status: 400 },
        );
      }

      adsetParams.promoted_object = JSON.stringify({
        pixel_id: resolvedPixelId,
        custom_event_type: "PURCHASE",
      });
    }

    if (budgetType === "LIFETIME") {
      adsetParams.lifetime_budget = budgetAmountStr;
      adsetParams.start_time =
        startTimeISO || new Date(Date.now() + 60000).toISOString();
      adsetParams.end_time =
        endTimeISO || new Date(Date.now() + 7 * 86400000).toISOString();
    } else {
      adsetParams.daily_budget = budgetAmountStr;
      adsetParams.start_time =
        startTimeISO || new Date(Date.now() + 60000).toISOString();
      adsetParams.end_time =
        endTimeISO || new Date(Date.now() + 7 * 86400000).toISOString();
    }

    console.log("[meta-upload] adset params", adsetParams);

    const validationParams = new URLSearchParams(adsetParams);
    validationParams.set("execution_options", JSON.stringify(["validate_only"]));
    const adSetValidation = await fetch(
      `https://graph.facebook.com/v19.0/${cleanAdAccountId}/adsets`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: validationParams,
      },
    ).then((res) => safeParse(res));

    if (!adSetValidation?.success) {
      console.error("[❌ Ad Set Validation Failed]", adSetValidation);
      const cleanupSucceeded = await cleanupPartialMetaCampaign({
        campaignId: String(campaignData.id),
        accessToken: access_token,
        adIdeaId,
      });
      return NextResponse.json(
        {
          success: false,
          error: "AD_SET_VALIDATION_FAILED",
          stage: "ad_set_validation",
          message: metaFailureMessage(adSetValidation, "Meta rejected the ad set configuration."),
          meta: adSetValidation,
          cleanupSucceeded,
        },
        { status: 400 },
      );
    }

    const adSetRes = await fetch(
      `https://graph.facebook.com/v19.0/${cleanAdAccountId}/adsets`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(adsetParams),
      },
    ).then((res) => safeParse(res));
    console.log("[HTTP] adset", adSetRes?.id ? 200 : 400);

    if (!adSetRes?.id) {
      console.error("[❌ Ad Set Creation Failed]", adSetRes);
      const cleanupSucceeded = await cleanupPartialMetaCampaign({
        campaignId: String(campaignData.id),
        accessToken: access_token,
        adIdeaId,
      });
      return NextResponse.json(
        {
          success: false,
          error: "AD_SET_CREATION_FAILED",
          stage: "ad_set",
          message: metaFailureMessage(adSetRes, "Meta rejected ad set creation."),
          meta: adSetRes,
          cleanupSucceeded,
        },
        { status: 400 },
      );
    } else {
      console.log("[✅ Ad Set Created]", adSetRes);

      let creativePayload: any;

      if (mediaType === "IMAGE") {
        if (!fileUrl) {
          return NextResponse.json(
            {
              success: false,
              error: "Image creative is missing a file URL",
            },
            { status: 400 },
          );
        }

        const imageUploadRes = await fetch(
          `https://graph.facebook.com/v19.0/${cleanAdAccountId}/adimages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${access_token}`,
            },
            body: new URLSearchParams({
              url: fileUrl,
            }),
          },
        ).then((res) => safeParse(res));
        console.log(
          "[HTTP] image",
          (imageUploadRes as any)?.images ? 200 : 400,
        );

        const uploadedImages = (imageUploadRes as any)?.images || {};
        image_hash = Object.values(uploadedImages)[0]
          ? ((Object.values(uploadedImages)[0] as any).hash ?? null)
          : null;

        if (!image_hash) {
          console.error("[❌ Image Upload to Meta Failed]", imageUploadRes);
          const cleanupSucceeded = await cleanupPartialMetaCampaign({
            campaignId: String(campaignData.id),
            accessToken: access_token,
            adIdeaId,
          });
          return NextResponse.json(
            {
              success: false,
              error: "IMAGE_UPLOAD_FAILED",
              stage: "image_upload",
              message: metaFailureMessage(imageUploadRes, "Meta rejected the image upload."),
              meta: imageUploadRes,
              cleanupSucceeded,
            },
            { status: 400 },
          );
        }

        console.log("[✅ Image Uploaded to Meta]", image_hash);

        creativePayload = {
          name: adName || `Creative – ${campaignData.id}`,
          object_story_spec: {
            page_id: selectedPageId,
            link_data: {
              link: destinationLink,
              message: caption || "",
              name: headline || undefined,
              description: description || undefined,
              call_to_action: {
                type: ctaType || "LEARN_MORE",
                value: {
                  link: destinationLink,
                },
              },
              image_hash,
            },
          },
        };
      } else {
        if (!videoUrl) {
          return NextResponse.json(
            {
              success: false,
              error: "Video creative is missing a video URL",
            },
            { status: 400 },
          );
        }

        const videoUploadRes = await fetch(
          `https://graph.facebook.com/v19.0/${cleanAdAccountId}/advideos`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${access_token}`,
            },
            body: new URLSearchParams({
              file_url: videoUrl,
              name: adName || "Affliya Video",
              description: caption || "",
            }),
          },
        ).then((res) => safeParse(res));
        console.log("[HTTP] video", videoUploadRes?.id ? 200 : 400);

        if (!videoUploadRes?.id) {
          console.error("[❌ Video Upload to Meta Failed]", videoUploadRes);
          const cleanupSucceeded = await cleanupPartialMetaCampaign({
            campaignId: String(campaignData.id),
            accessToken: access_token,
            adIdeaId,
          });
          return NextResponse.json(
            {
              success: false,
              error: "VIDEO_UPLOAD_FAILED",
              stage: "video_upload",
              message: metaFailureMessage(videoUploadRes, "Meta rejected the video upload."),
              meta: videoUploadRes,
              cleanupSucceeded,
            },
            { status: 400 },
          );
        }

        const video_id = videoUploadRes.id;
        console.log("[✅ Video Uploaded to Meta]", video_id);

        creativePayload = {
          name: adName || `Creative – ${campaignData.id}`,
          object_story_spec: {
            page_id: selectedPageId,
            video_data: {
              video_id,
              title: headline || undefined,
              message: caption || "",
              link_description: description || undefined,
              call_to_action: {
                type: ctaType || "LEARN_MORE",
                value: {
                  link: destinationLink,
                },
              },
              ...(image_hash
                ? { image_hash }
                : fallback_image_url || thumbnailUrl
                  ? { image_url: fallback_image_url || thumbnailUrl }
                  : {}),
            },
          },
        };
      }

      // --- Create Ad Creative ---
      const creativeRes = await fetch(
        `https://graph.facebook.com/v19.0/${cleanAdAccountId}/adcreatives`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(creativePayload),
        },
      ).then((res) => safeParse(res));
      console.log("[HTTP] creative", creativeRes?.id ? 200 : 400);

      if (!creativeRes?.id) {
        console.error("[❌ Ad Creative Creation Failed]", creativeRes);
        const cleanupSucceeded = await cleanupPartialMetaCampaign({
          campaignId: String(campaignData.id),
          accessToken: access_token,
          adIdeaId,
        });
        return NextResponse.json(
          {
            success: false,
            error: "AD_CREATIVE_CREATION_FAILED",
            stage: "creative",
            message: metaFailureMessage(creativeRes, "Meta rejected ad creative creation."),
            meta: creativeRes,
            cleanupSucceeded,
          },
          { status: 400 },
        );
      } else {
        console.log("[✅ Ad Creative Created]", creativeRes);

        // --- Create Ad ---
        const adRes = await fetch(
          `https://graph.facebook.com/v19.0/${cleanAdAccountId}/ads`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: adName || `Ad – ${campaignData.id}`,
              adset_id: adSetRes.id,
              creative: { creative_id: creativeRes.id },
              status: "ACTIVE",
              start_time: new Date(Date.now() + 60000).toISOString(),
            }),
          },
        ).then((res) => safeParse(res));
        console.log("[HTTP] ad", adRes?.id ? 200 : 400);

        if (!adRes?.id) {
          console.error("[❌ Ad Creation Failed]", adRes);
          const cleanupSucceeded = await cleanupPartialMetaCampaign({
            campaignId: String(campaignData.id),
            accessToken: access_token,
            adIdeaId,
          });
          return NextResponse.json(
            {
              success: false,
              error: "AD_CREATION_FAILED",
              stage: "ad",
              message: metaFailureMessage(adRes, "Meta rejected ad creation."),
              meta: adRes,
              cleanupSucceeded,
            },
            { status: 400 },
          );
        } else {
          console.log("[✅ Ad Created]", adRes);

          const liveAdsPayload = {
            ad_idea_id: adIdeaId,
            offer_id: prefer(offerId, adIdea?.offer_id, null),
            meta_campaign_id: campaignData.id,
            campaign_id: randomUUID(),
            meta_ad_id: adRes.id,
            ad_set_id: adSetRes.id,
            creative_id: creativeRes.id,
            affiliate_email: affiliateEmail,
            business_email: businessEmail,
            status: "paused",
            spend: 0,
            clicks: 0,
            conversions: 0,
            tracking_link: trackingLink || destinationLink || null,
            campaign_type: "paid_meta",
            caption: caption || "",
            created_from: "meta_api",
            created_at: new Date().toISOString(),
          };

          console.log("[live_ads INSERT PAYLOAD]", liveAdsPayload);

          const { data: insertedLiveAdRow, error: liveAdErr } = await supabase
            .from("live_ads")
            .insert(liveAdsPayload)
            .select("id")
            .single();

          if (liveAdErr) {
            console.error("[❌ live_ads insert error]", liveAdErr);
            const cleanupSucceeded = await cleanupPartialMetaCampaign({
              campaignId: String(campaignData.id),
              accessToken: access_token,
              adIdeaId,
            });
            if (isSubscriptionRequiredError(liveAdErr)) {
              return NextResponse.json(
                {
                  ...buildSubscriptionRequiredResponse({
                    entitlement: null,
                    returnTo: "/business/my-business/ad-ideas",
                    intendedAction: "launch_paid_meta_ad",
                    campaignId: adIdeaId,
                    submissionId: adIdeaId,
                    attribution: { source: "meta_upload_db_backstop" },
                  }),
                  cleanupSucceeded,
                },
                { status: 402 },
              );
            }
            return NextResponse.json(
              {
                success: false,
                error: "LIVE_AD_PERSIST_FAILED",
                stage: "database",
                message: "Meta objects were created, but Nettmark could not safely save the live campaign. The Meta campaign was cleaned up where possible.",
                cleanupSucceeded,
              },
              { status: 500 },
            );
          } else if (insertedLiveAdRow?.id) {
            console.log("[live_ads] insert success", insertedLiveAdRow);

            const canonicalTrackingLink = buildTrackingUrl({
              campaignId: insertedLiveAdRow.id,
              affiliateId: affiliateEmail,
            });

            const { error: updateErr } = await supabase
              .from("live_ads")
              .update({
                campaign_id: insertedLiveAdRow.id,
                tracking_link: canonicalTrackingLink,
              })
              .eq("id", insertedLiveAdRow.id);

            if (updateErr) {
              console.error("[live_ads] campaign_id sync failed", updateErr);
            } else {
              console.log(
                "[live_ads] campaign_id synced",
                insertedLiveAdRow.id,
              );
            }

            const activateCampaignResponse = await fetch(
              `https://graph.facebook.com/v19.0/${campaignData.id}`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${access_token}`,
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({ status: "ACTIVE" }),
              },
            );
            const activateCampaignPayload = await safeParse(activateCampaignResponse);

            if (
              !activateCampaignResponse.ok ||
              activateCampaignPayload?.success === false
            ) {
              console.error("[❌ Campaign Activation Failed]", activateCampaignPayload);
              await supabase.from("live_ads").delete().eq("id", insertedLiveAdRow.id);
              const cleanupSucceeded = await cleanupPartialMetaCampaign({
                campaignId: String(campaignData.id),
                accessToken: access_token,
                adIdeaId,
              });
              return NextResponse.json(
                {
                  success: false,
                  error: "CAMPAIGN_ACTIVATION_FAILED",
                  stage: "activation",
                  message: metaFailureMessage(
                    activateCampaignPayload,
                    "Meta created the campaign but could not activate it.",
                  ),
                  meta: activateCampaignPayload,
                  cleanupSucceeded,
                },
                { status: 409 },
              );
            }

            const { error: activateLocalError } = await supabase
              .from("live_ads")
              .update({ status: "active" })
              .eq("id", insertedLiveAdRow.id);

            if (activateLocalError) {
              console.error("[live_ads] failed to mark campaign active", activateLocalError);
            }

            liveAdRow = insertedLiveAdRow;

            await enqueueAffiliateWebhookEvent({
              supabase,
              eventType: "proposal.approved",
              businessEmail,
              offerId: String(prefer(offerId, adIdea?.offer_id, "") || "") || null,
              affiliateEmail,
              entityId: adIdeaId,
              data: {
                proposal_id: adIdeaId,
                offer_id: prefer(offerId, adIdea?.offer_id, null),
                live_ad_id: insertedLiveAdRow.id,
                meta_campaign_id: campaignData.id,
              },
              dedupeKey: `proposal.approved:${adIdeaId}`,
            });

            if (affiliateEmail && prefer(offerId, adIdea?.offer_id, null)) {
              await markLaunchFundCampaignWentLive({
                supabase: supabase as never,
                affiliateEmail,
                offerId: String(prefer(offerId, adIdea?.offer_id, null)),
                liveAdId: insertedLiveAdRow.id,
              }).catch((err) => console.warn("[launch fund campaign_went_live tracking failed]", err));
            }

            if (gate.entitlement?.hasActiveSubscription && !gate.entitlement.isGrandfathered) {
              await trackBusinessSubscriptionAnalytics({
                supabase: supabase as never,
                eventType: "campaign_approved_after_subscription",
                businessId: gate.entitlement.businessId,
                businessEmail: (offer as any).business_email,
                campaignId: insertedLiveAdRow.id,
                intendedAction: "launch_paid_meta_ad",
                submissionId: adIdeaId,
                returnTo: "/business/my-business/ad-ideas",
                attribution: {
                  source: "meta_upload_route",
                  offerId,
                  affiliateEmail,
                  metaCampaignId: campaignData.id,
                  metaAdId: adRes.id,
                },
              });
            }

            const offerTitle = (offer as any)?.title || "your offer";
            if (affiliateEmail) {
              await sendEmailSafe({
                to: affiliateEmail,
                subject: `Your Facebook ad is live for ${offerTitle}`,
                html: `
                  <div style="font-family:Arial,sans-serif;line-height:1.5">
                    <h2 style="margin:0 0 12px">Ad approved ✅</h2>
                    <p>Your Facebook ad has been approved and launched for <strong>${offerTitle}</strong>.</p>
                    <p style="margin:12px 0">Tracking link:</p>
                    <p><a href="${trackingLink || destinationLink || "https://nettmark.com"}">${trackingLink || destinationLink || "https://nettmark.com"}</a></p>
                    <p style="margin-top:18px;color:#666;font-size:12px">Nettmark</p>
                  </div>
                `,
              });
            } else {
              console.warn(
                "[email] affiliate_email missing – cannot notify affiliate",
              );
            }

            const adminEmail = process.env.ADMIN_NOTIFY_EMAIL;
            if (adminEmail) {
              await sendEmailSafe({
                to: adminEmail,
                subject: `Nettmark: Ad launched (${offerTitle})`,
                html: `
                  <div style="font-family:Arial,sans-serif;line-height:1.5">
                    <h2 style="margin:0 0 12px">Ad launched</h2>
                    <p><strong>Offer:</strong> ${offerTitle}</p>
                    <p><strong>Business:</strong> ${businessEmail}</p>
                    <p><strong>Affiliate:</strong> ${affiliateEmail || "unknown"}</p>
                    <p><strong>Live Ad ID:</strong> ${insertedLiveAdRow.id}</p>
                    <p><strong>Meta Campaign ID:</strong> ${campaignData.id}</p>
                    <p><strong>Meta Ad ID:</strong> ${(liveAdsPayload as any)?.meta_ad_id || "unknown"}</p>
                  </div>
                `,
              });
            }
          }
        }
      }
    }

    if (!liveAdRow?.id) {
      const cleanupSucceeded = await cleanupPartialMetaCampaign({
        campaignId: String(campaignData.id),
        accessToken: access_token,
        adIdeaId,
      });
      return NextResponse.json(
        {
          success: false,
          error: "PARTIAL_META_LAUNCH",
          message: cleanupSucceeded
            ? "Meta did not fully create the campaign. The partial campaign was cleaned up and this proposal can be retried safely."
            : "Meta did not fully create the campaign and automatic cleanup failed. Retry remains blocked to prevent duplication.",
          metaCampaignId: cleanupSucceeded ? null : campaignData.id,
          cleanupSucceeded,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      campaignId: campaignData.id,
      liveAdId: liveAdRow.id,
    });
  } catch (err: any) {
    console.error("[❌ Upload API Error]", err.message);

    let cleanupSucceeded: boolean | null = null;
    if (
      createdCampaignId &&
      cleanupAccessToken &&
      cleanupAdIdeaId &&
      !liveAdRow?.id
    ) {
      cleanupSucceeded = await cleanupPartialMetaCampaign({
        campaignId: createdCampaignId,
        accessToken: cleanupAccessToken,
        adIdeaId: cleanupAdIdeaId,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: err.message,
        cleanupSucceeded,
      },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "../../../../../utils/businessSubscriptions";
import { validateCampaignIntent } from "../../../../../utils/meta/campaignConfiguration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One audited write path for new paid proposals. Clients cannot override
// business identity, workflow state, Meta IDs or financial data.
export async function POST(req: Request) {
  try {
    const client = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user?.email) {
      return NextResponse.json({ success: false, error: "UNAUTHENTICATED", message: "Sign in as an affiliate." }, { status: 401 });
    }
    const input = await req.json().catch(() => ({}));
    const offerId = String(input?.offer_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(offerId)) {
      return NextResponse.json({ success: false, message: "Choose a valid offer." }, { status: 400 });
    }

    const admin = createServerSupabaseClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError || profile?.role !== "affiliate") {
      return NextResponse.json({ success: false, message: "An affiliate account is required." }, { status: 403 });
    }

    const { data: offer, error: offerError } = await admin
      .from("offers")
      .select("id,business_email,currency,meta_page_id,meta_ad_account_id")
      .eq("id", offerId).maybeSingle();
    if (offerError || !offer?.id || !offer?.business_email) {
      return NextResponse.json({ success: false, message: "Offer not found." }, { status: 404 });
    }
    if (String(offer.business_email).toLowerCase() === user.email.toLowerCase()) {
      return NextResponse.json({ success: false, message: "Use an affiliate account for a different business." }, { status: 403 });
    }
    // Browser has already run /api/affiliate/offers/:id/start. Check participation
    // without creating another affiliate request or duplicate notification.
    const { data: participation, error: participationError } = await admin.from("affiliate_requests")
      .select("id,status").eq("offer_id", offerId).ilike("affiliate_email", user.email)
      .limit(1).maybeSingle();
    if (participationError) throw participationError;
    if (!participation || !["approved", "pending"].includes(String(participation.status).toLowerCase())) {
      return NextResponse.json({ success: false, message: "Start promoting this offer before submitting a proposal." }, { status: 409 });
    }

    const connectedCurrency = String(offer.currency || "").trim().toUpperCase();
    let accountCurrency = connectedCurrency;
    if (offer.meta_page_id && offer.meta_ad_account_id) {
      const { data: connections, error: connectionError } = await admin.from("meta_connections")
        .select("ad_account_id,ad_account_currency")
        .eq("business_email", offer.business_email)
        .eq("page_id", offer.meta_page_id);
      if (connectionError) throw connectionError;
      const match = (connections || []).find((row) =>
        String(row.ad_account_id || "").replace(/^act_/, "") === String(offer.meta_ad_account_id).replace(/^act_/, "")
      );
      if (match?.ad_account_currency) accountCurrency = String(match.ad_account_currency).toUpperCase();
      if (connectedCurrency && accountCurrency !== connectedCurrency) {
        return NextResponse.json({
          success: false, error: "META_CURRENCY_MISMATCH",
          message: "The offer currency does not match its connected Meta ad account. Ask the business to correct the connection.",
        }, { status: 409 });
      }
    }
    const intendedCurrency = String(input.currency || "").toUpperCase();
    if (intendedCurrency !== accountCurrency) {
      return NextResponse.json({
        success: false, error: "CAMPAIGN_CURRENCY_MISMATCH",
        message: "Campaign currency changed. Reload the offer before submitting.",
      }, { status: 409 });
    }

    const intent = {
      ...input,
      budget_amount: input.budget_amount,
      currency: intendedCurrency,
    };
    const check = validateCampaignIntent(intent, { currency: accountCurrency, requireMedia: true });
    if (!check.ok) {
      return NextResponse.json({
        success: false, error: "CAMPAIGN_CONFIGURATION_INVALID",
        message: check.errors[0],
        errors: check.errors,
      }, { status: 409 });
    }

    const allowed = [
      "file_url", "thumbnail_url", "media_type", "type", "business_creative_id",
      "campaign_name", "objective", "performance_goal", "conversion_location",
      "budget_amount", "budget_type", "start_time", "end_time", "location",
      "age_range", "gender", "manual_placements", "placements_type",
      "advantage_audience", "headline", "caption", "call_to_action",
      "display_link", "tracking_link", "bid_strategy", "bid_cap",
    ];
    const row: Record<string, unknown> = {};
    for (const key of allowed) if (Object.prototype.hasOwnProperty.call(input, key)) row[key] = input[key];
    row.offer_id = offerId;
    row.business_email = offer.business_email;
    row.affiliate_email = user.email;
    // Attribution identity is server-derived, never supplied by the browser.
    row.tracking_link = `https://www.nettmark.com/go/${offerId}___${user.email}`;
    row.status = "pending";
    row.meta_status = null;
    row.meta_campaign_id = null;
    row.currency = check.currency;
    row.interests = JSON.stringify(check.interests);
    row.manual_placements = check.placements;

    const { data: inserted, error: insertError } = await admin.from("ad_ideas")
      .insert(row).select("id").single();
    if (insertError || !inserted?.id) {
      console.error("[affiliate/ad-ideas/create] insert failed", insertError);
      return NextResponse.json({ success: false, message: "Couldn't save the campaign proposal." }, { status: 500 });
    }
    return NextResponse.json({ success: true, id: inserted.id }, { status: 201 });
  } catch (error) {
    console.error("[affiliate/ad-ideas/create]", error);
    return NextResponse.json({ success: false, message: "Could not submit campaign. Please retry." }, { status: 500 });
  }
}

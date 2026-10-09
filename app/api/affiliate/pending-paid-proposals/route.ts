import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "../../../../utils/businessSubscriptions";
import { getBusinessEntitlement } from "../../../../utils/businessEntitlements";
import { getAffiliateCampaignFundingReadiness } from "../../../../utils/paidCampaignLaunchReadiness";

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

    const affiliateEmail = user.email.trim().toLowerCase();
    const admin = createServerSupabaseClient();

    const { data: proposals, error: proposalError } = await admin
      .from("ad_ideas")
      .select(
        "id,offer_id,affiliate_email,business_email,status,created_at,campaign_name,objective,budget_amount,daily_budget,start_time,end_time,meta_campaign_id",
      )
      .eq("affiliate_email", affiliateEmail)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (proposalError) {
      throw new Error(`Failed to load pending proposals: ${proposalError.message}`);
    }

    const offerIds = Array.from(
      new Set((proposals || []).map((proposal: any) => proposal.offer_id).filter(Boolean)),
    );

    const { data: offers, error: offerError } = offerIds.length
      ? await admin
          .from("offers")
          .select("id,title,business_email")
          .in("id", offerIds)
      : { data: [], error: null };

    if (offerError) {
      throw new Error(`Failed to load proposal offers: ${offerError.message}`);
    }

    const offerMap = new Map(
      (offers || []).map((offer: any) => [offer.id, offer]),
    );

    const entitlementCache = new Map<string, Awaited<ReturnType<typeof getBusinessEntitlement>> | null>();

    const items = await Promise.all(
      (proposals || []).map(async (proposal: any) => {
        const businessEmail = String(proposal.business_email || "").trim().toLowerCase();
        const offerId = String(proposal.offer_id || "");
        const offer = offerMap.get(offerId) as any;

        let entitlement = entitlementCache.get(businessEmail);
        if (entitlement === undefined) {
          entitlement = businessEmail
            ? await getBusinessEntitlement({
                supabase: admin as never,
                businessEmail,
              }).catch((error) => {
                console.warn(
                  "[affiliate/pending-paid-proposals] entitlement lookup failed",
                  businessEmail,
                  error,
                );
                return null;
              })
            : null;
          entitlementCache.set(businessEmail, entitlement);
        }

        const growthReady = Boolean(
          entitlement &&
            (entitlement.canLaunchCampaign || !entitlement.subscriptionRequired),
        );

        const funding = await getAffiliateCampaignFundingReadiness({
          supabase: admin,
          affiliateEmail,
          offerId,
          adIdea: proposal,
        }).catch((error) => {
          console.warn("[affiliate/pending-paid-proposals] funding unavailable", error);
          return null;
        });

        const state = !funding ? "funding_unavailable" : !growthReady
          ? "waiting_for_business"
          : !funding.ready
            ? "funding_required"
            : "funded_waiting_for_business";

        return {
          id: proposal.id,
          offerId,
          offerTitle: offer?.title || "Paid campaign proposal",
          businessEmail,
          campaignName: proposal.campaign_name || null,
          objective: proposal.objective || null,
          createdAt: proposal.created_at,
          state,
          growthReady,
          funding: funding ? {
            ready: funding.ready,
            requiredAmount: funding.requiredAmount,
            deficit: funding.deficit,
          } : null,
        };
      }),
    );

    return NextResponse.json({ success: true, proposals: items });
  } catch (error) {
    console.error("[affiliate/pending-paid-proposals]", error);
    return NextResponse.json(
      {
        success: false,
        error: "PENDING_PROPOSALS_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Could not load pending paid proposals.",
      },
      { status: 500 },
    );
  }
}

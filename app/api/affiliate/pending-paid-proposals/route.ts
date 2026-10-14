import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "../../../../utils/businessSubscriptions";
import { getBusinessEntitlement } from "../../../../utils/businessEntitlements";
import { getAffiliateCampaignFundingReadiness, getCampaignRequiredFundingDollars, validatePaidCampaignTiming } from "../../../../utils/paidCampaignLaunchReadiness";

import { getWalletBalanceSnapshot } from "../../../../utils/wallet/balance";

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

    // Cache promises before awaiting: concurrent cards share in-flight reads.
    const entitlementCache = new Map<string, Promise<Awaited<ReturnType<typeof getBusinessEntitlement>> | null>>();
    const fundingCache = new Map<string, Promise<Awaited<ReturnType<typeof getAffiliateCampaignFundingReadiness>> | null>>();
    let walletSnapshot: ReturnType<typeof getWalletBalanceSnapshot> | undefined;

    const items = await Promise.all(
      (proposals || []).map(async (proposal: any) => {
        const businessEmail = String(proposal.business_email || "").trim().toLowerCase();
        const offerId = String(proposal.offer_id || "");
        const offer = offerMap.get(offerId) as any;

        let entitlementPromise = entitlementCache.get(businessEmail);
        if (!entitlementPromise) {
          entitlementPromise = businessEmail
            ? getBusinessEntitlement({ supabase: admin as never, businessEmail }).catch((error) => {
                console.warn("[affiliate/pending-paid-proposals] entitlement lookup failed", businessEmail, error);
                return null;
              })
            : Promise.resolve(null);
          entitlementCache.set(businessEmail, entitlementPromise);
        }

        const fundingKey = JSON.stringify([offerId, getCampaignRequiredFundingDollars(proposal)]);
        let fundingPromise = fundingCache.get(fundingKey);
        if (!fundingPromise) {
          if (offerId) walletSnapshot ??= getWalletBalanceSnapshot(admin, affiliateEmail);
          fundingPromise = getAffiliateCampaignFundingReadiness({
            supabase: admin, affiliateEmail, offerId, adIdea: proposal, walletSnapshot,
          }).catch((error) => {
            console.warn("[affiliate/pending-paid-proposals] funding unavailable", error);
            return null;
          });
          fundingCache.set(fundingKey, fundingPromise);
        }
        const [entitlement, funding] = await Promise.all([entitlementPromise, fundingPromise]);
        const growthReady = Boolean(
          entitlement && (entitlement.canLaunchCampaign || !entitlement.subscriptionRequired),
        );

        const timing = validatePaidCampaignTiming(proposal);
        const state = proposal.meta_campaign_id ? "meta_cleanup_required" : !timing.ok ? "timing_update_required" : !funding ? "funding_unavailable" : !growthReady
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
          timingMessage: timing.ok ? null : timing.message,
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

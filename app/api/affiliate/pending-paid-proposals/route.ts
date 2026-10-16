import { getLaunchWalletAvailable } from "../../../../utils/wallet/launchHolds";
import { loadPaidCurrencyReadiness } from "../../../../utils/currency/paidCurrencyGuard";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "../../../../utils/supabase/createServerClient";
import { getBusinessEntitlements } from "../../../../utils/businessEntitlements";
import { getAffiliateCampaignFundingReadiness, loadCampaignFundingSources, validatePaidCampaignTiming } from "../../../../utils/paidCampaignLaunchReadiness";

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
        "id,offer_id,affiliate_email,business_email,status,created_at,campaign_name,objective,currency,budget_amount,daily_budget,start_time,end_time,meta_campaign_id",
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

    const businessEmails = [...new Set((proposals || []).map((proposal: { business_email?: string | null }) => String(proposal.business_email || "").trim().toLowerCase()).filter(Boolean))] as string[];
    const entitlementsTask = businessEmails.length ? getBusinessEntitlements(admin, businessEmails).catch(error => {
      console.warn("[affiliate/pending-paid-proposals] entitlement lookup failed", error);
      return new Map();
    }) : Promise.resolve(new Map());
    const sourcesTask = offerIds.length ? loadCampaignFundingSources(admin, affiliateEmail, offerIds as string[])
      .then(data => ({ data, error: null as unknown }))
      .catch(error => ({ data: new Map(), error })) : Promise.resolve({ data: new Map(), error: null });
    const walletTask = offerIds.length ? getLaunchWalletAvailable(admin, affiliateEmail)
      .then(availableBalance => ({ data: { availableBalance }, error: null as unknown })).catch(error => ({ data: null, error })) : Promise.resolve({ data: null, error: null });

    const { data: offers, error: offerError } = offerIds.length
      ? await admin
          .from("offers")
          .select("id,title,business_email,currency,meta_page_id,meta_ad_account_id")
          .in("id", offerIds)
      : { data: [], error: null };

    if (offerError) {
      throw new Error(`Failed to load proposal offers: ${offerError.message}`);
    }

    const currencyTask = loadPaidCurrencyReadiness(admin, offerIds as string[], offers || []);
    const [currencyReadiness, entitlements, sources, wallet] = await Promise.all([currencyTask, entitlementsTask, sourcesTask, walletTask]);
    const offerMap = new Map((offers || []).map((offer: any) => [offer.id, offer]));

    const items = await Promise.all(
      (proposals || []).map(async (proposal: any) => {
        const businessEmail = String(proposal.business_email || "").trim().toLowerCase();
        const offerId = String(proposal.offer_id || "");
        const offer = offerMap.get(offerId) as any;

        const entitlement = entitlements.get(businessEmail);
        const funding = await (async () => {
          try {
            const currency = currencyReadiness(offerId, proposal.currency);
            if (currency.allowed && (sources.error || wallet.error)) throw sources.error || wallet.error;
            return await getAffiliateCampaignFundingReadiness({
              supabase: admin, affiliateEmail, offerId, adIdea: proposal,
              walletSnapshot: Promise.resolve(wallet.data!),
              fundingSources: Promise.resolve(sources.data.get(offerId) || { activationSubsidyAvailable: 0, launchFundAvailable: 0, reservationsApplied: true }),
              currencyReadiness: currency,
            });
          } catch (error) {
            console.warn("[affiliate/pending-paid-proposals] funding unavailable", error);
            return null;
          }
        })();
        const growthReady = Boolean(
          entitlement && (entitlement.canLaunchCampaign || !entitlement.subscriptionRequired),
        );

        const timing = validatePaidCampaignTiming(proposal);
        const state = funding?.currencyBlock ? "currency_blocked" : proposal.meta_campaign_id ? "meta_cleanup_required" : !timing.ok ? "timing_update_required" : !funding ? "funding_unavailable" : !growthReady
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
          currency: proposal.currency || null,
          createdAt: proposal.created_at,
          state,
          timingMessage: timing.ok ? null : timing.message,
          currencyBlock: funding?.currencyBlock || null,
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

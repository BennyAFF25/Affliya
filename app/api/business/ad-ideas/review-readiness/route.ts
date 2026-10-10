import { NextResponse } from "next/server";
import { validateLaunchProposal } from "../../../../../utils/meta/campaignConfiguration";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "@/../utils/businessSubscriptions";
import { getBusinessPaymentReadiness } from "@/../utils/businessPaymentReadiness";
import { getBusinessEntitlement } from "@/../utils/businessEntitlements";
import {
  assertAffiliateOfferApproved,
  assertOfferTrackingReady,
  type QueryClient,
} from "@/../utils/approvals/enforcement";
import { resolveOfferPaidReadiness } from "@/../utils/offerReadiness";
import {
  getAffiliateCampaignFundingReadiness,
  getExistingPaidCampaignLaunch,
  validatePaidCampaignTiming,
} from "@/../utils/paidCampaignLaunchReadiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userSupabase = createRouteHandlerClient({ cookies });
    const { data: authData, error: authError } =
      await userSupabase.auth.getUser();
    const user = authData?.user || null;

    if (authError || !user?.email) {
      return NextResponse.json(
        { success: false, error: "UNAUTHENTICATED" },
        { status: 401 },
      );
    }

    const admin = createServerSupabaseClient();
    const [payment, entitlement, profileResult, ideasResult] = await Promise.all([
      getBusinessPaymentReadiness({
        supabase: admin as never,
        businessEmail: user.email,
      }),
      getBusinessEntitlement({
        supabase: admin as never,
        businessEmail: user.email,
      }).catch((error) => {
        console.warn(
          "[business/ad-ideas/review-readiness] entitlement lookup failed",
          error,
        );
        return null;
      }),
      admin
        .from("business_profiles")
        .select("id")
        .eq("business_email", user.email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("ad_ideas")
        .select(
          "*",
        )
        .eq("business_email", user.email)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);

    if (profileResult.error) {
      console.warn(
        "[business/ad-ideas/review-readiness] profile lookup failed",
        profileResult.error,
      );
    }
    if (ideasResult.error) {
      throw new Error(`Failed to load pending campaigns: ${ideasResult.error.message}`);
    }

    const fallbackBusinessId =
      (profileResult.data as { id?: string | null } | null)?.id || null;
    const subscriptionRequired = Boolean(
      entitlement?.subscriptionRequired ?? true,
    );
    const subscriptionReady = Boolean(entitlement?.canLaunchCampaign);
    const billingReady = Boolean(payment.hasPaymentMethod);

    const campaignEntries = await Promise.all(
      (ideasResult.data || []).map(async (idea: any) => {
        const offerId = String(idea.offer_id || "");
        const affiliateEmail = String(idea.affiliate_email || "").toLowerCase();

        try {
          const [affiliate, tracking, paidReadiness, funding, existingLive, offerResult] =
            await Promise.all([
              assertAffiliateOfferApproved(admin as unknown as QueryClient, {
                offerId,
                affiliateEmail,
              }),
              assertOfferTrackingReady(admin as unknown as QueryClient, offerId),
              resolveOfferPaidReadiness({
                supabase: admin as never,
                offerId,
              }),
              getAffiliateCampaignFundingReadiness({
                supabase: admin,
                affiliateEmail,
                offerId,
                adIdea: idea,
              }),
              getExistingPaidCampaignLaunch({
                supabase: admin,
                adIdeaId: idea.id,
              }),
              admin
                .from("offers")
                .select("id,business_email,currency")
                .eq("id", offerId)
                .maybeSingle(),
            ]);

          const timing = validatePaidCampaignTiming(idea);
          const configuration = validateLaunchProposal(idea, {
            currency: String(offerResult.data?.currency || ""),
            requireMedia: true,
          });
          const offerOwned = Boolean(
            offerResult.data?.id && offerResult.data.business_email === user.email,
          );
          const metaReady = Boolean(
            paidReadiness.resolvedMeta.pageId &&
              paidReadiness.resolvedMeta.adAccountId,
          );
          const isSales =
            String(idea.objective || "").trim() === "OUTCOME_SALES";
          const pixelReady = !isSales || Boolean(paidReadiness.resolvedMeta.pixelId);
          const alreadyLive = Boolean(existingLive?.id);
          const partialMetaState = Boolean(idea.meta_campaign_id && !alreadyLive);

          const blockers: string[] = [];
          if (!offerOwned) blockers.push("OFFER_NOT_AVAILABLE");
          if (!affiliate.ok) blockers.push(affiliate.error);
          if (subscriptionRequired && !subscriptionReady)
            blockers.push("BUSINESS_GROWTH_REQUIRED");
          if (!billingReady) blockers.push("BUSINESS_BILLING_REQUIRED");
          if (!funding.ready)
            blockers.push("AFFILIATE_CAMPAIGN_FUNDING_REQUIRED");
          if (!metaReady) blockers.push("META_SETUP_REQUIRED");
          if (!tracking.ok) blockers.push(tracking.error);
          if (!pixelReady) blockers.push("SALES_PIXEL_REQUIRED");
          if (!timing.ok) blockers.push(timing.error);
          if (!configuration.ok) blockers.push("CAMPAIGN_CONFIGURATION_INVALID");
          if (partialMetaState) blockers.push("CAMPAIGN_PARTIAL_META_STATE");

          return [
            idea.id,
            {
              ready: blockers.length === 0 && !alreadyLive,
              alreadyLive,
              partialMetaState,
              blockers,
              funding: {
                ready: funding.ready,
                requiredAmount: funding.requiredAmount,
                deficit: funding.deficit,
              },
              meta: {
                ready: metaReady,
                pageReady: Boolean(paidReadiness.resolvedMeta.pageId),
                adAccountReady: Boolean(paidReadiness.resolvedMeta.adAccountId),
              },
              tracking: {
                ready: tracking.ok,
                error: tracking.ok ? null : tracking.error,
              },
              pixel: {
                required: isSales,
                ready: pixelReady,
              },
              configuration: {
                ready: configuration.ok,
                errors: configuration.errors,
              },
              timing: {
                ready: timing.ok,
                error: timing.ok ? null : timing.error,
                message: timing.ok ? null : timing.message,
              },
              affiliate: {
                ready: affiliate.ok,
              },
              offer: {
                ready: offerOwned,
              },
            },
          ] as const;
        } catch (error) {
          console.warn(
            "[business/ad-ideas/review-readiness] campaign readiness failed",
            idea.id,
            error,
          );
          return [
            idea.id,
            {
              ready: false,
              alreadyLive: false,
              partialMetaState: Boolean(idea.meta_campaign_id),
              blockers: ["READINESS_CHECK_FAILED"],
              error:
                error instanceof Error
                  ? error.message
                  : "Could not evaluate campaign readiness.",
            },
          ] as const;
        }
      }),
    );

    return NextResponse.json({
      success: true,
      businessEmail: user.email,
      billing: {
        ready: payment.hasPaymentMethod,
        reason: payment.reason || null,
        customerId: payment.customerId || null,
        source: payment.source || null,
      },
      subscription: {
        ready: subscriptionReady,
        required: subscriptionRequired,
        grandfathered: Boolean(entitlement?.isGrandfathered),
        status: entitlement?.billingStatus || "unknown",
        businessId: entitlement?.businessId || fallbackBusinessId,
      },
      campaigns: Object.fromEntries(campaignEntries),
    });
  } catch (error) {
    console.error("[business/ad-ideas/review-readiness]", error);
    return NextResponse.json(
      {
        success: false,
        error: "REVIEW_READINESS_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Could not load review readiness.",
      },
      { status: 500 },
    );
  }
}

import { getActivationSubsidyRemaining } from "./activationSubsidies";
import { getActiveLaunchFundAllocation } from "./launchFund";
import { getWalletBalanceSnapshot } from "./wallet/balance";

type SupabaseLike = any;

type AdIdeaFundingInput = {
  budget_amount?: number | string | null;
  daily_budget?: number | string | null;
};

type AdIdeaTimingInput = {
  start_time?: string | null;
  end_time?: string | null;
};

export type AffiliateCampaignFundingReadiness = {
  ready: boolean;
  requiredAmount: number;
  walletAvailable: number;
  activationSubsidyAvailable: number;
  launchFundAvailable: number;
  effectiveFunding: number;
  deficit: number;
};

function money(value: unknown) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100) / 100;
}

export function getCampaignRequiredFundingDollars(adIdea: AdIdeaFundingInput) {
  const budgetAmountMinor = Number(adIdea?.budget_amount ?? 0);
  if (Number.isFinite(budgetAmountMinor) && budgetAmountMinor > 0) {
    return money(budgetAmountMinor / 100);
  }

  const legacyDailyBudget = Number(adIdea?.daily_budget ?? 0);
  return money(Math.max(0, Number.isFinite(legacyDailyBudget) ? legacyDailyBudget : 0));
}

export async function getAffiliateCampaignFundingReadiness(params: {
  supabase: SupabaseLike;
  affiliateEmail: string;
  offerId: string;
  adIdea: AdIdeaFundingInput;
}): Promise<AffiliateCampaignFundingReadiness> {
  const affiliateEmail = String(params.affiliateEmail || "").trim().toLowerCase();
  const requiredAmount = getCampaignRequiredFundingDollars(params.adIdea);

  if (!affiliateEmail || !params.offerId) {
    return {
      ready: false,
      requiredAmount,
      walletAvailable: 0,
      activationSubsidyAvailable: 0,
      launchFundAvailable: 0,
      effectiveFunding: 0,
      deficit: requiredAmount,
    };
  }

  const wallet = await getWalletBalanceSnapshot(params.supabase, affiliateEmail);

  const { data: subsidyRows, error: subsidyError } = await params.supabase
    .from("business_activation_subsidies")
    .select("id,status,subsidy_amount,consumed_amount,reserved_for_affiliate_email")
    .eq("offer_id", params.offerId)
    .eq("reserved_for_affiliate_email", affiliateEmail)
    .in("status", ["reserved", "partially_consumed"])
    .limit(1);

  if (subsidyError) {
    throw new Error(`Failed to load activation subsidy: ${subsidyError.message || subsidyError}`);
  }

  const activationSubsidyAvailable = getActivationSubsidyRemaining(subsidyRows?.[0] ?? null);

  // Launch Fund is intentionally not reserved at proposal time. Only an allocation
  // that is still uncommitted to another live campaign contributes to readiness.
  let launchFundAvailable = 0;
  try {
    const allocation = await getActiveLaunchFundAllocation({
      supabase: params.supabase,
      affiliateEmail,
      offerId: params.offerId,
    });
    const committedCampaignId = String(allocation?.allocated_for_campaign_id || "").trim();
    if (allocation && !committedCampaignId) {
      launchFundAvailable = money(allocation.amount);
    }
  } catch (error) {
    // Launch Fund may not exist in every preview environment. Wallet/subsidy
    // enforcement remains authoritative if this optional source is unavailable.
    console.warn("[paid-campaign-funding] launch fund lookup failed", error);
  }

  const walletAvailable = money(wallet.availableBalance);
  const effectiveFunding = money(
    walletAvailable + activationSubsidyAvailable + launchFundAvailable,
  );
  const deficit = money(Math.max(0, requiredAmount - effectiveFunding));

  return {
    ready: requiredAmount > 0 && deficit <= 0,
    requiredAmount,
    walletAvailable,
    activationSubsidyAvailable,
    launchFundAvailable,
    effectiveFunding,
    deficit,
  };
}

export type CampaignTimingReadiness =
  | { ok: true }
  | {
      ok: false;
      error: "CAMPAIGN_DATES_REQUIRE_UPDATE";
      message: string;
      reason: "start_in_past" | "end_in_past" | "end_before_start" | "invalid_date";
    };

export function validatePaidCampaignTiming(
  adIdea: AdIdeaTimingInput,
  nowMs = Date.now(),
): CampaignTimingReadiness {
  const startRaw = adIdea?.start_time || null;
  const endRaw = adIdea?.end_time || null;
  const startMs = startRaw ? new Date(startRaw).getTime() : null;
  const endMs = endRaw ? new Date(endRaw).getTime() : null;

  if ((startRaw && !Number.isFinite(startMs)) || (endRaw && !Number.isFinite(endMs))) {
    return {
      ok: false,
      error: "CAMPAIGN_DATES_REQUIRE_UPDATE",
      reason: "invalid_date",
      message: "Campaign dates are invalid. Update the schedule before launch.",
    };
  }

  if (startMs !== null && startMs <= nowMs) {
    return {
      ok: false,
      error: "CAMPAIGN_DATES_REQUIRE_UPDATE",
      reason: "start_in_past",
      message: "The proposed campaign start time has passed. Update the schedule before launch.",
    };
  }

  if (endMs !== null && endMs <= nowMs) {
    return {
      ok: false,
      error: "CAMPAIGN_DATES_REQUIRE_UPDATE",
      reason: "end_in_past",
      message: "The proposed campaign end time has passed. Update the schedule before launch.",
    };
  }

  if (startMs !== null && endMs !== null && endMs <= startMs) {
    return {
      ok: false,
      error: "CAMPAIGN_DATES_REQUIRE_UPDATE",
      reason: "end_before_start",
      message: "Campaign end time must be after its start time.",
    };
  }

  return { ok: true };
}

export async function getExistingPaidCampaignLaunch(params: {
  supabase: SupabaseLike;
  adIdeaId: string;
}) {
  const { data, error } = await params.supabase
    .from("live_ads")
    .select("id,ad_idea_id,meta_campaign_id,meta_ad_id,status")
    .eq("ad_idea_id", params.adIdeaId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check existing campaign launch: ${error.message || error}`);
  }

  return data || null;
}

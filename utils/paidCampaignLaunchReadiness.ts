import { getLaunchWalletAvailable } from "./wallet/launchHolds";
import { resolveCampaignSchedule } from "./campaignSchedule";
import { getActivationSubsidyRemaining, type ActivationSubsidyRow } from "./activationSubsidies";
import { getActiveLaunchFundAllocation, type LaunchFundAllocation } from "./launchFund";

import { guardPaidCurrency } from "./currency/paidCurrencyGuard";

type SupabaseLike = any;

type AdIdeaFundingInput = {
  id?: string | null;
  currency?: string | null;
  budget_amount?: number | string | null;
  daily_budget?: number | string | null;
};

type AdIdeaTimingInput = {
  created_at?: string | null;
  start_time?: string | null;
  end_time?: string | null;
};

export type AffiliateCampaignFundingReadiness = {
  currencyBlock?: string | null;
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
  /** Advisory endpoints only. Omit at launch/money boundaries to keep strict enforcement. */
  currencyReadiness?: Awaited<ReturnType<typeof guardPaidCurrency>>;
  /** Request-local wallet snapshot with hold-adjusted availableBalance; advisory only. */
  walletSnapshot?: Promise<{ availableBalance: number }>;
  /** Request-local advisory source batch; strict launch callers omit this. */
  fundingSources?: Promise<{ activationSubsidyAvailable: number; launchFundAvailable: number; reservationsApplied?: boolean }>;
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

  const currency = params.currencyReadiness ?? await guardPaidCurrency(params);
  if (!currency.allowed) return {
    ready: false, currencyBlock: currency.message, requiredAmount,
    walletAvailable: 0, activationSubsidyAvailable: 0, launchFundAvailable: 0,
    effectiveFunding: 0, deficit: requiredAmount,
  };

  const [walletAvailableRaw, sources, sourceReservation] = await Promise.all([
    params.currencyReadiness && params.walletSnapshot
      ? params.walletSnapshot.then(wallet => wallet.availableBalance)
      : getLaunchWalletAvailable(params.supabase, affiliateEmail, params.adIdea.id || undefined),
    params.fundingSources ?? loadFundingSources(params.supabase, affiliateEmail, params.offerId),
    params.fundingSources
      ? params.fundingSources.then(sources => sources.reservationsApplied ? { data: 0, error: null } : loadReservedSources())
      : loadReservedSources(),
  ]);
  function loadReservedSources() {
    return params.supabase.rpc('get_launch_source_reserved', {
      p_affiliate_email: affiliateEmail, p_offer_id: params.offerId,
      p_exclude_reference_id: params.adIdea.id || null,
    });
  }
  if (sourceReservation.error || sourceReservation.data == null || !Number.isFinite(Number(sourceReservation.data))) {
    throw new Error('Failed to load reserved campaign funding sources.');
  }
  const reservedSources = Math.max(0, Number(sourceReservation.data));
  const activationSubsidyAvailable = money(Math.max(0, sources.activationSubsidyAvailable - reservedSources));
  const launchFundAvailable = money(Math.max(0, sources.launchFundAvailable - Math.max(0, reservedSources - sources.activationSubsidyAvailable)));

  const walletAvailable = money(walletAvailableRaw);
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

async function loadFundingSources(supabase: SupabaseLike, affiliateEmail: string, offerId: string): Promise<{ activationSubsidyAvailable: number; launchFundAvailable: number; reservationsApplied?: boolean }> {
  const { data: subsidyRows, error: subsidyError } = await supabase
    .from("business_activation_subsidies")
    .select("id,status,subsidy_amount,consumed_amount,reserved_for_affiliate_email")
    .eq("offer_id", offerId)
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
      supabase,
      affiliateEmail,
      offerId,
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

  return { activationSubsidyAvailable, launchFundAvailable };
}

/** Read-only advisory batch: source and reservation reads are independent of proposal count. */
export async function loadCampaignFundingSources(supabase: SupabaseLike, affiliateEmail: string, offerIds: string[]) {
  const subsidyTask = supabase.from("business_activation_subsidies")
    .select("offer_id,id,status,subsidy_amount,consumed_amount,reserved_for_affiliate_email")
    .in("offer_id", offerIds).eq("reserved_for_affiliate_email", affiliateEmail)
    .in("status", ["reserved", "partially_consumed"]);
  const allocationTask = (async () => {
    try {
      const result = await supabase.from("affiliate_launch_fund_allocations").select("*")
        .eq("affiliate_email", affiliateEmail).in("allocated_for_offer_id", offerIds)
        .in("status", ["allocated", "reserved"]).gt("expires_at", new Date().toISOString())
        .order("allocated_at", { ascending: true });
      if (result.error) throw result.error;
      return result.data || [];
    } catch (error) {
      console.warn("[paid-campaign-funding] launch fund lookup failed", error);
      return [];
    }
  })();
  const holdsTask = supabase.from('wallet_holds').select('launch_offer_id,launch_source_minor,wallet_accounts!inner(owner_email)')
    .eq('wallet_accounts.owner_email', affiliateEmail).eq('wallet_accounts.currency', 'AUD').eq('status', 'active');
  const [subsidies, allocations, holds] = await Promise.all([subsidyTask, allocationTask, holdsTask]);
  if (holds.error) throw new Error(`Failed to load campaign holds: ${holds.error.message}`);
  const reserved = new Map<string, number>();
  for (const hold of holds.data || []) reserved.set(hold.launch_offer_id, (reserved.get(hold.launch_offer_id) || 0) + Number(hold.launch_source_minor || 0) / 100);
  if (subsidies.error) throw new Error(`Failed to load activation subsidy: ${subsidies.error.message}`);
  const subsidyByOffer = new Map<string, ActivationSubsidyRow>();
  for (const row of (subsidies.data || []) as ActivationSubsidyRow[]) {
    if (row.offer_id && !subsidyByOffer.has(row.offer_id)) subsidyByOffer.set(row.offer_id, row);
  }
  const allocationByOffer = new Map<string, LaunchFundAllocation>();
  for (const row of allocations as LaunchFundAllocation[]) {
    if (row.allocated_for_offer_id && !allocationByOffer.has(row.allocated_for_offer_id)) allocationByOffer.set(row.allocated_for_offer_id, row);
  }
  return new Map(offerIds.map(offerId => {
    const subsidy = subsidyByOffer.get(offerId);
    // Select the earliest eligible allocation before checking commitment, matching the single-offer helper.
    const allocation = allocationByOffer.get(offerId);
    const sourceReserved = reserved.get(offerId) || 0;
    const subsidyAmount = getActivationSubsidyRemaining(subsidy ?? null);
    const promo = allocation && !String(allocation.allocated_for_campaign_id || "").trim() ? money(allocation.amount) : 0;
    return [offerId, {
      activationSubsidyAvailable: money(Math.max(0, subsidyAmount - sourceReserved)),
      launchFundAvailable: money(Math.max(0, promo - Math.max(0, sourceReserved - subsidyAmount))),
      reservationsApplied: true,
    }];
  }));
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
  const schedule = resolveCampaignSchedule(adIdea, nowMs);
  const startRaw = schedule.start_time || null;
  const endRaw = schedule.end_time || null;
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

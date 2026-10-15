/* eslint-disable @typescript-eslint/no-explicit-any */
import { resolveOfferPaidReadiness } from "../offerReadiness";
import { PAID_CURRENCY_BLOCK_MESSAGE } from "./paidCurrencyMessage";
export { PAID_CURRENCY_BLOCK_MESSAGE } from "./paidCurrencyMessage";

export function checkPaidCurrency(proposalCurrency: unknown, offerCurrency: unknown, accountCurrency: unknown) {
  const normalize = (value: unknown) => String(value ?? "").trim().toUpperCase();
  // Only NULL/absent legacy snapshots fall back; blank or unknown snapshots block.
  const campaignCurrency = normalize(proposalCurrency == null ? offerCurrency : proposalCurrency);
  const metaAccountCurrency = normalize(accountCurrency);
  const allowed = campaignCurrency === "AUD" && metaAccountCurrency === "AUD";
  const reason = !campaignCurrency ? "missing_campaign_currency" : campaignCurrency !== "AUD"
    ? "unsupported_campaign_currency" : !metaAccountCurrency ? "missing_meta_account_currency"
    : metaAccountCurrency !== "AUD" ? "unsupported_meta_account_currency" : null;
  return { allowed, campaignCurrency, metaAccountCurrency, reason, message: allowed ? null : PAID_CURRENCY_BLOCK_MESSAGE };
}

/** Read-only server guard. Connection matching mirrors upload-video exactly. Never defaults account currency. */
export async function guardPaidCurrency(params: { supabase: any; offerId?: string; adIdea?: { currency?: unknown }; liveAdId?: string }) {
  try {
    let offerId = params.offerId;
    let idea = params.adIdea;
    if (params.liveAdId) {
      const live = await params.supabase.from("live_ads").select("offer_id,ad_idea_id").eq("id", params.liveAdId).maybeSingle();
      if (live.error || !live.data) throw new Error("live_ad_currency_context_missing");
      offerId = live.data.offer_id;
      if (!live.data.ad_idea_id) throw new Error("proposal_currency_context_missing");
      const proposal = await params.supabase.from("ad_ideas").select("currency,offer_id").eq("id", live.data.ad_idea_id).maybeSingle();
      if (proposal.error || !proposal.data || proposal.data.offer_id !== offerId) throw new Error("proposal_currency_context_missing");
      idea = proposal.data;
    }
    const offer = await params.supabase.from("offers").select("currency,business_email").eq("id", offerId || "").maybeSingle();
    if (offer.error || !offer.data) throw new Error("offer_currency_context_missing");
    const readiness = await resolveOfferPaidReadiness({ supabase: params.supabase, offerId: offerId || "" });
    const { pageId, adAccountId } = readiness.resolvedMeta;
    if (!pageId || !adAccountId) return checkPaidCurrency(idea?.currency, offer.data.currency, null);
    const connection = await params.supabase.from("meta_connections").select("ad_account_currency")
      .eq("business_email", offer.data.business_email).eq("page_id", pageId).eq("ad_account_id", adAccountId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (connection.error) throw new Error("meta_currency_lookup_failed");
    return checkPaidCurrency(idea?.currency, offer.data.currency, connection.data?.ad_account_currency);
  } catch (error) {
    return { ...checkPaidCurrency(null, null, null), reason: error instanceof Error ? error.message : "currency_lookup_failed" };
  }
}

/** Advisory only: absent account setup belongs to normal readiness, not currency copy. */
export function checkPaidCurrencyReadiness(proposalCurrency: unknown, offerCurrency: unknown, accountCurrency?: unknown) {
  const result = checkPaidCurrency(proposalCurrency, offerCurrency, accountCurrency);
  if (result.reason === "missing_meta_account_currency") {
    return { ...result, allowed: true, reason: null, message: null };
  }
  return result;
}

/** Two reads regardless of proposal count; callers may reuse their existing offer batch. */
export async function loadPaidCurrencyReadiness(supabase: any, offerIds: string[], existingOffers?: any[]) {
  const ids = [...new Set(offerIds.filter(Boolean))];
  const offersResult = existingOffers ? { data: existingOffers, error: null } : ids.length
    ? await supabase.from("offers").select("id,currency,business_email,meta_page_id,meta_ad_account_id").in("id", ids)
    : { data: [], error: null };
  if (offersResult.error) throw new Error("offer_currency_lookup_failed");
  const offers = offersResult.data || [];
  const emails = [...new Set(offers.map((offer: any) => offer.business_email).filter(Boolean))];
  const connectionsResult = emails.length
    ? await supabase.from("meta_connections").select("business_email,page_id,ad_account_id,ad_account_currency,created_at")
      .in("business_email", emails).order("created_at", { ascending: false })
    : { data: [], error: null };
  if (connectionsResult.error) throw new Error("meta_currency_lookup_failed");
  const contexts = new Map<string, { offerCurrency: unknown; accountCurrency: unknown }>();
  for (const offer of offers) {
    const rows = (connectionsResult.data || []).filter((row: any) => row.business_email === offer.business_email);
    const unique = (key: string) => [...new Set(rows.map((row: any) => String(row[key] || "").trim()).filter(Boolean))];
    const pages = unique("page_id"), accounts = unique("ad_account_id");
    const page = String(offer.meta_page_id || "").trim() || (pages.length === 1 ? pages[0] : null);
    const account = String(offer.meta_ad_account_id || "").trim() || (accounts.length === 1 ? accounts[0] : null);
    const connection = page && account ? rows.find((row: any) => row.page_id === page && row.ad_account_id === account) : null;
    contexts.set(offer.id, { offerCurrency: offer.currency, accountCurrency: connection?.ad_account_currency });
  }
  return (offerId: string, proposalCurrency: unknown) => {
    const context = contexts.get(offerId);
    if (!context) return checkPaidCurrencyReadiness(null, null);
    return checkPaidCurrencyReadiness(proposalCurrency, context.offerCurrency, context.accountCurrency);
  };
}

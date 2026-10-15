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

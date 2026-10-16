/** Offer currency is authoritative; legacy proposals may omit their saved currency. */
export function resolveOfferCurrency(proposalCurrency: unknown, offerCurrency: unknown, accountCurrency?: unknown) {
  const normalize = (value: unknown) => String(value ?? "").trim().toUpperCase();
  const campaignCurrency = normalize(offerCurrency);
  const savedCurrency = normalize(proposalCurrency);
  const metaAccountCurrency = normalize(accountCurrency);
  const reason = !campaignCurrency ? "missing_campaign_currency"
    : savedCurrency && savedCurrency !== campaignCurrency ? "proposal_currency_mismatch"
    : metaAccountCurrency && metaAccountCurrency !== campaignCurrency ? "meta_account_currency_mismatch" : null;
  const message = reason === "missing_campaign_currency" ? "This offer has no currency set — the brand must set it before paid launch"
    : reason === "proposal_currency_mismatch" ? `Currency mismatch: offer ${campaignCurrency}, proposal ${savedCurrency}`
    : reason === "meta_account_currency_mismatch" ? `Currency mismatch: offer ${campaignCurrency}, ad account ${metaAccountCurrency}` : null;
  return { allowed: !reason, campaignCurrency, metaAccountCurrency, reason, message };
}


// Stripe amounts and all results are integer minor units. Tolerate pre-Basil invoice fields.
type Ref = string | { id?: string } | null;
export type CommissionInvoice = {
  id?: string; status?: string | null; amount_paid?: number; currency?: string;
  billing_reason?: string | null; tax?: number | null;
  total_taxes?: { amount: number }[] | null; total_tax_amounts?: { amount: number }[];
  lines?: { data: {
    amount: number; amount_excluding_tax?: number | null;
    type?: string; subscription?: Ref; subscription_item?: Ref;
    parent?: { type?: string; subscription_item_details?: { proration?: boolean } | null } | null;
    proration?: boolean; discount_amounts?: { amount: number }[] | null;
    pretax_credit_amounts?: { amount: number }[] | null;
    price?: { recurring?: { interval?: string; interval_count?: number } | null } | null;
    pricing?: { price_details?: { price?: Ref } | null } | null;
  }[]; has_more?: boolean };
};
export function calculateEligibleSubscriptionRevenue(invoice: CommissionInvoice, monthly: boolean, assumeAudGst = process.env.GROWTH_PARTNER_ASSUME_AUD_GST_INCLUSIVE !== 'false') {
  const amountPaid = Math.max(0, Math.trunc(invoice.amount_paid || 0));
  const skipped = (reason: string) => ({ eligible: false as const, reason, base: 0, amountPaid, taxAmount: 0 });
  if (invoice.status !== 'paid') return skipped('invoice_not_paid');
  if (!amountPaid) return skipped('free_or_zero_amount_invoice');
  if (!['subscription_create', 'subscription_cycle'].includes(invoice.billing_reason || '')) return skipped('ineligible_billing_reason');
  if (!monthly) return skipped('non_monthly_subscription');
  if (invoice.lines?.has_more) return skipped('incomplete_invoice_lines');
  const reportedTax = Math.max(0, Math.trunc(invoice.total_taxes?.reduce((sum, t) => sum + t.amount, 0) ?? invoice.total_tax_amounts?.reduce((sum, t) => sum + t.amount, 0) ?? invoice.tax ?? 0));
  const gstFallback = reportedTax === 0 && invoice.currency?.toLowerCase() === 'aud' && assumeAudGst;
  const taxAmount = reportedTax || (gstFallback ? Math.round(amountPaid / 11) : 0);
  let subtotal = 0;
  for (const line of invoice.lines?.data || []) {
    if (!(line.type === 'subscription' || line.subscription || line.subscription_item || line.parent?.type === 'subscription_item_details')) continue;
    if (line.proration || line.parent?.subscription_item_details?.proration) continue;
    if (line.price?.recurring && (line.price.recurring.interval !== 'month' || (line.price.recurring.interval_count || 1) !== 1)) continue;
    // amount_excluding_tax is before discounts; credits replace discount_amounts in newer versions.
    const credits = line.pretax_credit_amounts ?? line.discount_amounts ?? [];
    const afterCredits = (line.amount_excluding_tax ?? line.amount) - credits.reduce((sum, c) => sum + c.amount, 0);
    subtotal += gstFallback ? Math.round(afterCredits * 10 / 11) : afterCredits;
  }
  const base = Math.max(0, Math.min(Math.trunc(subtotal), amountPaid - taxAmount));
  return { eligible: base > 0, reason: base > 0 ? null : 'no_eligible_subscription_revenue', base, amountPaid, taxAmount };
}
export function commissionCents(base: number, percentage: number) {
  return Math.floor((base * Math.round(percentage * 100) + 5000) / 10000);
}
export function remainingCommission(original: number, amountPaid: number, refunded: number) {
  return amountPaid > 0 ? Math.max(0, Math.round(original * Math.max(0, amountPaid - refunded) / amountPaid)) : 0;
}
export function commissionHoldDays() {
  const days = Number(process.env.GROWTH_PARTNER_COMMISSION_HOLD_DAYS ?? 14);
  return Number.isFinite(days) && days >= 0 ? Math.min(365, Math.floor(days)) : 14;
}

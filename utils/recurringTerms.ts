export type RecurringPayoutLike = {
  is_recurring?: boolean | null;
  cycle_number?: number | null;
  recurring_term_months?: number | null;
  recurring_payout_mode?: string | null;
  recurring_payout_interval?: string | null;
};

function monthLabel(months?: number | null) {
  if (!months || months <= 0) return "term";
  return `${months} ${months === 1 ? "month" : "months"}`;
}

export function formatRecurringTermDetail(
  title: string | null | undefined,
  payout: RecurringPayoutLike,
) {
  const prefix = title ? `${title} · ` : "";
  if (!payout.is_recurring) {
    return title ? `${title} · One-off payout` : "One-off payout";
  }

  const payoutMode = String(payout.recurring_payout_mode || "spread").toLowerCase();
  const termMonths = payout.recurring_term_months ?? null;
  const interval = payout.recurring_payout_interval || "monthly";

  if (payoutMode === "upfront") {
    return `${prefix}Recurring term upfront · ${monthLabel(termMonths)}`;
  }

  const cycleNumber = payout.cycle_number ?? 1;
  const cycleTotal = termMonths ?? cycleNumber;
  return `${prefix}Recurring term · Cycle ${cycleNumber}/${cycleTotal} · ${interval}`;
}

export function describeAffiliatePayout(payout: RecurringPayoutLike & { status?: string | null }) {
  const status = String(payout.status || "pending").toLowerCase();
  const payoutMode = String(payout.recurring_payout_mode || "spread").toLowerCase();

  if (status === "completed") {
    return payout.is_recurring
      ? payoutMode === "upfront"
        ? "Recurring term payout received"
        : "Recurring term commission received"
      : "Affiliate payout received";
  }

  if (status === "pending") {
    return payout.is_recurring
      ? payoutMode === "upfront"
        ? "Recurring term payout scheduled"
        : "Recurring term commission scheduled"
      : "Affiliate payout scheduled";
  }

  return payout.is_recurring
    ? `Recurring term payout ${status}`
    : `Affiliate payout ${status}`;
}

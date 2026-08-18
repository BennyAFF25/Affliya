export type ActivationSubsidyStatus =
  | "awaiting_subscription"
  | "available"
  | "reserved"
  | "partially_consumed"
  | "consumed"
  | "settled"
  | "expired"
  | "cancelled";

export type ActivationSubsidyRow = {
  id: string;
  business_email: string;
  offer_id: string | null;
  status: ActivationSubsidyStatus;
  subsidy_amount: number | string | null;
  consumed_amount: number | string | null;
  reserved_for_affiliate_email?: string | null;
  consumed_by_affiliate_email?: string | null;
  live_ad_id?: string | null;
};

export function toMoney(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function getActivationSubsidyRemaining(row?: Partial<ActivationSubsidyRow> | null) {
  if (!row) return 0;
  return Math.max(0, toMoney(row.subsidy_amount) - toMoney(row.consumed_amount));
}

export function isRevenueSubscriptionLive(status?: string | null) {
  const normalized = String(status || "").toLowerCase();
  return normalized === "trialing" || normalized === "active";
}

export function getActivationSubsidyBadgeLabel(row?: Partial<ActivationSubsidyRow> | null) {
  const remaining = getActivationSubsidyRemaining(row);
  if (remaining <= 0) return null;
  return `Includes $${remaining.toFixed(0)} starter ad spend`;
}

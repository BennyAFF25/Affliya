type QueryResponse = {
  data: Record<string, unknown>[] | Record<string, unknown> | null;
  error: { message?: string | null } | null;
};

type InsertBuilder = PromiseLike<QueryResponse> & {
  insert: (values: Record<string, unknown> | Record<string, unknown>[]) => InsertBuilder;
};

type QueryClient = {
  from: (table: string) => InsertBuilder;
};

type MoneyFlowAuditEntry = {
  eventType: string;
  severity?: "info" | "warning" | "error";
  sourceRoute: string;
  entityType?: string | null;
  entityId?: string | null;
  businessEmail?: string | null;
  affiliateEmail?: string | null;
  businessId?: string | null;
  affiliateUserId?: string | null;
  offerId?: string | null;
  campaignId?: string | null;
  liveAdId?: string | null;
  payoutId?: string | null;
  walletTopupId?: string | null;
  walletRefundId?: string | null;
  walletDeductionId?: string | null;
  reasonCode?: string | null;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function writeMoneyFlowAudit(
  supabase: QueryClient,
  entry: MoneyFlowAuditEntry,
) {
  const row: Record<string, unknown> = {
    event_type: entry.eventType,
    severity: entry.severity || "info",
    source_route: entry.sourceRoute,
    entity_type: entry.entityType ?? null,
    entity_id: entry.entityId ?? null,
    business_email: entry.businessEmail ?? null,
    affiliate_email: entry.affiliateEmail ?? null,
    business_id: entry.businessId ?? null,
    affiliate_user_id: entry.affiliateUserId ?? null,
    offer_id: entry.offerId ?? null,
    campaign_id: entry.campaignId ?? null,
    live_ad_id: entry.liveAdId ?? null,
    payout_id: entry.payoutId ?? null,
    wallet_topup_id: entry.walletTopupId ?? null,
    wallet_refund_id: entry.walletRefundId ?? null,
    wallet_deduction_id: entry.walletDeductionId ?? null,
    reason_code: entry.reasonCode ?? null,
    message: entry.message ?? null,
    metadata: entry.metadata ?? null,
  };

  const { error } = await supabase.from("money_flow_audit_log").insert(row);

  if (error) {
    throw new Error(`Failed to write money flow audit log: ${error.message || error}`);
  }

  return { success: true };
}

export async function tryWriteMoneyFlowAudit(
  supabase: QueryClient,
  entry: MoneyFlowAuditEntry,
) {
  try {
    return await writeMoneyFlowAudit(supabase, entry);
  } catch (error) {
    console.error("[money-flow-audit] write failed", {
      eventType: entry.eventType,
      sourceRoute: entry.sourceRoute,
      error,
    });
    return { success: false, error };
  }
}

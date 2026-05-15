import { tryWriteMoneyFlowAudit } from '@/../utils/moneyFlowAudit';

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

export async function quarantineBillableEvent(
  supabase: QueryClient,
  params: {
    sourceRoute: string;
    reasonCode: string;
    message: string;
    eventId?: string | null;
    eventType?: string | null;
    rawCampaignId?: string | null;
    resolvedCampaignId?: string | null;
    offerId?: string | null;
    affiliateId?: string | null;
    rawPayload?: Record<string, unknown> | null;
    eventSnapshot?: Record<string, unknown> | null;
  },
) {
  const row: Record<string, unknown> = {
    event_id: params.eventId ?? null,
    source_route: params.sourceRoute,
    reason_code: params.reasonCode,
    message: params.message,
    event_type: params.eventType ?? null,
    raw_campaign_id: params.rawCampaignId ?? null,
    resolved_campaign_id: params.resolvedCampaignId ?? null,
    offer_id: params.offerId ?? null,
    affiliate_id: params.affiliateId ?? null,
    raw_payload: params.rawPayload ?? null,
    event_snapshot: params.eventSnapshot ?? null,
  };

  const { error } = await supabase.from('billable_event_quarantine').insert(row);

  if (error) {
    const message = String(error.message || error);
    if (params.eventId && message.toLowerCase().includes('duplicate')) {
      await tryWriteMoneyFlowAudit(supabase as never, {
        eventType: 'conversion_quarantine_decision',
        severity: 'warning',
        sourceRoute: params.sourceRoute,
        entityType: 'campaign_tracking_event',
        entityId: params.eventId,
        affiliateEmail: params.affiliateId ?? null,
        campaignId: params.resolvedCampaignId ?? params.rawCampaignId ?? null,
        offerId: params.offerId ?? null,
        reasonCode: `${params.reasonCode}_DUPLICATE`,
        message: params.message,
        metadata: {
          duplicate: true,
          rawCampaignId: params.rawCampaignId ?? null,
          resolvedCampaignId: params.resolvedCampaignId ?? null,
          eventType: params.eventType ?? null,
        },
      });
      return { success: true, duplicate: true };
    }
    throw new Error(`Failed to quarantine billable event: ${message}`);
  }

  await tryWriteMoneyFlowAudit(supabase as never, {
    eventType: 'conversion_quarantine_decision',
    severity: 'warning',
    sourceRoute: params.sourceRoute,
    entityType: 'campaign_tracking_event',
    entityId: params.eventId ?? null,
    affiliateEmail: params.affiliateId ?? null,
    campaignId: params.resolvedCampaignId ?? params.rawCampaignId ?? null,
    offerId: params.offerId ?? null,
    reasonCode: params.reasonCode,
    message: params.message,
    metadata: {
      duplicate: false,
      rawCampaignId: params.rawCampaignId ?? null,
      resolvedCampaignId: params.resolvedCampaignId ?? null,
      eventType: params.eventType ?? null,
      rawPayload: params.rawPayload ?? null,
      eventSnapshot: params.eventSnapshot ?? null,
    },
  });

  return { success: true, duplicate: false };
}

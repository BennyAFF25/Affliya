import { SupabaseClient } from "@supabase/supabase-js";

export type AffiliateWebhookEventType =
  | "brand.signed_up"
  | "brand.profile_updated"
  | "offer.created"
  | "offer.updated"
  | "meta.connected"
  | "meta.disconnected"
  | "plan.upgraded"
  | "plan.downgraded"
  | "proposal.viewed"
  | "proposal.approved"
  | "proposal.rejected"
  | "proposal.changes_requested"
  | "message.received"
  | "campaign.launched"
  | "campaign.paused"
  | "sale.attributed"
  | "brand.inactive";

type OutboxRow = {
  id: string;
  event_id: string;
  event_type: AffiliateWebhookEventType;
  business_id: string | null;
  business_email: string | null;
  offer_id: string | null;
  affiliate_email: string | null;
  entity_id: string | null;
  data: Record<string, unknown> | null;
  attempt_count: number;
  lease_token: string | null;
  created_at: string;
};

const ASSISTANT_SCOPED_TYPES = new Set<AffiliateWebhookEventType>([
  "proposal.viewed",
  "proposal.approved",
  "proposal.rejected",
  "proposal.changes_requested",
  "message.received",
  "campaign.launched",
  "campaign.paused",
  "sale.attributed",
]);

const RETRY_DELAYS_MS = [
  60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  12 * 60 * 60_000,
];

function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "https://www.nettmark.com"
  ).replace(/\/+$/, "");
}

function assistantEmail() {
  return String(process.env.AFFILIATE_ASSISTANT_EMAIL || "")
    .trim()
    .toLowerCase();
}

export function affiliateWebhookRetryDelayMs(attemptCount: number) {
  if (!Number.isFinite(attemptCount) || attemptCount < 1) {
    return RETRY_DELAYS_MS[0];
  }
  return RETRY_DELAYS_MS[attemptCount - 1] ?? null;
}

export function affiliateWebhookScopeDecision(
  eventType: AffiliateWebhookEventType,
  affiliateEmail: string | null | undefined,
  configuredAssistantEmail: string | null | undefined,
) {
  if (!ASSISTANT_SCOPED_TYPES.has(eventType)) return "deliver" as const;

  const expected = String(configuredAssistantEmail || "")
    .trim()
    .toLowerCase();
  if (!expected) return "missing_assistant" as const;

  return String(affiliateEmail || "").trim().toLowerCase() === expected
    ? ("deliver" as const)
    : ("skip" as const);
}

export async function enqueueAffiliateWebhookEvent(params: {
  supabase: SupabaseClient;
  eventType: AffiliateWebhookEventType;
  businessId?: string | null;
  businessEmail?: string | null;
  offerId?: string | null;
  affiliateEmail?: string | null;
  entityId?: string | null;
  data?: Record<string, unknown>;
  dedupeKey?: string | null;
}) {
  try {
    const { error } = await params.supabase
      .from("affiliate_webhook_outbox")
      .insert({
        event_type: params.eventType,
        business_id: params.businessId || null,
        business_email: params.businessEmail?.trim().toLowerCase() || null,
        offer_id: params.offerId || null,
        affiliate_email: params.affiliateEmail?.trim().toLowerCase() || null,
        entity_id: params.entityId || null,
        data: params.data || {},
        dedupe_key: params.dedupeKey || null,
      });

    if (error) {
      console.warn("[affiliate-webhook] enqueue failed", {
        eventType: params.eventType,
        code: error.code || null,
        message: error.message,
      });
      return false;
    }

    return true;
  } catch (error) {
    console.warn("[affiliate-webhook] enqueue failed", {
      eventType: params.eventType,
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

async function loadBrandSnapshot(supabase: SupabaseClient, row: OutboxRow) {
  let query = supabase
    .from("business_profiles")
    .select("id,business_email,business_name,country,avatar_url,created_at")
    .limit(1);

  if (row.business_id) {
    query = query.eq("id", row.business_id);
  } else if (row.business_email) {
    query = query.eq("business_email", row.business_email);
  } else {
    return null;
  }

  const { data: brand, error } = await query.maybeSingle();
  if (error || !brand) return null;

  const [
    { data: latestOffer },
    { data: entitlement },
    { data: metaRows },
  ] = await Promise.all([
    supabase
      .from("offers")
      .select("id,title,website,logo_url,hero_image_url,image_urls,created_at")
      .eq("business_email", brand.business_email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("business_entitlements")
      .select("billing_status")
      .eq("business_id", brand.id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("meta_connections")
      .select("id")
      .eq("business_email", brand.business_email)
      .limit(1),
  ]);

  const billingStatus = String(entitlement?.billing_status || "");
  const plan = [
    "subscription_active",
    "subscription_trialing",
    "subscription_past_due",
    "subscription_unpaid",
    "subscription_incomplete",
  ].includes(billingStatus)
    ? "growth"
    : "free";

  return {
    id: brand.id,
    name: brand.business_name || brand.business_email,
    website: latestOffer?.website || null,
    contact_first_name: null,
    timezone: null,
    country: brand.country || null,
    plan,
    meta_connected: Array.isArray(metaRows) && metaRows.length > 0,
    signed_up_at: brand.created_at || null,
    dashboard_url: siteUrl() + "/business/my-business",
  };
}

async function loadOfferSnapshot(
  supabase: SupabaseClient,
  offerId: string | null,
) {
  if (!offerId) return null;

  const { data: offer, error } = await supabase
    .from("offers")
    .select(
      "id,title,description,website,commission,commission_value,currency,price,type,logo_url,hero_image_url,image_urls,brand_guidelines,recurring_monthly_commission_value",
    )
    .eq("id", offerId)
    .maybeSingle();

  if (error || !offer) return null;

  const assets = [
    offer.logo_url ? { type: "logo", url: offer.logo_url } : null,
    offer.hero_image_url ? { type: "image", url: offer.hero_image_url } : null,
    ...(Array.isArray(offer.image_urls)
      ? offer.image_urls.map((url: string) => ({ type: "image", url }))
      : []),
  ].filter(Boolean);

  const recurring = offer.type === "recurring";

  return {
    offer_id: offer.id,
    title: offer.title,
    status: "active",
    commission_type: recurring ? "fixed_recurring" : "percent",
    commission_value: recurring
      ? Number(
          offer.recurring_monthly_commission_value ??
            offer.commission_value ??
            0,
        )
      : Number(offer.commission ?? offer.commission_value ?? 0),
    currency: offer.currency || "AUD",
    products: [],
    campaign_rules: offer.brand_guidelines || null,
    allowed_channels: ["facebook_ads", "organic"],
    restricted_claims: [],
    assets,
    landing_url: offer.website || null,
    target_audience: null,
  };
}

async function buildPayload(supabase: SupabaseClient, row: OutboxRow) {
  const brand = await loadBrandSnapshot(supabase, row);
  if (!brand) throw new Error("Business snapshot unavailable");

  const offer = await loadOfferSnapshot(supabase, row.offer_id);
  let data: Record<string, unknown> = { ...(row.data || {}) };

  if (row.event_type === "offer.created") {
    if (!offer) throw new Error("Offer snapshot unavailable");
    data = offer;
  } else if (row.event_type === "offer.updated") {
    if (!offer) throw new Error("Offer snapshot unavailable");
    data = {
      ...offer,
      changed_fields: Array.isArray(data.changed_fields)
        ? data.changed_fields
        : [],
    };
  } else if (row.event_type === "brand.profile_updated") {
    data = {
      ...data,
      logo_url: null,
      brand_colours: [],
      asset_urls: [],
    };
  }

  return {
    event_id: row.event_id,
    type: row.event_type,
    occurred_at: row.created_at,
    brand,
    data,
  };
}

async function updateOutbox(
  supabase: SupabaseClient,
  row: OutboxRow,
  patch: Record<string, unknown>,
) {
  if (!row.lease_token) return;

  const { error } = await supabase
    .from("affiliate_webhook_outbox")
    .update({
      ...patch,
      lease_token: null,
      lease_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("status", "sending")
    .eq("lease_token", row.lease_token);

  if (error) {
    console.warn("[affiliate-webhook] acknowledge failed", {
      eventId: row.event_id,
      message: error.message,
    });
  }
}

async function postWebhook(url: string, key: string, payload: unknown) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: "Bearer " + key,
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    return {
      ok: response.ok,
      status: response.status,
      error: response.ok ? null : "HTTP " + response.status,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function enqueueInactiveBrandEvents(
  supabase: SupabaseClient,
  inactiveDays = 7,
) {
  try {
    const { data, error } = await supabase.rpc(
      "enqueue_inactive_affiliate_webhook_events",
      { p_inactive_days: inactiveDays },
    );
    if (error) throw error;
    return Number(data || 0);
  } catch (error) {
    console.warn("[affiliate-webhook] inactive scan failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

export async function deliverPendingAffiliateWebhookEvents(
  supabase: SupabaseClient,
  options?: { limit?: number },
) {
  const url = String(process.env.AFFILIATE_WEBHOOK_URL || "").trim();
  const key = String(process.env.AFFILIATE_WEBHOOK_KEY || "").trim();
  const configuredAssistantEmail = assistantEmail();

  if (!url || !key || !configuredAssistantEmail) {
    return {
      sent: 0,
      skipped: 0,
      failed: 0,
      disabled: true,
      missing: [
        !url ? "AFFILIATE_WEBHOOK_URL" : null,
        !key ? "AFFILIATE_WEBHOOK_KEY" : null,
        !configuredAssistantEmail ? "AFFILIATE_ASSISTANT_EMAIL" : null,
      ].filter(Boolean),
    };
  }

  const { data, error } = await supabase.rpc(
    "claim_affiliate_webhook_delivery",
    { p_limit: options?.limit || 20 },
  );

  if (error) {
    throw new Error(
      "Could not claim affiliate webhook deliveries: " + error.message,
    );
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const raw of (data || []) as OutboxRow[]) {
    const decision = affiliateWebhookScopeDecision(
      raw.event_type,
      raw.affiliate_email,
      configuredAssistantEmail,
    );

    if (decision === "skip") {
      skipped += 1;
      await updateOutbox(supabase, raw, {
        status: "skipped",
        delivered_at: new Date().toISOString(),
        last_error: "Event belonged to a different affiliate account.",
      });
      continue;
    }

    try {
      const payload = await buildPayload(supabase, raw);
      const result = await postWebhook(url, key, payload);

      if (result.ok) {
        sent += 1;
        await updateOutbox(supabase, raw, {
          status: "delivered",
          delivered_at: new Date().toISOString(),
          last_http_status: result.status,
          last_error: null,
        });
        continue;
      }

      failed += 1;
      const retryDelay = affiliateWebhookRetryDelayMs(raw.attempt_count);
      await updateOutbox(supabase, raw, {
        status: retryDelay == null ? "failed" : "pending",
        next_attempt_at:
          retryDelay == null
            ? new Date().toISOString()
            : new Date(Date.now() + retryDelay).toISOString(),
        last_http_status: result.status,
        last_error: String(result.error || "Webhook delivery failed").slice(
          0,
          1000,
        ),
      });
    } catch (error) {
      failed += 1;
      const retryDelay = affiliateWebhookRetryDelayMs(raw.attempt_count);
      await updateOutbox(supabase, raw, {
        status: retryDelay == null ? "failed" : "pending",
        next_attempt_at:
          retryDelay == null
            ? new Date().toISOString()
            : new Date(Date.now() + retryDelay).toISOString(),
        last_error: (
          error instanceof Error ? error.message : String(error)
        ).slice(0, 1000),
      });
    }
  }

  return { sent, skipped, failed, disabled: false };
}

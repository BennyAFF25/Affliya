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
  | "message.received";

export type AffiliateWebhookBrand = {
  id: string;
  name: string;
  website: string | null;
  contact_first_name: string | null;
  timezone: string | null;
  country: string | null;
  plan: "free" | "growth";
  meta_connected: boolean;
  signed_up_at: string | null;
  dashboard_url: string;
};

export type AffiliateWebhookPayload = {
  event_id: string;
  type: AffiliateWebhookEventType;
  occurred_at: string;
  brand: AffiliateWebhookBrand;
  data: Record<string, unknown>;
};

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

export const AFFILIATE_ASSISTANT_EMAIL = "jamesmarkets@gmail.com";

const ASSISTANT_SCOPED_TYPES = new Set<AffiliateWebhookEventType>([
  "proposal.viewed",
  "proposal.approved",
  "proposal.rejected",
  "proposal.changes_requested",
  "message.received",
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

function isoWithOffset(value: string | number | Date) {
  return new Date(value).toISOString().replace(/Z$/, "+00:00");
}

export function isAffiliateAssistantEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase() === AFFILIATE_ASSISTANT_EMAIL;
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
  targetAffiliateEmail = AFFILIATE_ASSISTANT_EMAIL,
) {
  if (!ASSISTANT_SCOPED_TYPES.has(eventType)) return "deliver" as const;

  const expected = String(targetAffiliateEmail || "")
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
  } satisfies AffiliateWebhookBrand;
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

async function buildPayload(
  supabase: SupabaseClient,
  row: OutboxRow,
): Promise<AffiliateWebhookPayload> {
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
    occurred_at: isoWithOffset(row.created_at),
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

export async function sendAffiliateEvent(payload: AffiliateWebhookPayload) {
  const url = process.env.AFFILIATE_WEBHOOK_URL;
  const authorization = process.env.AFFILIATE_WEBHOOK_AUTH;

  if (!url?.trim() || !authorization?.trim()) {
    const missing = [
      !url?.trim() ? "AFFILIATE_WEBHOOK_URL" : null,
      !authorization?.trim() ? "AFFILIATE_WEBHOOK_AUTH" : null,
    ].filter(Boolean);

    console.warn("[affiliate-webhook] delivery disabled; missing env", {
      missing,
      eventId: payload.event_id,
      eventType: payload.type,
    });

    return {
      ok: false as const,
      status: null as number | null,
      error: "missing_webhook_configuration",
      disabled: true as const,
      attempts: 0,
      missing,
    };
  }

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authorization,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      console[response.ok ? "info" : "warn"]("[affiliate-webhook] response", {
        eventId: payload.event_id,
        eventType: payload.type,
        attempt,
        status: response.status,
      });

      if (response.ok) {
        return {
          ok: true as const,
          status: response.status,
          error: null,
          disabled: false as const,
          attempts: attempt,
          missing: [] as string[],
        };
      }

      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        continue;
      }

      return {
        ok: false as const,
        status: response.status,
        error: "HTTP " + response.status,
        disabled: false as const,
        attempts: attempt,
        missing: [] as string[],
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      console.warn("[affiliate-webhook] request failed", {
        eventId: payload.event_id,
        eventType: payload.type,
        attempt,
        message,
      });

      return {
        ok: false as const,
        status: null as number | null,
        error: message,
        disabled: false as const,
        attempts: attempt,
        missing: [] as string[],
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    ok: false as const,
    status: null as number | null,
    error: "webhook_delivery_failed",
    disabled: false as const,
    attempts: 2,
    missing: [] as string[],
  };
}

export function createAffiliateWebhookTestPayload(): AffiliateWebhookPayload {
  const now = isoWithOffset(new Date());

  return {
    event_id: "evt_test_" + Date.now(),
    type: "brand.signed_up",
    occurred_at: now,
    brand: {
      id: "webhook-test",
      name: "Webhook Test",
      website: "https://www.nettmark.com",
      contact_first_name: "Webhook",
      timezone: "Australia/Adelaide",
      country: "AU",
      plan: "free",
      meta_connected: false,
      signed_up_at: now,
      dashboard_url: "https://www.nettmark.com/business/my-business",
    },
    data: {
      signup_source: "admin_test",
      category: "test",
    },
  };
}

export async function deliverPendingAffiliateWebhookEvents(
  supabase: SupabaseClient,
  options?: { limit?: number },
) {
  const missing = [
    !process.env.AFFILIATE_WEBHOOK_URL?.trim() ? "AFFILIATE_WEBHOOK_URL" : null,
    !process.env.AFFILIATE_WEBHOOK_AUTH?.trim() ? "AFFILIATE_WEBHOOK_AUTH" : null,
  ].filter(Boolean);

  if (missing.length > 0) {
    return {
      sent: 0,
      skipped: 0,
      failed: 0,
      disabled: true,
      missing,
    };
  }

  const { data, error } = await supabase.rpc(
    "claim_affiliate_webhook_delivery",
    { p_limit: options?.limit || 20 },
  );

  if (error) {
    const code = String(error.code || "");
    if (["PGRST202", "42883", "42P01"].includes(code)) {
      return {
        sent: 0,
        skipped: 0,
        failed: 0,
        disabled: true,
        missing: ["affiliate webhook database migration"],
      };
    }

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
      const result = await sendAffiliateEvent(payload);

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

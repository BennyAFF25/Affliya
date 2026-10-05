import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { canAccessMarketingDashboard } from "./internalAccess";

export type TrialSubscription = {
  id: string; livemode: boolean; status: string;
  trial_start: number | null; trial_end: number | null;
  metadata: Record<string, string>;
  items: { data: { price: { id: string }; quantity?: number | null }[] };
};
export type Matching = {
  fbp?: string; fbc?: string; client_ip_address?: string; client_user_agent?: string;
};
export type StartTrialPayload = {
  event_name: "StartTrial"; event_time: number; event_id: string;
  action_source: "website"; event_source_url: string;
  user_data: Matching & { em: string[]; external_id: string[] };
};
export function hashMeta(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function excludedTrialEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const domain = normalized.split("@")[1] || "";
  return canAccessMarketingDashboard(normalized) ||
    /^(example\.(com|net|org)|localhost)$/.test(domain) ||
    /\.(test|invalid|example|localhost)$/.test(domain) ||
    /^(test|dummy|internal-test)(\+[^@]*)?@/.test(normalized);
}
function metaCookie(value: unknown, type: "fbp" | "fbc", now: number) {
  if (typeof value !== "string" || value.length > 512) return undefined;
  const match = /^fb\.[0-9]+\.([0-9]{13})\.([A-Za-z0-9_-]+)$/.exec(value);
  if (!match || (type === "fbp" && !/^[0-9]+$/.test(match[2]))) return undefined;
  const time = Number(match[1]);
  if (time > now + 300_000 || time < now - 90 * 86400_000) return undefined;
  return value;
}
export function sanitizeMatching(input: Record<string, unknown>, now = Date.now()): Matching {
  const fbp = metaCookie(input.fbp, "fbp", now);
  const fbc = metaCookie(input.fbc, "fbc", now);
  const ip = typeof input.client_ip_address === "string" ? input.client_ip_address.trim() : "";
  const ua = typeof input.client_user_agent === "string" ? input.client_user_agent.trim().slice(0, 500) : "";
  return {
    ...(fbp ? { fbp } : {}), ...(fbc ? { fbc } : {}),
    ...(isIP(ip) ? { client_ip_address: ip } : {}),
    // Reject control characters in user-agent input.
    // eslint-disable-next-line no-control-regex
    ...(ua && !/[\u0000-\u001f\u007f]/.test(ua) ? { client_user_agent: ua } : {}),
  };
}
export function checkoutMatching(req: Request, now = Date.now()): Matching {
  const values: Record<string, unknown> = {};
  for (const part of (req.headers.get("cookie") || "").split(";")) {
    const index = part.indexOf("=");
    const name = part.slice(0, index).trim();
    if (index < 0 || (name !== "_fbp" && name !== "_fbc")) continue;
    try { values[name.slice(1)] = decodeURIComponent(part.slice(index + 1)); } catch { /* ignore malformed cookie */ }
  }
  // Vercel's trusted proxy header identifies the customer request, never the Stripe webhook.
  values.client_ip_address = req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  values.client_user_agent = req.headers.get("user-agent");
  return sanitizeMatching(values, now);
}
export function buildStartTrial(params: {
  subscription: TrialSubscription; eventLivemode: boolean;
  businessId: string; userId: string; email: string;
  priceId: string; trialDays: number; matching?: Matching;
  now?: number; allowInternalForTest?: boolean;
}): StartTrialPayload | null {
  const s = params.subscription;
  const now = params.now ?? Math.floor(Date.now() / 1000);
  const email = params.email.trim().toLowerCase();
  if (!params.eventLivemode || !s.livemode || s.status !== "trialing" ||
      !s.trial_start || !s.trial_end || s.trial_end - s.trial_start !== params.trialDays * 86400 ||
      s.trial_start > now + 300 || s.trial_start < now - 6 * 86400 ||
      !params.priceId || s.items.data.length !== 1 || s.items.data[0].price.id !== params.priceId ||
      s.items.data[0].quantity !== 1 ||
      s.metadata.nettmark_platform !== "nettmark" || s.metadata.nettmark_action !== "business_subscription" ||
      s.metadata.business_id !== params.businessId || s.metadata.user_id !== params.userId ||
      s.metadata.business_email?.trim().toLowerCase() !== email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      (!params.allowInternalForTest && excludedTrialEmail(email))) return null;
  return {
    event_name: "StartTrial", event_time: s.trial_start,
    event_id: "nettmark_growth_trial_" + hashMeta(params.businessId),
    action_source: "website", event_source_url: "https://www.nettmark.com/business/choose-plan",
    user_data: {
      em: [hashMeta(email)], external_id: [hashMeta(params.userId.trim().toLowerCase())],
      ...sanitizeMatching(params.matching || {}, now * 1000),
    },
  };
}
export function retryDelaySeconds(attempt: number) {
  return Math.min(1800, 60 * 2 ** Math.min(Math.max(attempt - 1, 0), 5));
}
export async function sendStartTrial(params: {
  payload: StartTrialPayload; token: string; pixelId: string;
  testEventCode?: string; fetcher?: typeof fetch;
}): Promise<{ ok: boolean; error: string | null }> {
  if (!params.token || !/^[0-9]+$/.test(params.pixelId)) return { ok: false, error: "configuration_missing" };
  try {
    const response = await (params.fetcher || fetch)(
      "https://graph.facebook.com/v23.0/" + params.pixelId + "/events",
      {
        method: "POST",
        headers: { Authorization: "Bearer " + params.token, "Content-Type": "application/json" },
        body: JSON.stringify({ data: [params.payload], ...(params.testEventCode ? { test_event_code: params.testEventCode } : {}) }),
        signal: AbortSignal.timeout(8000),
      },
    );
    // Never log error bodies: they may contain matching data or credential details.
    if (!response.ok) return { ok: false, error: "meta_http_" + response.status };
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || !("events_received" in body) || body.events_received !== 1) {
      return { ok: false, error: "meta_ack_missing" };
    }
    return { ok: true, error: null };
  } catch { return { ok: false, error: "meta_request_failed" }; }
}

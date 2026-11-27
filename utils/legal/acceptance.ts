import type { SupabaseClient } from "@supabase/supabase-js";
import { TERMS_VERSION } from "./version";

export type LegalAcceptanceContext = "signup" | "trial_start" | "paid_start" | "modal";
export const CHECKOUT_ACCEPTANCE_MAX_AGE_MS = 30 * 60_000;

/** First x-forwarded-for hop (as set by Vercel), only if it parses as an IP for the inet column. */
export function clientIpFromHeaders(headers: Headers) {
  const raw = (headers.get("x-forwarded-for") || headers.get("x-real-ip") || "").split(",")[0]?.trim() || "";
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(raw) && raw.split(".").every(part => Number(part) <= 255)) return raw;
  if (/^[0-9a-f:]+$/i.test(raw) && raw.includes(":") && raw.length <= 45) return raw;
  return null;
}

export function userAgentFromHeaders(headers: Headers) {
  return (headers.get("user-agent") || "").slice(0, 512) || null;
}

/**
 * Append-only evidence row, written with the service role, then mirrored to
 * profiles.terms_accepted* for older checks. Returns the acceptance id.
 */
export async function recordLegalAcceptance(admin: SupabaseClient, params: {
  userId: string;
  businessId?: string | null;
  context: LegalAcceptanceContext;
  summaryText?: string | null;
  ip: string | null;
  userAgent: string | null;
  version?: string;
}) {
  const acceptedAt = new Date().toISOString();
  const version = params.version || TERMS_VERSION;
  const { data, error } = await admin.from("legal_acceptances").insert({
    user_id: params.userId,
    business_id: params.businessId || null,
    document: "terms",
    version,
    context: params.context,
    summary_text: params.summaryText ? String(params.summaryText).slice(0, 4000) : null,
    ip: params.ip,
    user_agent: params.userAgent,
    accepted_at: acceptedAt,
  }).select("id").single();
  if (error || !data?.id) throw new Error("Could not record terms acceptance.");
  const { error: profileError } = await admin.from("profiles")
    .update({ terms_accepted: true, terms_accepted_at: acceptedAt, terms_version: version })
    .eq("id", params.userId);
  if (profileError) console.warn("[legal/accept] acceptance recorded; profile mirror failed", { context: params.context });
  return { id: String(data.id), acceptedAt };
}

/** Latest trial/paid-start acceptance for the current Terms, recorded in the last 30 minutes. */
export async function findFreshCheckoutAcceptance(admin: SupabaseClient, params: {
  userId: string; businessId: string; context: "trial_start" | "paid_start"; now?: number;
}) {
  const since = new Date((params.now ?? Date.now()) - CHECKOUT_ACCEPTANCE_MAX_AGE_MS).toISOString();
  const { data, error } = await admin.from("legal_acceptances")
    .select("id,accepted_at")
    .eq("user_id", params.userId)
    .eq("business_id", params.businessId)
    .eq("document", "terms")
    .eq("version", TERMS_VERSION)
    .eq("context", params.context)
    .gte("accepted_at", since)
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Could not verify terms acceptance.");
  return data?.id ? String(data.id) : null;
}

/** Link the evidence row to Stripe once (only fills empty columns). Never throws. */
export async function linkAcceptanceToStripe(admin: SupabaseClient, acceptanceId: string | null | undefined, ids: {
  checkoutSessionId?: string | null; subscriptionId?: string | null;
}) {
  if (!acceptanceId || !/^[0-9a-f-]{36}$/i.test(acceptanceId)) return;
  try {
    if (ids.checkoutSessionId) {
      await admin.from("legal_acceptances").update({ stripe_checkout_session_id: ids.checkoutSessionId })
        .eq("id", acceptanceId).is("stripe_checkout_session_id", null);
    }
    if (ids.subscriptionId) {
      await admin.from("legal_acceptances").update({ stripe_subscription_id: ids.subscriptionId })
        .eq("id", acceptanceId).is("stripe_subscription_id", null);
    }
  } catch {
    console.warn("[legal/accept] Stripe link failed", { acceptanceId });
  }
}

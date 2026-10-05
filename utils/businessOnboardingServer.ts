import type { SupabaseClient } from "@supabase/supabase-js";
import { businessFunnelMetadata } from "./businessOnboardingFunnel";

export async function getBusinessFunnelMetadata(supabase: SupabaseClient, businessId: string) {
  const { data, error } = await supabase.from("profiles").select("created_at,role").eq("id", businessId).maybeSingle();
  if (error) throw new Error("Could not verify business signup cohort.");
  if (!data || data.role !== "business") return { business_id: businessId, business_onboarding_funnel: "pre_experiment" };
  return businessFunnelMetadata(businessId, data.created_at);
}
export async function recordBusinessFunnelEvent(supabase: SupabaseClient, params: {
  eventType: string; businessId: string; email: string; offerId?: string | null; meta?: Record<string, unknown>;
}) {
  // Event transport must not roll back a successful business action.
  try {
    const cohort = await getBusinessFunnelMetadata(supabase, params.businessId);
    const { error } = await supabase.from("product_events").insert({
      event_type: params.eventType, actor_role: "business", actor_email: params.email,
      offer_id: params.offerId || null, meta: { ...params.meta, ...cohort },
    });
    if (error) console.warn("[business-funnel] event not recorded", { eventType: params.eventType, code: error.code });
  } catch {
    console.warn("[business-funnel] cohort event unavailable", { eventType: params.eventType });
  }
}

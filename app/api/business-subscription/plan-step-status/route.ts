import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "../../../../utils/businessSubscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Business plan choice is a UX routing guard, NOT an entitlement
// or authorization gate; paid launch checks its own authoritative permissions.
export async function GET() {
  const session = createRouteHandlerClient({ cookies });
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user?.id || !user.email) return NextResponse.json({ required: false }, { status: 401 });
  const admin = createServerSupabaseClient();
  const [{ data: profile, error: profileError }, { data: entitlement, error: entitlementError }, { data: freeChoice, error: freeError }] = await Promise.all([
    admin.from("profiles").select("role,onboarding_completed").eq("id", user.id).maybeSingle(),
    admin.from("business_entitlements").select("billing_status,is_grandfathered,stripe_subscription_id").eq("business_email", user.email).maybeSingle(),
    admin.from("product_events").select("id").eq("actor_email", user.email).eq("event_type", "plan_free_clicked").contains("meta", { choice_confirmed: true }).limit(1).maybeSingle(),
  ]);
  if (profileError || entitlementError || freeError || !profile) {
    return NextResponse.json({ error: "Could not verify your plan choice." }, { status: 503 });
  }
  if (profile.role !== "business") return NextResponse.json({ required: false }, { status: 403 });
  const selected = Boolean(freeChoice || entitlement?.is_grandfathered || entitlement?.stripe_subscription_id ||
    ["subscription_trialing", "subscription_active", "subscription_past_due", "subscription_unpaid", "subscription_incomplete"].includes(entitlement?.billing_status || ""));
  return NextResponse.json({ required: !selected, onboardingCompleted: profile.onboarding_completed === true }, { headers: { "Cache-Control": "private, no-store" } });
}

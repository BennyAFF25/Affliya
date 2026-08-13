import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { createStripeClient } from "@/../utils/stripe";

const admin = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function getUserEmail() {
  const cookieStore = cookies();
  const userSupabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data, error } = await userSupabase.auth.getUser();
  if (error || !data.user?.email) return null;
  return data.user.email;
}

async function loadProfile(email: string) {
  const { data, error } = await admin
    .from("business_profiles")
    .select("id,business_email,stripe_customer_id,stripe_account_id,stripe_onboarding_complete")
    .eq("business_email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as {
    id?: string | null;
    business_email?: string | null;
    stripe_customer_id?: string | null;
    stripe_account_id?: string | null;
    stripe_onboarding_complete?: boolean | null;
  } | null;
}

export async function GET() {
  try {
    const email = await getUserEmail();
    if (!email) {
      return NextResponse.json({ success: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const profile = await loadProfile(email);
    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error("[stripe/business-billing-profile GET]", error);
    return NextResponse.json(
      { success: false, error: "PROFILE_LOOKUP_FAILED", message: error instanceof Error ? error.message : "Could not load billing profile." },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    const email = await getUserEmail();
    if (!email) {
      return NextResponse.json({ success: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const existing = await loadProfile(email);
    if (existing?.stripe_customer_id) {
      return NextResponse.json({ success: true, customerId: existing.stripe_customer_id, profile: existing, created: false });
    }

    const stripe = createStripeClient();
    const customer = await stripe.customers.create({ email, name: "Business" });

    let profile = existing;
    if (existing?.id) {
      const { data, error } = await admin
        .from("business_profiles")
        .update({
          stripe_customer_id: customer.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("id,business_email,stripe_customer_id,stripe_account_id,stripe_onboarding_complete")
        .single();
      if (error) throw error;
      profile = data as typeof profile;
    } else {
      const { data, error } = await admin
        .from("business_profiles")
        .insert({
          business_email: email,
          stripe_customer_id: customer.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("id,business_email,stripe_customer_id,stripe_account_id,stripe_onboarding_complete")
        .single();
      if (error) throw error;
      profile = data as typeof profile;
    }

    console.log("[stripe/business-billing-profile] customer ready", {
      businessEmail: email,
      customerId: customer.id,
      profileId: profile?.id,
    });

    return NextResponse.json({ success: true, customerId: customer.id, profile, created: true });
  } catch (error) {
    console.error("[stripe/business-billing-profile POST]", error);
    return NextResponse.json(
      { success: false, error: "CUSTOMER_CREATE_FAILED", message: error instanceof Error ? error.message : "Could not connect billing." },
      { status: 500 },
    );
  }
}

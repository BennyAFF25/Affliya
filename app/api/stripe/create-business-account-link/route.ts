import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// To create a Stripe account for a specific country, pass the ISO country code (e.g., 'US', 'AU', 'GB') in the request body as the 'country' parameter. If no country is provided, it defaults to 'US'.

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Service role so you can update without RLS issues
);

export async function POST(req: Request) {
  try {
    const { businessEmail, businessName, country } = await req.json();

    if (!businessEmail) {
      return NextResponse.json(
        { error: "Missing business email." },
        { status: 400 }
      );
    }

    // Log the country used for creating the Stripe account
    console.log('[🌍 Creating Stripe account for country]', country || 'US');
    // 1️⃣ Create Stripe Express account
    const account = await stripe.accounts.create({
      type: "express",
      email: businessEmail,
      country: country || "US", // fallback if not provided
      business_type: "individual",
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
      metadata: {
        business_name: businessName || "",
      },
    });

    // Upsert Stripe Account info in Supabase to ensure record exists immediately
    const { error: upsertError } = await supabase
      .from("business_profiles")
      .upsert(
        {
          business_email: businessEmail,
          stripe_account_id: account.id,
          stripe_onboarding_complete: false,
          country: account.country,
          business_name: account.metadata?.business_name || '',
          status: 'created'
        },
        {
          onConflict: 'business_email'
        }
      );

    if (upsertError) {
      console.error("[❌ Supabase Upsert Error]", upsertError);
      return NextResponse.json(
        { error: "Failed to save Stripe account info." },
        { status: 500 }
      );
    }

    // 3️⃣ Create the onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: "http://localhost:3000/business/my-business",
      return_url: "http://localhost:3000/business/my-business",
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (err: any) {
    console.error("[❌ Stripe Error]", err);
    return NextResponse.json(
      { error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
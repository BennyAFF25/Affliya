import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Server-only: this endpoint is deprecated for business onboarding
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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

    return NextResponse.json(
      {
        error:
          "Business Connect onboarding is disabled. Use /api/stripe/create-customer instead.",
      },
      { status: 410 }
    );
  } catch (err: any) {
    console.error("[❌ Stripe Error]", err);
    return NextResponse.json(
      { error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
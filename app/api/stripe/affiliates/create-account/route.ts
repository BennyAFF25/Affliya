import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const stripeSecret = (process.env.STRIPE_SECRET_KEY || "").trim();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: Request) {
  try {
    if (!stripeSecret) {
      return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
    }
    if (!supabaseUrl || !serviceRole) {
      return NextResponse.json({ error: "Missing Supabase env keys" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({} as any));

    // You can send these from the client (recommended):
    // { user_id, email }
    const userId = body?.user_id as string | undefined;
    const email = body?.email as string | undefined;

    if (!userId || !email) {
      return NextResponse.json(
        { error: "Missing user_id or email in request body" },
        { status: 400 }
      );
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: "2025-08-27.basil" as any });

    const isLive = stripeSecret.startsWith("sk_live_");
    const origin = body?.origin || "https://www.nettmark.com"; // safe default for prod

    const refreshUrl =
      body?.refresh_url || `${origin}/affiliate/wallet?onboarding=refresh`;
    const returnUrl =
      body?.return_url || `${origin}/affiliate/wallet?onboarding=return`;

    const supabase = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false },
    });

    // 1) Check if we already have a connected acct saved for this affiliate
    const { data: ap, error: apErr } = await supabase
      .from("affiliate_profiles")
      .select("stripe_account_id,email,user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (apErr) {
      console.error("[affiliates/create-account] read affiliate_profiles error", apErr);
      return NextResponse.json({ error: apErr.message }, { status: 500 });
    }

    let accountId = ap?.stripe_account_id || null;
    let reusedExisting = false;

    // 2) Create account if none exists
    if (!accountId) {
      const acct = await stripe.accounts.create({
        type: "express",
        country: "AU",
        email,
        business_type: "individual", // ✅ forces individual flow
        metadata: {
          role: "affiliate",
          user_id: userId,
          app: "nettmark",
        },
        capabilities: {
          transfers: { requested: true },
        },
      });

      accountId = acct.id;
      reusedExisting = false;

      // 3) Persist accountId immediately (this is the missing piece)
      const { error: upErr } = await supabase
        .from("affiliate_profiles")
        .upsert(
          {
            user_id: userId,
            email,
            stripe_account_id: accountId,
            stripe_onboarding_complete: false,
          },
          { onConflict: "user_id" }
        );

      if (upErr) {
        console.error("[affiliates/create-account] upsert affiliate_profiles error", upErr);
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }
    } else {
      reusedExisting = true;

      // Keep email aligned (optional)
      await supabase
        .from("affiliate_profiles")
        .update({ email })
        .eq("user_id", userId);
    }

    // 4) Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    console.log("[affiliates/create-account] urls", {
      refreshUrl,
      returnUrl,
      account: accountId,
      reusedExisting,
    });

    return NextResponse.json({
      url: accountLink.url,
      accountId,
      reusedExisting,
      mode: isLive ? "live" : "test",
    });
  } catch (err: any) {
    console.error("[affiliates/create-account] error", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
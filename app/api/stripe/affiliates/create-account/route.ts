// app/api/stripe/affiliates/create-account/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-08-27.basil",
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

function bad(msg: string, extra?: any) {
  console.error("[affiliates/create-account] ❌", msg, extra ?? "");
  return NextResponse.json({ error: msg, extra }, { status: 400 });
}

export async function POST(req: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) return bad("Missing STRIPE_SECRET_KEY");
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return bad("Missing NEXT_PUBLIC_SUPABASE_URL");
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return bad("Missing SUPABASE_SERVICE_ROLE_KEY");

    const body = await req.json().catch(() => ({}));

    const user_id = body?.user_id as string | undefined;
    const email = body?.email as string | undefined;

    if (!user_id && !email) return bad("Missing user_id or email");

    // 1) Create Express account
    const account = await stripe.accounts.create({
      type: "express",
      country: "AU",
      email: email,
      capabilities: {
        transfers: { requested: true },
      },
    });

    // 2) Persist immediately to DB (THIS is the missing/failed bit in your current setup)
    const upsertPayload: any = {
      user_id: user_id ?? null,
      email: email ?? null,
      stripe_account_id: account.id,
      stripe_onboarding_complete: false,
    };

    // IMPORTANT: your table PK is user_id, so user_id MUST be present
    if (!user_id) return bad("user_id is required because affiliate_profiles primary key = user_id");

    const { error: upsertErr } = await supabase
      .from("affiliate_profiles")
      .upsert(upsertPayload, { onConflict: "user_id" });

    if (upsertErr) {
      console.error("[affiliates/create-account] ❌ upsert affiliate_profiles failed", upsertErr);
      return NextResponse.json(
        { error: "DB upsert failed", details: upsertErr },
        { status: 500 }
      );
    }

    console.log("[affiliates/create-account] ✅ saved affiliate_profiles", {
      user_id,
      email,
      stripe_account_id: account.id,
    });

    // 3) Create onboarding link
    const origin = req.headers.get("origin") || "https://www.nettmark.com";
    const refreshUrl = `${origin}/affiliate/wallet?onboarding=refresh`;
    const returnUrl = `${origin}/affiliate/wallet?onboarding=return`;

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    return NextResponse.json({
      accountId: account.id,
      url: accountLink.url,
    });
  } catch (e: any) {
    console.error("[affiliates/create-account] ❌ unexpected", e?.message || e);
    return NextResponse.json({ error: "Server error", details: e?.message }, { status: 500 });
  }
}
import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY || "").trim(), {
  apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
});

function getBaseUrl() {
  const rawExplicit = process.env.NEXT_PUBLIC_BASE_URL || "";
  const explicit = rawExplicit
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/^['"]|['"]$/g, "");

  const rawVercel = process.env.VERCEL_URL || "";
  const vercel = rawVercel
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/^['"]|['"]$/g, "");

  const fromVercel = vercel ? `https://${vercel}` : "";
  const fallbackLocal = "http://localhost:3000";

  const base = explicit || fromVercel || fallbackLocal;

  let u: URL;
  try {
    u = new URL(base);
  } catch {
    throw new Error(
      `Invalid BASE URL. Got "${base}". NEXT_PUBLIC_BASE_URL="${rawExplicit}" VERCEL_URL="${rawVercel}"`
    );
  }

  const isLive = (process.env.STRIPE_SECRET_KEY || "").startsWith("sk_live_");
  if (isLive && u.protocol !== "https:" && u.hostname !== "localhost") {
    throw new Error(`Live mode requires https URLs. Got "${u.origin}".`);
  }

  return u.origin;
}

function absUrl(pathname: string) {
  return new URL(pathname, getBaseUrl()).toString();
}

export async function POST(req: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Missing STRIPE_SECRET_KEY" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));

    // Accept multiple sources so the endpoint never breaks if the frontend changes.
    // Priority: body -> querystring -> header
    const url = new URL(req.url);

    const emailFromBody = (
      body?.email ||
      body?.affiliate_email ||
      body?.affiliateEmail ||
      body?.user_email ||
      body?.userEmail ||
      ""
    )
      .toString()
      .trim();

    const emailFromQuery = (url.searchParams.get("email") || "").toString().trim();
    const emailFromHeader = (req.headers.get("x-user-email") || "").toString().trim();

    const email = (emailFromBody || emailFromQuery || emailFromHeader)
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .trim();

    const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    let baseUrlForLog: string | null = null;
    try {
      baseUrlForLog = getBaseUrl();
    } catch {
      baseUrlForLog = null;
    }

    console.log("[affiliates/create-account] incoming", {
      hasBody: !!body,
      bodyKeys: body && typeof body === "object" ? Object.keys(body) : null,
      email: email || null,
      emailSources: {
        body: emailFromBody || null,
        query: emailFromQuery || null,
        header: emailFromHeader || null,
      },
      baseUrl: baseUrlForLog,
      mode: (process.env.STRIPE_SECRET_KEY || "").startsWith("sk_live_") ? "live" : "test",
    });

    if (!email) {
      return NextResponse.json(
        {
          error:
            "Missing email. Provide it in JSON body (email/affiliateEmail), query (?email=), or header (x-user-email).",
        },
        { status: 400 }
      );
    }

    if (!looksLikeEmail) {
      return NextResponse.json(
        { error: `Invalid email format: "${email}"` },
        { status: 400 }
      );
    }

    const existingAccountId = (
      body?.stripe_account_id ||
      body?.stripeAccountId ||
      body?.account_id ||
      body?.accountId ||
      ""
    )
      .toString()
      .trim();

    // If an account already exists for this affiliate in your DB, pass it in so we can re-create an onboarding link.
    const account = existingAccountId
      ? await stripe.accounts.retrieve(existingAccountId)
      : await stripe.accounts.create({
          // Affiliate payouts: keep this strictly INDIVIDUAL (no business fields required)
          type: "express",
          business_type: "individual",
          email,
          capabilities: { transfers: { requested: true } },
          metadata: { email, platform: "nettmark", role: "affiliate" },
        });

    // Safety: never onboard affiliates into a business-style account.
    // If an existing account id was passed in, ensure it is an Express + Individual account.
    if (existingAccountId) {
      const acct: any = account;
      const acctType = acct?.type;
      const businessType = acct?.business_type;
      if (acctType && acctType !== "express") {
        return NextResponse.json(
          { error: `Invalid affiliate payout account type: ${acctType}. Expected "express".` },
          { status: 400 }
        );
      }
      if (businessType && businessType !== "individual") {
        return NextResponse.json(
          { error: `Invalid affiliate payout business_type: ${businessType}. Expected "individual".` },
          { status: 400 }
        );
      }
    }

    // Default landing pages (can be overridden by frontend if needed)
    const refreshPath = (body?.refresh_path || body?.refreshPath || "/affiliate/wallet?onboarding=refresh")
      .toString()
      .trim();
    const returnPath = (body?.return_path || body?.returnPath || "/affiliate/wallet?onboarding=return")
      .toString()
      .trim();

    const refreshUrl = absUrl(refreshPath.startsWith("/") ? refreshPath : `/${refreshPath}`);
    const returnUrl = absUrl(returnPath.startsWith("/") ? returnPath : `/${returnPath}`);

    const accountId = (account as any)?.id;

    console.log("[affiliates/create-account] urls", {
      refreshUrl,
      returnUrl,
      account: accountId,
      reusedExisting: !!existingAccountId,
    });

    if (!accountId) {
      return NextResponse.json(
        { error: "Stripe account id missing after create/retrieve." },
        { status: 500 }
      );
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    return NextResponse.json(
      { stripe_account_id: accountId, url: accountLink.url },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[❌ affiliates/create-account]", {
      message: err?.message,
      stack: err?.stack,
    });

    return NextResponse.json(
      { error: err?.message || "Create account failed" },
      { status: 500 }
    );
  }
}
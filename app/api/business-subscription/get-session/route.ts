import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createBusinessSubscriptionStripeClient, createServerSupabaseClient, getOwnedBusinessForUser, getEntitlementOrThrow } from "../../../../utils/businessSubscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const userClient = createRouteHandlerClient({ cookies });
    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const sessionId = new URL(req.url).searchParams.get("session_id");
    if (!sessionId) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    const stripe = createBusinessSubscriptionStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const businessId = session.metadata?.business_id || "";
    const admin = createServerSupabaseClient();
    const business = await getOwnedBusinessForUser({ supabase: admin, businessId, userId: user.id, userEmail: user.email });
    if (!business || session.metadata?.user_id !== user.id || session.metadata?.nettmark_action !== "business_subscription" || session.mode !== "subscription") {
      return NextResponse.json({ error: "Checkout not found" }, { status: 403 });
    }
    const entitlement = await getEntitlementOrThrow({ supabase: admin, businessId });
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id || null;
    const response = NextResponse.json({
      status: session.status, paymentStatus: session.payment_status, subscriptionId,
      billingStatus: entitlement.stripeSubscriptionId === subscriptionId ? entitlement.billingStatus : "processing",
      // Webhooks remain the sole subscription authority.
      entitlementUpdated: false,
    }, { headers: { "Cache-Control": "private, no-store" } });
    if (session.status === "complete" && subscriptionId) {
      for (const name of ["nettmark_business_plan_choice", "nettmark_business_plan_choice_v2"]) response.cookies.set(name, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
    }
    return response;
  } catch {
    return NextResponse.json({ error: "Could not verify checkout. Please retry." }, { status: 503 });
  }
}

import { NextResponse } from "next/server";
import { createBusinessSubscriptionStripeClient } from "../../../../utils/businessSubscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  const stripe = createBusinessSubscriptionStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  // UX-only confirmation. Entitlement is intentionally not updated here;
  // Stripe webhooks are the authoritative source for subscription state.
  return NextResponse.json({
    status: session.status,
    paymentStatus: session.payment_status,
    customerId: typeof session.customer === "string" ? session.customer : session.customer?.id || null,
    subscriptionId:
      typeof session.subscription === "string" ? session.subscription : session.subscription?.id || null,
    entitlementUpdated: false,
  });
}

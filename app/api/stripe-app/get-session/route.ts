import { NextResponse } from "next/server";
import Stripe from "stripe";

let stripe: Stripe | undefined;
function getStripe() {
  return stripe ??= new Stripe(process.env.STRIPE_APP_SECRET as string);
}

export async function GET(req: Request) {
  if (!process.env.STRIPE_APP_SECRET?.trim()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const session_id = searchParams.get("session_id");
  if (!session_id) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });

  const session = await getStripe().checkout.sessions.retrieve(session_id, {
    expand: ["customer"],
  });

  return NextResponse.json({
    customer_email: session.customer_email ?? (session.customer as any)?.email ?? null,
    customer_id: typeof session.customer === "string" ? session.customer : (session.customer as any)?.id ?? null,
    subscription_id: typeof session.subscription === "string" ? session.subscription : (session.subscription as any)?.id ?? null,
  });
}
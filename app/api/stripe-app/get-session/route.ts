import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_APP_SECRET as string);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const session_id = searchParams.get("session_id");
  if (!session_id) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });

  const session = await stripe.checkout.sessions.retrieve(session_id, {
    expand: ["customer"],
  });

  return NextResponse.json({
    customer_email: session.customer_email ?? (session.customer as any)?.email ?? null,
    customer_id: typeof session.customer === "string" ? session.customer : (session.customer as any)?.id ?? null,
    subscription_id: typeof session.subscription === "string" ? session.subscription : (session.subscription as any)?.id ?? null,
  });
}
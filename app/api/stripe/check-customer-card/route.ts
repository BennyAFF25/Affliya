import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createStripeClient } from "@/../utils/stripe";

export async function POST() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const { data: biz, error: bizErr } = await supabase
      .from("business_profiles")
      .select("stripe_customer_id")
      .eq("business_email", user.email)
      .single();

    if (bizErr || !biz?.stripe_customer_id) {
      return NextResponse.json(
        { hasCard: false, reason: "missing_customer" },
        { status: 200 },
      );
    }

    const stripe = createStripeClient();

    const customerId = biz.stripe_customer_id as string;

    const customer = await stripe.customers.retrieve(customerId, {
      expand: ["invoice_settings.default_payment_method"],
    });

    const defaultPm =
      typeof customer === "object" && "invoice_settings" in customer
        ? customer.invoice_settings?.default_payment_method
        : null;

    if (defaultPm) {
      return NextResponse.json({ hasCard: true }, { status: 200 });
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
      limit: 1,
    });

    return NextResponse.json(
      { hasCard: (paymentMethods.data?.length || 0) > 0 },
      { status: 200 },
    );
  } catch (err: unknown) {
    console.error("[check-customer-card error]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Stripe error" },
      { status: 500 },
    );
  }
}

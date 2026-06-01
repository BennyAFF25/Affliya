import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createStripeClient } from "@/../utils/stripe";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const offerId = (url.searchParams.get("offerId") || "").trim();

    if (!offerId) {
      return NextResponse.json({ error: "offerId is required" }, { status: 400 });
    }

    const { data: offer, error: offerErr } = await supabase
      .from("offers")
      .select("business_email")
      .eq("id", offerId)
      .maybeSingle();

    if (offerErr || !offer?.business_email) {
      return NextResponse.json(
        { hasPaymentMethod: false, reason: "missing_business" },
        { status: 200 },
      );
    }

    const { data: biz, error: bizErr } = await supabase
      .from("business_profiles")
      .select("stripe_customer_id")
      .eq("business_email", offer.business_email)
      .maybeSingle();

    if (bizErr || !biz?.stripe_customer_id) {
      return NextResponse.json(
        { hasPaymentMethod: false, reason: "missing_customer" },
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
      return NextResponse.json({ hasPaymentMethod: true }, { status: 200 });
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
      limit: 1,
    });

    return NextResponse.json(
      { hasPaymentMethod: (paymentMethods.data?.length || 0) > 0 },
      { status: 200 },
    );
  } catch (err: unknown) {
    console.error("[business/payment-readiness]", err);
    return NextResponse.json(
      { hasPaymentMethod: false, reason: "error" },
      { status: 200 },
    );
  }
}

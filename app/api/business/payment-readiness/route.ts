import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getBusinessPaymentReadiness } from "@/../utils/businessPaymentReadiness";

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

    const readiness = await getBusinessPaymentReadiness({
      supabase,
      businessEmail: offer.business_email,
    });

    return NextResponse.json(readiness, { status: 200 });
  } catch (err: unknown) {
    console.error("[business/payment-readiness]", err);
    return NextResponse.json(
      { hasPaymentMethod: false, reason: "error" },
      { status: 200 },
    );
  }
}

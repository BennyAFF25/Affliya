import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/../utils/businessSubscriptions";
import { getBusinessPaymentReadiness } from "@/../utils/businessPaymentReadiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const userSupabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await userSupabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const readiness = await getBusinessPaymentReadiness({
      supabase: createServerSupabaseClient() as never,
      businessEmail: user.email,
    });

    return NextResponse.json(
      {
        hasCard: readiness.hasPaymentMethod,
        reason: readiness.reason || null,
        customerId: readiness.customerId || null,
        source: readiness.source || null,
      },
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

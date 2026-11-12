import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "../../../../utils/businessSubscriptions";
import { createStripeClient } from "../../../../utils/stripe";
import { logBusinessCardSetupFailure } from "../../../../utils/businessCardSetupAudit";

export async function POST(req: Request) {
  try {
    const client = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user?.email) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    const admin = createServerSupabaseClient();
    const { data: profile, error } = await admin.from("business_profiles")
      .select("id,business_email,stripe_customer_id").eq("business_email", user.email).maybeSingle();
    if (error) throw error;
    if (!profile) return NextResponse.json({ error: "BUSINESS_REQUIRED" }, { status: 403 });
    const input = await req.json().catch(() => null);
    if (!input || typeof input !== "object" || (!input.code && !input.type && !input.decline_code)) {
      return NextResponse.json({ error: "Setup failure details are required." }, { status: 400 });
    }
    if (input.setup_intent) {
      if (typeof input.setup_intent !== "string" || !/^seti_[A-Za-z0-9]+$/.test(input.setup_intent)) {
        return NextResponse.json({ error: "Invalid SetupIntent ID." }, { status: 400 });
      }
      const intent = await createStripeClient().setupIntents.retrieve(input.setup_intent);
      const customerId = typeof intent.customer === "string" ? intent.customer : intent.customer?.id;
      if (!profile.stripe_customer_id || customerId !== profile.stripe_customer_id) {
        return NextResponse.json({ error: "SetupIntent does not belong to this business." }, { status: 403 });
      }
    }
    await logBusinessCardSetupFailure(admin as never, profile, input, "app/api/stripe/setup-intent-failure/route.ts");
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Could not record card setup failure." }, { status: 500 });
  }
}

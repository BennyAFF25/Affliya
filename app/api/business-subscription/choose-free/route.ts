import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient, getOwnedBusinessForUser } from "../../../../utils/businessSubscriptions";
import { recordBusinessFunnelEvent } from "../../../../utils/businessOnboardingServer";
export async function POST(req?: Request) {
  const userClient = createRouteHandlerClient({ cookies });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req?.json().catch(() => ({}));
  const admin = createServerSupabaseClient();
  const business = await getOwnedBusinessForUser({ supabase: admin, businessId: body?.businessId || user.id, userId: user.id, userEmail: user.email });
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 403 });
  await recordBusinessFunnelEvent(admin, {
    eventType: "plan_free_clicked", businessId: business.id, email: business.business_email,
    meta: { source: "plan_choice", choice_confirmed: true },
  });
  // Free never cancels, downgrades or rewrites an existing subscription.
  const response = NextResponse.json({ ok: true, plan: "free" });
  for (const name of ["nettmark_business_plan_choice", "nettmark_business_plan_choice_v2"]) {
    response.cookies.set(name, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  }
  return response;
}

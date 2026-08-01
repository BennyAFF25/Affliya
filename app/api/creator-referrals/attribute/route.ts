import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "../../../../utils/businessSubscriptions";
import { recordCreatorReferralSignupIntent } from "../../../../utils/creatorReferrals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const businessEmail = String(body?.businessEmail || body?.business_email || "").trim().toLowerCase();
    if (!businessEmail) {
      return NextResponse.json({ recorded: false, reason: "missing_business_email" }, { status: 400 });
    }

    const userSupabase = createRouteHandlerClient({ cookies });
    const { data: authData } = await userSupabase.auth.getUser();
    const user = authData?.user || null;

    if (user?.email && user.email.toLowerCase() !== businessEmail) {
      return NextResponse.json({ error: "Business email does not match authenticated user" }, { status: 403 });
    }

    const admin = createServerSupabaseClient();
    const cookieStore = await cookies();
    const result = await recordCreatorReferralSignupIntent({
      supabase: admin,
      cookieStore,
      businessEmail,
      userId: user?.id || null,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("[creator-referrals/attribute]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to record creator referral attribution" },
      { status: 500 },
    );
  }
}

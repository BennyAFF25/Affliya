import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "../../../../../utils/businessSubscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server-side identity lookup: do not grant business accounts direct access
// to affiliates' private profiles / Stripe identifiers in the Data API.
export async function GET() {
  try {
    const client = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user?.email) {
      return NextResponse.json({ success: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const admin = createServerSupabaseClient();
    const { data: ideas, error: ideasError } = await admin
      .from("ad_ideas")
      .select("affiliate_email")
      .eq("business_email", user.email);
    if (ideasError) throw new Error(ideasError.message);
    const emails = Array.from(new Set(
      (ideas || []).map((idea) => String(idea.affiliate_email || "").trim().toLowerCase()).filter(Boolean),
    ));
    if (emails.length === 0) return NextResponse.json({ success: true, names: {} });

    const { data: profiles, error: profilesError } = await admin
      .from("profiles").select("email,username").in("email", emails);
    if (profilesError) throw new Error(profilesError.message);
    const names: Record<string, string> = {};
    for (const profile of profiles || []) {
      const email = String(profile.email || "").trim().toLowerCase();
      const username = String(profile.username || "").trim().replace(/^@+/, "");
      if (email) names[email] = username ? `@${username}` : "Nettmark affiliate";
    }
    return NextResponse.json({ success: true, names });
  } catch (error) {
    console.error("[business/ad-ideas/affiliate-names]", error);
    return NextResponse.json({
      success: false, error: "PROFILE_LOOKUP_FAILED",
      message: "Could not load affiliate names.",
    }, { status: 500 });
  }
}

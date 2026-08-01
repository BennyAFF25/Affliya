import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "../../../../utils/businessSubscriptions";
import { captureCreatorReferral, normalizeCreatorReferralCode } from "../../../../utils/creatorReferrals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safePath(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw || !raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.includes("\\")) return "/";
  return raw.slice(0, 500);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const referralCode = normalizeCreatorReferralCode(url.searchParams.get("ref"));
    if (!referralCode) {
      return NextResponse.json({ captured: false, reason: "missing_referral_code" }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const cookieStore = await cookies();
    const result = await captureCreatorReferral({
      supabase,
      cookieStore,
      referralCode,
      landingPath: safePath(url.searchParams.get("path") || "/"),
      landingReferrer: req.headers.get("referer") || null,
    });

    return NextResponse.json({
      captured: result.captured,
      reason: "reason" in result ? result.reason : null,
    });
  } catch (err: unknown) {
    console.error("[creator-referrals/capture]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to capture creator referral" },
      { status: 500 },
    );
  }
}

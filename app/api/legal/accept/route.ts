import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient, getOwnedBusinessForUser } from "../../../../utils/businessSubscriptions";
import { TERMS_VERSION, termsV2Enabled } from "../../../../utils/legal/version";
import { clientIpFromHeaders, recordLegalAcceptance, userAgentFromHeaders, type LegalAcceptanceContext } from "../../../../utils/legal/acceptance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Signup acceptance is recorded by /api/auth/signup itself (the user may not have a session yet).
const ROUTE_CONTEXTS: LegalAcceptanceContext[] = ["modal", "trial_start", "paid_start"];

export async function POST(req: Request) {
  if (!termsV2Enabled()) return NextResponse.json({ error: "Not available" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const context = String(body?.context || "") as LegalAcceptanceContext;
  if (body?.document !== "terms" || !ROUTE_CONTEXTS.includes(context)) {
    return NextResponse.json({ error: "Invalid acceptance request." }, { status: 400 });
  }
  if (body?.version !== TERMS_VERSION) {
    return NextResponse.json({ error: "Our Terms have been updated. Refresh the page and review them again.", code: "terms_version_mismatch", version: TERMS_VERSION }, { status: 409 });
  }

  const userSupabase = createRouteHandlerClient({ cookies });
  const { data: authData, error: authError } = await userSupabase.auth.getUser();
  const user = authData?.user || null;
  if (authError || !user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServerSupabaseClient();
  let businessId: string | null = null;
  if (context === "trial_start" || context === "paid_start") {
    const requested = String(body?.businessId || "").trim();
    if (!requested || !user.email) return NextResponse.json({ error: "businessId is required" }, { status: 400 });
    const business = await getOwnedBusinessForUser({ supabase: admin, businessId: requested, userId: user.id, userEmail: user.email });
    if (!business) return NextResponse.json({ error: "Business not found or not authorized" }, { status: 403 });
    businessId = business.id;
  }

  try {
    const result = await recordLegalAcceptance(admin, {
      userId: user.id,
      businessId,
      context,
      summaryText: typeof body?.summaryShown === "string" ? body.summaryShown : null,
      ip: clientIpFromHeaders(req.headers),
      userAgent: userAgentFromHeaders(req.headers),
    });
    return NextResponse.json({ ok: true, acceptanceId: result.id, version: TERMS_VERSION, acceptedAt: result.acceptedAt }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not save your acceptance. Please try again." }, { status: 503 });
  }
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import supabaseAdmin from "@/../utils/supabase/server-client";
import { assertAffiliateOfferApproved, type QueryClient } from "@/../utils/approvals/enforcement";
import { UUID } from "@/../utils/affiliate/onboarding";
import { buildPromotionContext, eligibleCreative } from "@/../utils/affiliate/promotionPack";
import { getPromotionAIConfig, reservePromotionQuota, generatePromotionPack, PromotionAIError } from "@/../lib/affiliate/promotionAI";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;
type RouteContext = { params: Promise<{ offerId: string }> };

async function authorize(context: RouteContext) {
  const { offerId } = await context.params;
  if (!UUID.test(offerId)) throw new PromotionAIError(400, "Invalid offer.");
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.email) throw new PromotionAIError(401, "Please sign in to generate a draft.");
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profileError) throw new PromotionAIError(503, "Could not verify your account. Please try again.");
  if (profile?.role !== "affiliate") throw new PromotionAIError(403, "An affiliate account is required.");
  // User-scoped offer read first; service client is used only after access verification.
  const { data: offer, error: offerError } = await supabase.from("offers").select("*").eq("id", offerId).maybeSingle();
  if (offerError) throw new PromotionAIError(503, "Could not load this offer.");
  if (!offer?.business_email) throw new PromotionAIError(404, "Offer not found.");
  if (!["active", "approved", "live", "published"].includes(String(offer.status || "active").toLowerCase())) {
    throw new PromotionAIError(409, "This offer is not currently available.");
  }
  const access = await assertAffiliateOfferApproved(supabaseAdmin as unknown as QueryClient, { offerId, affiliateEmail: user.email });
  if (!access.ok) throw new PromotionAIError(access.status, "Business approval is needed before preparing this promotion.");
  return { user, offer: offer as Record<string, unknown> };
}

function errorResponse(error: unknown) {
  const known = error instanceof PromotionAIError;
  return NextResponse.json({
    error: known ? error.message : "AI is temporarily unavailable. You can still write your promotion manually.",
  }, { status: known ? error.status : 503, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    await authorize(context);
    return NextResponse.json({ available: !!getPromotionAIConfig() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, context: RouteContext) {
  const started = Date.now();
  let release: (() => Promise<void>) | undefined;
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) throw new PromotionAIError(403, "Invalid request origin.");
    const { user, offer } = await authorize(context);
    const config = getPromotionAIConfig();
    if (!config) throw new PromotionAIError(503, "AI drafts aren’t available yet. You can still write your promotion manually.");
    // Bound untrusted input before parsing. The client supplies intent, never a business brief.
    const raw = await request.text();
    if (raw.length > 2000) throw new PromotionAIError(400, "Invalid request.");
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      body = parsed as Record<string, unknown>;
    } catch { throw new PromotionAIError(400, "Invalid request."); }
    if (Object.keys(body).some(key => !["mode", "creativeId"].includes(key))) throw new PromotionAIError(400, "Invalid request.");
    if (body.mode !== "organic" && body.mode !== "paid") throw new PromotionAIError(400, "Choose a promotion type.");
    if (body.creativeId != null && (typeof body.creativeId !== "string" || !UUID.test(body.creativeId))) {
      throw new PromotionAIError(400, "Invalid brand content.");
    }
    const mode = body.mode;
    const [businessResult, assetResult] = await Promise.all([
      supabaseAdmin.from("business_profiles").select("business_name").eq("business_email", offer.business_email).maybeSingle(),
      supabaseAdmin.from("business_creatives").select("id,business_email,offer_id,title,caption,audience,location,allow_organic,allow_paid,is_active,archived_at,updated_at")
        .eq("business_email", offer.business_email).eq("is_active", true).is("archived_at", null)
        .or("offer_id.eq." + offer.id + ",offer_id.is.null").order("updated_at", { ascending: false }).limit(50),
    ]);
    if (assetResult.error) throw new PromotionAIError(503, "Could not load brand context. Please try again.");
    const eligible = ((assetResult.data || []) as Record<string, unknown>[]).filter(asset => eligibleCreative(asset, offer, mode));
    const selected = body.creativeId ? eligible.find(asset => asset.id === body.creativeId) : null;
    if (body.creativeId && !selected) throw new PromotionAIError(403, "This brand content is not available for this offer and promotion type.");
    const source = buildPromotionContext(offer, businessResult.error ? null : businessResult.data, selected ? [selected] : eligible, mode);
    if (!source.hasContext) throw new PromotionAIError(422, "This offer needs a description or brand copy before AI can make a useful draft. You can still write your own.");
    release = await reservePromotionQuota(config, user.id);
    const result = await generatePromotionPack(config, source.context);
    // Operational metrics only. No copy, prompt, email, credentials or customer records in logs.
    console.info("[affiliate-ai]", { status: "completed", durationMs: Date.now() - started, inputTokens: result.inputTokens, outputTokens: result.outputTokens });
    return NextResponse.json({
      pack: result.pack, sources: source.sources, limitedContext: source.limitedContext,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.info("[affiliate-ai]", { status: error instanceof PromotionAIError ? error.status : 503, durationMs: Date.now() - started });
    return errorResponse(error);
  } finally { if (release) await release(); }
}

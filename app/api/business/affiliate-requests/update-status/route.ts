import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "../../../../../utils/businessSubscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const requestId = String(body?.requestId || body?.request_id || "").trim();
    const status = String(body?.status || "").trim().toLowerCase();

    if (!requestId || !["approved", "rejected", "pending"].includes(status)) {
      return NextResponse.json({ success: false, error: "INVALID_REQUEST", message: "Valid requestId and status are required." }, { status: 400 });
    }

    const userSupabase = createRouteHandlerClient({ cookies });
    const { data: authData, error: authError } = await userSupabase.auth.getUser();
    const user = authData?.user || null;
    if (authError || !user?.email) {
      return NextResponse.json({ success: false, error: "UNAUTHENTICATED", message: "Sign in as the business before updating this request." }, { status: 401 });
    }

    const admin = createServerSupabaseClient();
    const { data: request, error: lookupError } = await admin
      .from("affiliate_requests")
      .select("id,business_email,offer_id,affiliate_email,status")
      .eq("id", requestId)
      .maybeSingle();

    if (lookupError) throw new Error(`Failed to load affiliate request: ${lookupError.message}`);
    if (!request || request.business_email !== user.email) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED", message: "Only the offer business can update this request." }, { status: 403 });
    }

    const { data: updated, error: updateError } = await admin
      .from("affiliate_requests")
      .update({ status })
      .eq("id", requestId)
      .eq("business_email", user.email)
      .select("id,status")
      .single();

    if (updateError) {
      throw new Error(`Failed to update affiliate request: ${updateError.message}`);
    }

    return NextResponse.json({ success: true, request: updated });
  } catch (err: unknown) {
    console.error("[business/affiliate-requests/update-status]", err);
    return NextResponse.json({ success: false, error: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "Failed to update affiliate request." }, { status: 500 });
  }
}

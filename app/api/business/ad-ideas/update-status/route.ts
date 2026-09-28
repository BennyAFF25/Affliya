import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "../../../../../utils/businessSubscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const adIdeaId = String(body?.adIdeaId || body?.id || "").trim();
    const status = String(body?.status || "").trim().toLowerCase();
    const rejectionReason =
      typeof body?.rejectionReason === "string" ? body.rejectionReason : null;

    if (!adIdeaId || !["approved", "rejected", "pending"].includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_REQUEST",
          message: "Valid adIdeaId and status are required.",
        },
        { status: 400 },
      );
    }

    const userSupabase = createRouteHandlerClient({ cookies });
    const { data: authData, error: authError } =
      await userSupabase.auth.getUser();
    const user = authData?.user || null;

    if (authError || !user?.email) {
      return NextResponse.json(
        {
          success: false,
          error: "UNAUTHENTICATED",
          message: "Sign in as the business before updating this ad idea.",
        },
        { status: 401 },
      );
    }

    const admin = createServerSupabaseClient();
    const { data: idea, error: lookupError } = await admin
      .from("ad_ideas")
      .select("id,business_email,status")
      .eq("id", adIdeaId)
      .maybeSingle();

    if (lookupError) {
      throw new Error(`Failed to load ad idea: ${lookupError.message}`);
    }

    if (!idea || idea.business_email !== user.email) {
      return NextResponse.json(
        {
          success: false,
          error: "UNAUTHORIZED",
          message: "Only the offer business can update this ad idea.",
        },
        { status: 403 },
      );
    }

    // Approval is now a launch action, not a standalone status mutation. This
    // prevents an ad idea from becoming "approved" before wallet, Growth,
    // billing, Meta, tracking, timing and idempotency checks have all passed.
    if (status === "approved") {
      return NextResponse.json(
        {
          success: false,
          error: "APPROVE_VIA_LAUNCH_REQUIRED",
          message:
            "Paid campaign approval must run through the launch preflight.",
          action: "approve_and_launch",
        },
        { status: 409 },
      );
    }

    const updateData: Record<string, unknown> = { status };
    if (status === "rejected" && rejectionReason) {
      updateData.rejection_reason = rejectionReason;
    }

    const { data: updated, error: updateError } = await admin
      .from("ad_ideas")
      .update(updateData)
      .eq("id", adIdeaId)
      .eq("business_email", user.email)
      .select("id,status")
      .single();

    if (updateError) {
      throw new Error(`Failed to update ad idea: ${updateError.message}`);
    }

    return NextResponse.json({ success: true, adIdea: updated });
  } catch (err: unknown) {
    console.error("[business/ad-ideas/update-status]", err);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message:
          err instanceof Error ? err.message : "Failed to update ad idea.",
      },
      { status: 500 },
    );
  }
}

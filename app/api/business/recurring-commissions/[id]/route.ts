import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await auth.auth.getUser();

    const businessEmail = user?.email || null;
    if (!businessEmail) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { action, reason } = await req.json().catch(() => ({}));
    if (!["pause", "resume", "cancel"].includes(String(action))) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const { data: instance, error: instanceError } = await admin
      .from("recurring_commission_instances")
      .select("id, status, business_email")
      .eq("id", params.id)
      .eq("business_email", businessEmail)
      .maybeSingle();

    if (instanceError || !instance) {
      return NextResponse.json({ error: "Recurring commission schedule not found" }, { status: 404 });
    }

    if (action === "pause") {
      const { error } = await admin
        .from("recurring_commission_instances")
        .update({ status: "paused" })
        .eq("id", params.id)
        .eq("business_email", businessEmail);

      if (error) throw error;
      return NextResponse.json({ ok: true, id: params.id, status: "paused" });
    }

    if (action === "resume") {
      const { data: nextPending } = await admin
        .from("wallet_payouts")
        .select("available_at")
        .eq("recurring_instance_id", params.id)
        .eq("status", "pending")
        .order("cycle_number", { ascending: true })
        .limit(1)
        .maybeSingle();

      const { error } = await admin
        .from("recurring_commission_instances")
        .update({
          status: "active",
          next_payout_at: nextPending?.available_at || null,
        })
        .eq("id", params.id)
        .eq("business_email", businessEmail);

      if (error) throw error;
      return NextResponse.json({ ok: true, id: params.id, status: "active" });
    }

    const { error: payoutUpdateError } = await admin
      .from("wallet_payouts")
      .update({ status: "cancelled" })
      .eq("recurring_instance_id", params.id)
      .eq("business_email", businessEmail)
      .eq("status", "pending");

    if (payoutUpdateError) throw payoutUpdateError;

    const { error: instanceUpdateError } = await admin
      .from("recurring_commission_instances")
      .update({
        status: "cancelled",
        cancel_reason: typeof reason === "string" && reason.trim() ? reason.trim() : null,
        next_payout_at: null,
      })
      .eq("id", params.id)
      .eq("business_email", businessEmail);

    if (instanceUpdateError) throw instanceUpdateError;

    return NextResponse.json({ ok: true, id: params.id, status: "cancelled" });
  } catch (error: unknown) {
    console.error("[recurring-commissions.patch]", error);
    return NextResponse.json(
      { error: errorMessage(error, "Failed to update recurring commission schedule.") },
      { status: 500 },
    );
  }
}

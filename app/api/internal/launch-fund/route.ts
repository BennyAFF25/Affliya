import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../utils/businessSubscriptions";
import {
  allocateLaunchFund,
  cancelLaunchFundAllocation,
  expireLaunchFundAllocations,
  isTrustedLaunchFundRequest,
} from "../../../../utils/launchFund";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeAction(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export async function POST(req: Request) {
  if (!isTrustedLaunchFundRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = normalizeAction(body?.action);
    const supabase = createServerSupabaseClient();
    await expireLaunchFundAllocations(supabase as never);

    if (action === "allocate") {
      const result = await allocateLaunchFund({
        supabase: supabase as never,
        affiliateEmail: body?.affiliateEmail || body?.affiliate_email,
        affiliateId: body?.affiliateId || body?.affiliate_id || null,
        offerId: body?.offerId || body?.offer_id || null,
        amount: body?.amount == null ? undefined : Number(body.amount),
        currency: body?.currency || "aud",
        reason: String(body?.reason || "Controlled Nettmark Launch Fund allocation"),
        source: body?.source || "initial_launch_fund",
        allocatedBy: String(body?.allocatedBy || body?.allocated_by || "internal_operator"),
        expiresAt: body?.expiresAt || body?.expires_at || null,
        allowDuplicate: Boolean(body?.allowDuplicate || body?.allow_duplicate),
      });
      return NextResponse.json(result);
    }

    if (action === "cancel") {
      const result = await cancelLaunchFundAllocation({
        supabase: supabase as never,
        allocationId: String(body?.allocationId || body?.allocation_id || ""),
        cancelledBy: String(body?.cancelledBy || body?.cancelled_by || "internal_operator"),
        reason: String(body?.reason || "Cancelled by Nettmark operator"),
      });
      return NextResponse.json(result);
    }

    if (action === "history") {
      const affiliateEmail = String(body?.affiliateEmail || body?.affiliate_email || "").trim().toLowerCase();
      const offerId = body?.offerId || body?.offer_id || null;

      let allocationsQuery = supabase
        .from("affiliate_launch_fund_allocations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (affiliateEmail) allocationsQuery = allocationsQuery.eq("affiliate_email", affiliateEmail);
      if (offerId) allocationsQuery = allocationsQuery.eq("allocated_for_offer_id", offerId);

      const { data: allocations, error: allocationsError } = await allocationsQuery;
      if (allocationsError) throw new Error(`Failed to load Launch Fund allocations: ${allocationsError.message}`);

      let transactionsQuery = supabase
        .from("affiliate_launch_fund_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (affiliateEmail) transactionsQuery = transactionsQuery.eq("affiliate_email", affiliateEmail);
      if (offerId) transactionsQuery = transactionsQuery.eq("offer_id", offerId);

      const { data: transactions, error: transactionsError } = await transactionsQuery;
      if (transactionsError) throw new Error(`Failed to load Launch Fund transactions: ${transactionsError.message}`);

      return NextResponse.json({ allocations: allocations || [], transactions: transactions || [] });
    }

    return NextResponse.json({ error: "Unsupported Launch Fund action" }, { status: 400 });
  } catch (err: unknown) {
    console.error("[internal/launch-fund]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Launch Fund operation failed" },
      { status: 500 },
    );
  }
}

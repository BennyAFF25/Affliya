import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { tryWriteMoneyFlowAudit } from "@/../utils/moneyFlowAudit";
import { processAdSpendTransferBatches } from "@/../utils/adSpend/settlements";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function isAuthorized(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return { ok: false, error: "SERVER_MISCONFIGURED" } as const;
  }

  const authHeader = req.headers.get("authorization");
  const xCron = req.headers.get("x-cron-secret");
  const ok = authHeader === `Bearer ${cronSecret}` || xCron === cronSecret;
  return ok ? ({ ok: true } as const) : ({ ok: false, error: "UNAUTHORIZED" } as const);
}

async function run(req: Request) {
  const auth = isAuthorized(req);
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.error === "SERVER_MISCONFIGURED" ? 500 : 401 },
    );
  }

  try {
    const body = req.method === "POST" ? ((await req.json().catch(() => ({}))) as { limitBusinesses?: unknown }) : {};
    const limitBusinesses = Number(body.limitBusinesses ?? 10);
    const result = await processAdSpendTransferBatches({
      supabase: supabase as never,
      limitBusinesses,
    });

    for (const batch of result.batches) {
      const skippedReason =
        batch.settlementStatus === "pending_funds"
          ? "AD_SPEND_TRANSFER_PENDING_FUNDS"
          : batch.settlementStatus === "transfer_blocked"
            ? "AD_SPEND_TRANSFER_BLOCKED"
            : "AD_SPEND_TRANSFER_BATCH_SKIPPED";

      await tryWriteMoneyFlowAudit(supabase as never, {
        eventType:
          batch.status === "succeeded"
            ? "ad_spend_transfer_batch_succeeded"
            : batch.status === "failed"
              ? "ad_spend_transfer_batch_failed"
              : batch.settlementStatus === "transfer_blocked"
                ? "ad_spend_transfer_batch_blocked"
                : "ad_spend_transfer_batch_skipped",
        severity: batch.status === "failed" || batch.settlementStatus === "transfer_blocked" ? "warning" : "info",
        sourceRoute: "app/api/ad-spend/process-transfer-batches/route.ts",
        entityType: "business_profile",
        entityId: batch.businessId || batch.businessEmail,
        businessEmail: batch.businessEmail,
        businessId: batch.businessId,
        reasonCode:
          batch.status === "succeeded"
            ? "AD_SPEND_TRANSFER_BATCH_COMPLETED"
            : batch.status === "failed"
              ? "AD_SPEND_TRANSFER_BATCH_FAILED"
              : skippedReason,
        message:
          batch.status === "succeeded"
            ? "Queued ad spend settlements were transferred to the business Stripe account."
            : batch.error || "Ad spend transfer batch did not complete.",
        metadata: batch as Record<string, unknown>,
      });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    await tryWriteMoneyFlowAudit(supabase as never, {
      eventType: "ad_spend_transfer_batch_failed",
      severity: "error",
      sourceRoute: "app/api/ad-spend/process-transfer-batches/route.ts",
      reasonCode: "AD_SPEND_TRANSFER_BATCH_UNHANDLED",
      message: err instanceof Error ? err.message : String(err),
      metadata: {
        error: err instanceof Error ? err.stack || err.message : String(err),
      },
    });

    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}

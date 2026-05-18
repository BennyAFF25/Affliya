import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { tryWriteMoneyFlowAudit } from "@/../utils/moneyFlowAudit";
import { syncAffiliateWalletCache } from "@/../utils/wallet/syncAffiliateWalletCache";
import { settleAdSpendLedger } from "@/../utils/adSpend/settlements";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const liveAdId = body?.liveAdId as string | undefined;
    const chunkAmount = typeof body?.chunkAmount === "number" ? body.chunkAmount : undefined;

    if (!liveAdId) {
      return NextResponse.json({ error: "Missing liveAdId" }, { status: 400 });
    }

    const { data: liveAd, error: liveAdError } = await supabase
      .from("live_ads")
      .select("id, affiliate_email, affiliate_user_id, business_email, business_id, offer_id")
      .eq("id", liveAdId)
      .maybeSingle();

    if (liveAdError || !liveAd) {
      return NextResponse.json(
        { error: "Live ad not found", details: liveAdError },
        { status: 404 },
      );
    }

    const auditBase = {
      sourceRoute: "app/api/ad-spend/settle/route.ts",
      entityType: "live_ad",
      entityId: liveAdId,
      liveAdId,
      affiliateEmail: String(liveAd.affiliate_email || "") || null,
      businessEmail: String(liveAd.business_email || "") || null,
      affiliateUserId: typeof liveAd.affiliate_user_id === "string" ? liveAd.affiliate_user_id : null,
      businessId: typeof liveAd.business_id === "string" ? liveAd.business_id : null,
      offerId: typeof liveAd.offer_id === "string" ? liveAd.offer_id : null,
    };

    const settlement = await settleAdSpendLedger({
      supabase: supabase as never,
      liveAdId,
      chunkAmount,
    });

    if (!settlement.success) {
      const status =
        settlement.error === "LIVE_AD_NOT_FOUND"
          ? 404
          : settlement.error === "INSUFFICIENT_WALLET_BALANCE" ||
              settlement.error === "MISSING_REQUIRED_FIELDS_ON_LIVE_AD"
            ? 400
            : 500;

      await tryWriteMoneyFlowAudit(supabase as never, {
        eventType: "ad_spend_settlement_failed",
        severity: status >= 500 ? "error" : "warning",
        ...auditBase,
        reasonCode: settlement.error || "SETTLEMENT_FAILED",
        message: settlement.message || "Ad spend settlement did not complete.",
        metadata: settlement as Record<string, unknown>,
      });

      return NextResponse.json(settlement, { status });
    }

    if (settlement.affiliateEmail) {
      try {
        await syncAffiliateWalletCache(supabase as never, settlement.affiliateEmail);
      } catch (syncError: unknown) {
        console.error("[❌ wallet cache sync error after ad spend settlement]", syncError);
      }
    }

    await tryWriteMoneyFlowAudit(supabase as never, {
      eventType: "ad_spend_settlement_succeeded",
      severity: "info",
      ...auditBase,
      reasonCode:
        settlement.chargedAmount > 0
          ? "SETTLEMENT_LEDGER_APPLIED_TRANSFER_PENDING"
          : settlement.message
            ? "SETTLEMENT_NOOP"
            : "SETTLEMENT_SUCCEEDED",
      message:
        settlement.chargedAmount > 0
          ? "Ad spend settlement ledger applied successfully; Stripe transfer queued separately."
          : settlement.message || "Ad spend settlement completed successfully.",
      metadata: settlement as Record<string, unknown>,
    });

    return NextResponse.json({
      ...settlement,
      queuedForTransfer: settlement.transferStatus === "transfer_pending",
    });
  } catch (err: unknown) {
    await tryWriteMoneyFlowAudit(supabase as never, {
      eventType: "ad_spend_settlement_failed",
      severity: "error",
      sourceRoute: "app/api/ad-spend/settle/route.ts",
      reasonCode: "AD_SPEND_SETTLE_UNHANDLED",
      message: err instanceof Error ? err.message : String(err),
      metadata: {
        error: err instanceof Error ? err.stack || err.message : String(err),
      },
    });
    console.error("[❌ Unhandled ad-spend/settle error]", err);
    return NextResponse.json(
      { error: "Internal error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

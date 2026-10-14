import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "../../../../utils/businessSubscriptions";
import { getSpendableWalletBalance } from "../../../../utils/wallet/spendableBalance";
import { confirmedFundingPause, type PauseNotice } from "../../../../utils/wallet/pauseNotice";
import { getAdSpendFundingSnapshot, getAdSpendSettlementConfig } from "../../../../utils/adSpend/settlements";
import { shouldPauseForFunding } from "../../../../utils/adSpend/pauseGuardrail";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const client = createRouteHandlerClient({ cookies });
    const { data, error } = await client.auth.getUser();
    if (error || !data.user?.email) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    const email = data.user.email;
    const admin = createServerSupabaseClient();
    // All data stays scoped to verified session ownership; no caller-supplied identity.
    const ads = await admin.from("live_ads").select("*").eq("affiliate_email", email);
    if (ads.error) throw ads.error;
    const walletLeft = await getSpendableWalletBalance(admin, email);
    const notices: Record<string, PauseNotice> = {};
    await Promise.all((ads.data || []).map(async ad => {
      if (!["paused", "stopped"].includes(String(ad.status || "").toLowerCase()) || ad.terminated_by_business_at || ad.billing_state === "TERMINATED_BY_BUSINESS") return;
      const audit = await admin.from("money_flow_audit_log").select("reason_code,created_at")
        .eq("affiliate_email", email).eq("live_ad_id", ad.id).eq("event_type", "campaign_pause_reason")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!audit.error && confirmedFundingPause(ad, audit.data || undefined)) {
        const currentFunding = await getAdSpendFundingSnapshot(admin as never, {
          offerId: ad.offer_id || "", businessEmail: ad.business_email || "", affiliateEmail: email,
        });
        const unpaid = Math.max(0, Number(ad.spend || 0) - Number(ad.spend_transferred || 0));
        notices[ad.id] = { confirmed: true, walletLeft, needsFunds: shouldPauseForFunding(currentFunding.availableBalance, unpaid, getAdSpendSettlementConfig().walletBuffer) };
        return;
      }
      if (!audit.error && audit.data?.reason_code &&
        (!ad.billing_paused_at || Date.parse(audit.data.created_at) >= Date.parse(ad.billing_paused_at))) return;
      // Historical rows have no reliable cause. Compare existing settlement/funding
      // evidence with the actual guardrail, including reserved brand subsidy.
      if (String(ad.billing_state || "").toUpperCase() !== "PAUSED" || Number(ad.spend || 0) <= 0) return;
      const funding = await getAdSpendFundingSnapshot(admin as never, {
        offerId: ad.offer_id || "", businessEmail: ad.business_email || "", affiliateEmail: email,
      });
      const unpaid = Math.max(0, Number(ad.spend || 0) - Number(ad.spend_transferred || 0));
      if (shouldPauseForFunding(funding.availableBalance, unpaid, getAdSpendSettlementConfig().walletBuffer)) {
        notices[ad.id] = { confirmed: false, walletLeft };
      }
    }));
    return NextResponse.json({ notices });
  } catch {
    return NextResponse.json({ error: "PAUSE_NOTICES_UNAVAILABLE" }, { status: 503 });
  }
}

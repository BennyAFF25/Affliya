import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createServerSupabaseClient } from "../../../../utils/businessSubscriptions";
import { deliverPendingGrowthTrials, reconcileGrowthTrialReporting } from "../../../../utils/marketing/startTrialServer";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET ? "Bearer " + process.env.CRON_SECRET : "";
  const actual = req.headers.get("authorization") || "";
  if (!expected || Buffer.byteLength(actual) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const supabase = createServerSupabaseClient();
    await reconcileGrowthTrialReporting(supabase);
    const result = await deliverPendingGrowthTrials(supabase);
    return NextResponse.json(result);
  } catch {
    console.warn("[meta-start-trial] delivery worker failed");
    return NextResponse.json({ error: "Reporting worker failed" }, { status: 500 });
  }
}

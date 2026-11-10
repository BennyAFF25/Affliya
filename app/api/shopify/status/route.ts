import { NextResponse } from "next/server";
import { requireBusiness, errorReason, errorStatus } from "../../../../lib/shopify/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { admin, businessId } = await requireBusiness();
    const { data, error } = await admin.from("shopify_stores").select("id,shop_domain,status,installed_at,uninstalled_at").eq("business_id", businessId).order("created_at");
    if (error) throw new Error("database");
    return NextResponse.json({ stores: data || [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const reason = errorReason(error);
    return NextResponse.json({ error: reason }, { status: errorStatus(reason) });
  }
}

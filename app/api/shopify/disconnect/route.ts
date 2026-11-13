import { deletePixel } from "../../../../lib/shopify/pixel";
import { NextRequest, NextResponse } from "next/server";
import { requireBusiness, errorReason, errorStatus } from "../../../../lib/shopify/server";
import { decryptToken } from "../../../../lib/shopify/security";
import { revokeAccess } from "../../../../lib/shopify/admin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get("origin") !== req.nextUrl.origin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const { admin, businessId } = await requireBusiness();
    const { id } = await req.json();
    if (typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id)) return NextResponse.json({ error: "invalid_store" }, { status: 400 });
    const { data: store, error: lookupError } = await admin.from("shopify_stores").select("shop_domain,access_token_encrypted").eq("id", id).eq("business_id", businessId).maybeSingle();
    if (lookupError) throw new Error("database");
    if (!store) return NextResponse.json({ ok: true });
    if (store.access_token_encrypted) {
      try { await deletePixel(store.shop_domain, decryptToken(store.access_token_encrypted)); }
      catch { console.warn("[shopify] pixel_delete_failed", { shop: store.shop_domain }); }
      try { await revokeAccess(store.shop_domain, decryptToken(store.access_token_encrypted)); }
      catch { console.warn("[shopify] access revocation failed", { shop: store.shop_domain }); }
    }
    const { error } = await admin.from("shopify_stores").update({ status: "disconnected", pixel_status: "inactive", pixel_id: null, pixel_error: null, pixel_updated_at: new Date().toISOString(), access_token_encrypted: null, updated_at: new Date().toISOString() }).eq("id", id).eq("business_id", businessId);
    if (error) throw new Error("database");
    return NextResponse.json({ ok: true });
  } catch (error) {
    const reason = errorReason(error);
    return NextResponse.json({ error: reason }, { status: errorStatus(reason) });
  }
}

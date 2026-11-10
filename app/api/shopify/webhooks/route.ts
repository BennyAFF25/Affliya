import { NextRequest, NextResponse } from "next/server";
import { env, validShop, verifyWebhookHmac } from "../../../../lib/shopify/security";
import { handleWebhook } from "../../../../lib/shopify/webhooks";
import { createServerSupabaseClient } from "../../../../utils/supabase/createServerClient";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const raw = Buffer.from(await req.arrayBuffer());
    if (!verifyWebhookHmac(raw, req.headers.get("x-shopify-hmac-sha256"), env("SHOPIFY_CLIENT_SECRET"))) return new NextResponse(null, { status: 401 });
    const shop = req.headers.get("x-shopify-shop-domain") || "";
    if (!validShop(shop)) return new NextResponse(null, { status: 400 });
    const topic = req.headers.get("x-shopify-topic") || "";
    if (topic === "customers/data_request") console.info("[shopify] compliance request", { topic, shop });
    const triggeredHeader = req.headers.get("x-shopify-triggered-at");
    const parsed = triggeredHeader ? Date.parse(triggeredHeader) : NaN;
    const triggeredAt = new Date(Number.isFinite(parsed) ? parsed : Date.now()).toISOString();
    await handleWebhook(topic, shop, {
      async uninstall(domain, triggeredAt) {
        const admin = createServerSupabaseClient();
        const { error } = await admin.from("shopify_stores").update({ status: "uninstalled", access_token_encrypted: null, uninstalled_at: triggeredAt, updated_at: new Date().toISOString() }).eq("shop_domain", domain).neq("status", "uninstalled").lt("installed_at", triggeredAt);
        if (error) throw new Error("database");
      },
      async redact(domain) {
        const admin = createServerSupabaseClient();
        const { error } = await admin.from("shopify_stores").delete().eq("shop_domain", domain);
        if (error) throw new Error("database");
      },
    }, triggeredAt);
    return new NextResponse(null, { status: 200 });
  } catch {
    // Retryable, without leaking webhook payloads or credentials.
    return new NextResponse(null, { status: 503 });
  }
}

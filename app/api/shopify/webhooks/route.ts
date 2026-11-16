import { confirmShopifyBilling, uninstallShopifyBilling } from '../../../../lib/shopify/billing';
import { NextRequest, NextResponse } from "next/server";
import { env, validShop, verifyWebhookHmac } from "../../../../lib/shopify/security";
import { clearedTokens } from "../../../../lib/shopify/tokens";
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
    if (topic === "app_subscriptions/update") {
      // HMAC-authenticated event is a hint only: never activate from the payload.
      const admin = createServerSupabaseClient();
      const { data: store, error } = await admin.from("shopify_stores").select("business_id").eq("shop_domain", shop).eq("status", "connected").maybeSingle();
      if (error) throw new Error("database");
      if (store) {
        const { data: entitlement, error } = await admin.from("business_entitlements").select("billing_provider").eq("business_id", store.business_id).single();
        if (error) throw new Error("database");
        if (entitlement.billing_provider === "shopify") await confirmShopifyBilling(admin, store.business_id);
      }
    }
    await handleWebhook(topic, shop, {
      async uninstall(domain, triggeredAt) {
        const admin = createServerSupabaseClient();
        await uninstallShopifyBilling(admin, domain, triggeredAt);
        const { error } = await admin.from("shopify_stores").update({ status: "uninstalled", pixel_status: "inactive", pixel_id: null, pixel_error: null, pixel_updated_at: new Date().toISOString(), ...clearedTokens, uninstalled_at: triggeredAt, updated_at: new Date().toISOString() }).eq("shop_domain", domain).neq("status", "uninstalled").lt("installed_at", triggeredAt);
        if (error) throw new Error("database");
        const { data: inactive, error: lookupError } = await admin.from("shopify_stores").select("id").eq("shop_domain", domain).eq("status", "uninstalled").lt("installed_at", triggeredAt).maybeSingle();
        if (lookupError) throw new Error("database");
        if (inactive) {
          const { error: deleteError } = await admin.from("shopify_stores").delete().eq("id", inactive.id).eq("status", "uninstalled").lt("installed_at", triggeredAt);
          if (deleteError) throw new Error("database");
        }
        const { error: pendingError } = await admin.from("shopify_pending_installs").delete().eq("shop_domain", domain).lt("created_at", triggeredAt);
        if (pendingError) throw new Error("database");
      },
      async redact(domain) {
        const admin = createServerSupabaseClient();
        const { error: pendingError } = await admin.from("shopify_pending_installs").delete().eq("shop_domain", domain);
        if (pendingError) throw new Error("database");
        const { error: purgeError } = await admin.from("shopify_order_conversions").delete().eq("shop_domain", domain);
        if (purgeError) throw new Error("database");
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

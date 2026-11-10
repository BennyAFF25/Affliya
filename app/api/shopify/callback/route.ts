import { NextRequest, NextResponse } from "next/server";
import { env, encryptToken, requiredScopes, validShop, verifyOAuthHmac, verifyState, stateSecret } from "../../../../lib/shopify/security";
import { exchangeToken, registerWebhooks } from "../../../../lib/shopify/admin";
import { webhookBaseUrl, BUSINESS_PAGE, NONCE_COOKIE, requireBusiness, errorReason } from "../../../../lib/shopify/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const destination = new URL(BUSINESS_PAGE, req.nextUrl.origin);
  try {
    const params = req.nextUrl.searchParams;
    if (!verifyOAuthHmac(params, env("SHOPIFY_CLIENT_SECRET"))) throw new Error("invalid_hmac");
    const shop = params.get("shop") || "";
    if (!validShop(shop)) throw new Error("invalid_shop");
    const state = verifyState(params.get("state") || "", req.cookies.get(NONCE_COOKIE)?.value, stateSecret());
    if (state.shop !== shop) throw new Error("invalid_state");
    const { user, businessId, admin } = await requireBusiness();
    if (user.id !== state.userId || businessId !== state.businessId) throw new Error("session_mismatch");
    const code = params.get("code");
    if (!code) throw new Error("missing_code");
    const { data: existing, error: lookupError } = await admin.from("shopify_stores").select("id,business_id,status").eq("shop_domain", shop).maybeSingle();
    if (lookupError) throw new Error("database");
    if (existing && existing.business_id !== businessId && existing.status === "connected") throw new Error("shop_already_connected");
    const { token, scopes } = await exchangeToken(shop, code, requiredScopes());
    const now = new Date().toISOString();
    const connection = { business_id: businessId, shop_domain: shop, access_token_encrypted: encryptToken(token), scopes, status: "connected", installed_at: now, uninstalled_at: null, updated_at: now };
    // Insert cannot steal an existing unique domain if another callback won the race.
    if (existing) {
      const update = admin.from("shopify_stores").update(connection).eq("id", existing.id);
      const guarded = existing.business_id === businessId
        ? update.eq("business_id", businessId)
        : update.neq("status", "connected");
      const { data: saved, error } = await guarded.select("id").maybeSingle();
      if (error) throw new Error("database");
      if (!saved) throw new Error("shop_already_connected");
    } else {
      const { error } = await admin.from("shopify_stores").insert(connection);
      if (error) throw new Error(error.code === "23505" ? "shop_already_connected" : "database");
    }
    try { await registerWebhooks(shop, token, webhookBaseUrl(req)); }
    catch { console.warn("[shopify] uninstall webhook registration failed", { shop }); }
    destination.searchParams.set("shopify", "connected");
  } catch (error) {
    destination.searchParams.set("shopify_error", errorReason(error));
  }
  const response = NextResponse.redirect(destination);
  response.cookies.set(NONCE_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/shopify", maxAge: 0 });
  return response;
}

import { claimShopifyBilling } from '../../../../lib/shopify/billing';
import { NextRequest, NextResponse } from "next/server";
import { env, requiredScopes, validShop, verifyOAuthHmac, verifyState, stateSecret } from "../../../../lib/shopify/security";
import { exchangeToken } from "../../../../lib/shopify/admin";
import { webhookBaseUrl, BUSINESS_PAGE, NONCE_COOKIE, nonceCookieOptions, optionalBusiness, errorReason } from "../../../../lib/shopify/server";
import { createServerSupabaseClient } from "../../../../utils/supabase/createServerClient";
import { connectShop } from "../../../../lib/shopify/connect";
import { encryptedTokens } from "../../../../lib/shopify/tokens";
import { savePending, PENDING_COOKIE, pendingCookieOptions, COMPLETE_PATH } from "../../../../lib/shopify/pending";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  let destination = new URL(BUSINESS_PAGE, req.nextUrl.origin);
  let pending: string | null = null;
  try {
    const params = req.nextUrl.searchParams;
    if (!verifyOAuthHmac(params, env("SHOPIFY_CLIENT_SECRET"))) throw new Error("invalid_hmac");
    const shop = params.get("shop") || "";
    if (!validShop(shop)) throw new Error("invalid_shop");
    const state = verifyState(params.get("state") || "", req.cookies.get(NONCE_COOKIE)?.value, stateSecret());
    if (state.shop !== shop) throw new Error("invalid_state");
    const session = await optionalBusiness();
    if (session && state.userId !== null && (session.user.id !== state.userId || session.businessId !== state.businessId)) throw new Error("session_mismatch");
    const code = params.get("code");
    if (!code) throw new Error("missing_code");
    const pair = await exchangeToken(shop, code, requiredScopes());
    if (session) {
      await connectShop(session.admin, session.businessId, shop, pair.scopes, encryptedTokens(pair), webhookBaseUrl(req));
      if (state.userId === null && await claimShopifyBilling(session.admin, session.businessId, shop, true)) destination.pathname = "/business/choose-plan";
      destination.searchParams.set("shopify", "connected");
    } else {
      pending = await savePending(createServerSupabaseClient(), state, pair);
      destination = new URL(`/login/business?next=${encodeURIComponent(COMPLETE_PATH)}`, req.nextUrl.origin);
    }
  } catch (error) {
    destination.searchParams.set("shopify_error", errorReason(error));
  }
  const response = NextResponse.redirect(destination);
  response.cookies.set(NONCE_COOKIE, "", { ...nonceCookieOptions, maxAge: 0 });
  response.cookies.set(PENDING_COOKIE, pending || "", { ...pendingCookieOptions, maxAge: pending ? pendingCookieOptions.maxAge : 0 });
  return response;
}

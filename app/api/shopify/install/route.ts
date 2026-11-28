import { NextRequest, NextResponse } from "next/server";
import { env, normalizeShop, nonce, signState, stateSecret, requiredScopes, verifyOAuthHmac } from "../../../../lib/shopify/security";
import { BUSINESS_PAGE, NONCE_COOKIE, nonceCookieOptions, optionalBusiness, errorReason } from "../../../../lib/shopify/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    if (params.has("hmac") && !verifyOAuthHmac(params, env("SHOPIFY_CLIENT_SECRET"))) throw new Error("invalid_hmac");
    if (!params.has("shop")) {
      const listing = new URL(env("SHOPIFY_APP_STORE_URL"));
      if (listing.protocol !== "https:" || listing.hostname !== "apps.shopify.com" || listing.username || listing.password) throw new Error("configuration");
      return NextResponse.redirect(listing);
    }
    const shop = normalizeShop(params.get("shop") || "");
    const session = await optionalBusiness();
    const randomNonce = nonce();
    const state = signState({ nonce: randomNonce, userId: session?.user.id ?? null, businessId: session?.businessId ?? null, shop, issuedAt: Date.now() }, stateSecret());
    const url = new URL(`https://${shop}/admin/oauth/authorize`);
    url.searchParams.set("client_id", env("SHOPIFY_CLIENT_ID"));
    url.searchParams.set("scope", requiredScopes().join(","));
    url.searchParams.set("redirect_uri", `${req.nextUrl.origin}/api/shopify/callback`);
    url.searchParams.set("state", state);
    const response = NextResponse.redirect(url);
    response.cookies.set(NONCE_COOKIE, randomNonce, nonceCookieOptions);
    return response;
  } catch (error) {
    const reason = errorReason(error);
    const url = new URL(BUSINESS_PAGE, req.nextUrl.origin);
    url.searchParams.set("shopify_error", reason);
    const response = reason === "invalid_hmac"
      ? NextResponse.json({ error: reason }, { status: 401 }) : NextResponse.redirect(url);
    response.cookies.set(NONCE_COOKIE, "", { ...nonceCookieOptions, maxAge: 0 });
    return response;
  }
}

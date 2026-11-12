import { NextRequest, NextResponse } from "next/server";
import { env, normalizeShop, nonce, signState, stateSecret, requiredScopes, verifyOAuthHmac } from "../../../../lib/shopify/security";
import { BUSINESS_PAGE, NONCE_COOKIE, requireBusiness, errorReason } from "../../../../lib/shopify/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    if (params.has("hmac") && !verifyOAuthHmac(params, env("SHOPIFY_CLIENT_SECRET"))) throw new Error("invalid_hmac");
    const shop = normalizeShop(params.get("shop") || "");
    const { user, businessId } = await requireBusiness();
    const randomNonce = nonce();
    const state = signState({ nonce: randomNonce, userId: user.id, businessId, shop, issuedAt: Date.now() }, stateSecret());
    const url = new URL(`https://${shop}/admin/oauth/authorize`);
    url.searchParams.set("client_id", env("SHOPIFY_CLIENT_ID"));
    url.searchParams.set("scope", requiredScopes().join(","));
    url.searchParams.set("redirect_uri", `${req.nextUrl.origin}/api/shopify/callback`);
    url.searchParams.set("state", state);
    const response = NextResponse.redirect(url);
    response.cookies.set(NONCE_COOKIE, randomNonce, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/shopify", maxAge: 600 });
    return response;
  } catch (error) {
    const url = new URL(BUSINESS_PAGE, req.nextUrl.origin);
    url.searchParams.set("shopify_error", errorReason(error));
    return NextResponse.redirect(url);
  }
}

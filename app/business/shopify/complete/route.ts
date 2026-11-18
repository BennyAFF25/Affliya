import { claimShopifyBilling } from '../../../../lib/shopify/billing';
import { NextRequest, NextResponse } from 'next/server';
import { requireBusiness, webhookBaseUrl, BUSINESS_PAGE, errorReason } from '../../../../lib/shopify/server';
import { PENDING_COOKIE, pendingCookieOptions, takePending, COMPLETE_PATH } from '../../../../lib/shopify/pending';
import { requiredScopes, hasRequiredScopes } from '../../../../lib/shopify/security';
import { connectShop } from '../../../../lib/shopify/connect';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const destination = new URL(BUSINESS_PAGE, req.nextUrl.origin);
  // Keep the pending cookie when auth/profile is not ready yet, so the grant can be completed after signup.
  let clearPending = false;
  try {
    const { admin, user, businessId } = await requireBusiness();
    const pending = await takePending(admin, req.cookies.get(PENDING_COOKIE)?.value, user.id, businessId);
    clearPending = true;
    if (!hasRequiredScopes(pending.scopes, requiredScopes())) throw new Error('missing_scopes');
    await connectShop(admin, businessId, pending.shop_domain, pending.scopes, {
      access_token_encrypted: pending.access_token_encrypted, refresh_token_encrypted: pending.refresh_token_encrypted,
      access_token_expires_at: pending.access_token_expires_at, refresh_token_expires_at: pending.refresh_token_expires_at,
    }, webhookBaseUrl(req));
    if (pending.user_id === null && await claimShopifyBilling(admin, businessId, pending.shop_domain, true)) destination.pathname = '/business/choose-plan';
    destination.searchParams.set('shopify', 'connected');
  } catch (error) {
    if (error instanceof Error && error.message === 'unauthorized') {
      return NextResponse.redirect(new URL(`/login/business?next=${encodeURIComponent(COMPLETE_PATH)}`, req.nextUrl.origin));
    }
    destination.searchParams.set('shopify_error', errorReason(error));
    if (error instanceof Error && (error.message === 'forbidden' || error.message === 'business_profile_required')) {
      return NextResponse.redirect(destination);
    }
  }
  const response = NextResponse.redirect(destination);
  if (clearPending) response.cookies.set(PENDING_COOKIE, '', { ...pendingCookieOptions, maxAge: 0 });
  return response;
}
